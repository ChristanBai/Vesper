import { readJson, writeJson, cachePath, configPath } from "./config.mjs";
import {
  allocationByPosition,
  mapOrders,
  mapPies,
  mapPositions,
  mapSummary,
  mapTransactions,
  normalizeTicker,
  reconcilePositionsAndPies
} from "./portfolio.mjs";
import {
  normalizeOrderPage,
  normalizeTransactionPage
} from "./t212-client.mjs";

const FRESHNESS_MS = {
  overview: 60_000,
  positions: 60_000,
  orders: 1_800_000,
  pies: 900_000,
  transactions: 1_800_000
};

export class PortfolioSyncService {
  constructor({ client, env = process.env, now = () => Date.now() }) {
    this.client = client;
    this.env = env;
    this.now = now;
    this.memoryCache = null;
    this.inFlight = null;
    this.ordersRetryAfter = 0;
  }

  async readCache() {
    if (this.memoryCache) return this.memoryCache;
    const cached = await readJson(cachePath(this.env), null);
    this.memoryCache = normalizeCachedSnapshot(cached);
    return this.memoryCache;
  }

  async getSnapshot({ force = false, full = false } = {}) {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.loadSnapshot({ force, full }).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async loadSnapshot({ force = false, full = false } = {}) {
    const cached = await this.readCache();
    const age = cached?.syncedAt ? this.now() - Date.parse(cached.syncedAt) : Infinity;
    if (!force && cached && age <= FRESHNESS_MS.positions) return cached;

    const shouldRefresh = (key, fallbackMs) => {
      if (full || !cached?.sectionSyncedAt?.[key]) return true;
      return this.now() - Date.parse(cached.sectionSyncedAt[key]) >= fallbackMs;
    };

    const sync = cached || {
      syncedAt: null,
      sectionSyncedAt: {},
      summary: null,
      cash: null,
      positions: [],
      pies: [],
      orders: [],
      transactions: []
    };

    const errors = [];
    const tasks = [
      ["summary", shouldRefresh("summary", FRESHNESS_MS.overview), async () => {
        const [summaryPayload, cashPayload] = await Promise.all([
          this.client.accountSummary(),
          this.client.cash()
        ]);
        sync.summary = mapSummary(summaryPayload);
        sync.cash = cashPayload;
      }],
      ["positions", shouldRefresh("positions", FRESHNESS_MS.positions), async () => {
        sync.positions = mapPositions(await this.client.positions());
      }],
      ["pies", shouldRefresh("pies", FRESHNESS_MS.pies), async () => {
        sync.pies = await this.fetchPies();
      }],
      ["orders", shouldRefresh("orders", FRESHNESS_MS.orders) && this.now() >= this.ordersRetryAfter, async () => {
        sync.orders = await this.fetchOrders();
      }],
      ["transactions", shouldRefresh("transactions", FRESHNESS_MS.transactions), async () => {
        sync.transactions = await this.fetchTransactions();
      }]
    ];

    // Trading 212 applies strict per-endpoint limits. Keep requests sequential.
    for (const [section, enabled, task] of tasks) {
      if (!enabled) continue;
      try {
        await task();
        sync.sectionSyncedAt[section] = new Date(this.now()).toISOString();
      } catch (error) {
        const userAction = section === "orders" && error.status === 404
          ? "Trading 212 did not find this order page. Vesper will retry on the next sync."
          : section === "orders" && error.status === 429
            ? "Trading 212 order-history rate limit reached. Cached markers are kept and Vesper retries after the limit resets."
          : null;
        errors.push({
          section,
          message: error.message,
          status: error.status || null,
          retryAfterMs: error.retryAfterMs || null,
          userAction
        });
        if (!error.status || error.status === 401 || error.status === 403) {
          break;
        }
        if (section === "orders" && error.status === 429) {
          this.ordersRetryAfter = this.now() + (error.retryAfterMs || 60_000);
        }
      }
    }

    sync.syncedAt = new Date(this.now()).toISOString();
    sync.status = sync.positions.length > 0
      ? errors.length ? "PARTIAL" : "SYNCED"
      : cached && errors.length ? "CACHED" : "ERROR";
    sync.errors = errors;
    sync.reconciliation = reconcilePositionsAndPies(sync.positions, sync.pies);
    sync.allocation = allocationByPosition(sync.positions, sync.summary?.totalValue || 0);
    sync.tradeReview = buildTradeReview(sync.orders, sync.positions);

    this.memoryCache = sync;
    await writeJson(cachePath(this.env), sync);
    return sync;
  }

  async fetchOrders() {
    const all = [];
    let cursor = null;
    for (let page = 0; page < 5; page += 1) {
      const payload = normalizeOrderPage(await this.client.orders({ limit: 50, cursor }));
      all.push(...payload.items);
      cursor = payload.nextPagePath;
      if (!cursor) break;
    }
    return mapOrders(all).sort((a, b) => dateValue(b.filledAt || b.orderedAt) - dateValue(a.filledAt || a.orderedAt));
  }

  async fetchPies() {
    const summaries = mapPies(await this.client.pies());
    const detailed = [];
    for (const summary of summaries) {
      try {
        const detail = mapPies([{
          ...summary,
          ...(await this.client.pie(summary.id))
        }])[0];
        detailed.push({
          ...summary,
          ...detail,
          name: detail.settings?.name || summary.name,
          cash: summary.cash,
          dividendDetails: summary.dividendDetails
        });
      } catch {
        detailed.push(summary);
      }
    }
    return detailed;
  }

  async fetchTransactions() {
    const all = [];
    let cursor = null;
    for (let page = 0; page < 10; page += 1) {
      const payload = normalizeTransactionPage(await this.client.transactions({ limit: 50, cursor }));
      all.push(...payload.items);
      cursor = payload.nextPagePath;
      if (!cursor) break;
    }
    return mapTransactions(all).sort((a, b) => dateValue(b.date) - dateValue(a.date));
  }
}

export function buildTradeReview(orders, positions) {
  const bySymbol = new Map();
  for (const order of orders) {
    if (!order.symbol) continue;
    const current = bySymbol.get(order.symbol) || {
      symbol: order.symbol,
      totalInvested: 0,
      totalRecovered: 0,
      realizedPnL: 0,
      buyCount: 0,
      sellCount: 0,
      trades: []
    };
    if (order.side === "BUY") {
      current.totalInvested += order.filledValue;
      current.buyCount += 1;
    } else if (order.side === "SELL") {
      current.totalRecovered += order.filledValue;
      current.sellCount += 1;
    }
    current.trades.push({
      id: order.id,
      side: order.side,
      quantity: order.filledQuantity,
      price: order.price,
      value: order.filledValue,
      at: order.filledAt || order.orderedAt
    });
    bySymbol.set(order.symbol, current);
  }

  const positionBySymbol = new Map(positions.map((position) => [position.symbol, position]));
  return [...bySymbol.values()].map((review) => {
    const position = positionBySymbol.get(review.symbol);
    const netInvested = review.totalInvested - review.totalRecovered;
    const unrealizedPnL = position?.unrealizedPnL || 0;
    const closedTrades = Math.min(review.buyCount, review.sellCount);
    const winningTrades = review.trades.filter((trade) => trade.side === "SELL" && trade.value > averageBuyValue(review.trades) * trade.quantity).length;
    return {
      ...review,
      netInvested,
      unrealizedPnL,
      totalPnL: unrealizedPnL + review.realizedPnL,
      tradeCount: review.trades.length,
      winRate: closedTrades ? winningTrades / closedTrades : null,
      buyAndHoldBaseline: position
        ? position.marketValue - position.costBasis
        : null
    };
  }).sort((a, b) => Math.abs(b.totalPnL) - Math.abs(a.totalPnL));
}

function averageBuyValue(trades) {
  const buys = trades.filter((trade) => trade.side === "BUY");
  if (!buys.length) return 0;
  return buys.reduce((sum, trade) => sum + trade.price, 0) / buys.length;
}

function dateValue(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCachedSnapshot(cached) {
  if (!cached || typeof cached !== "object") return cached;
  if (Array.isArray(cached.positions)) {
    cached.positions = cached.positions.map((position) => ({
      ...position,
      symbol: normalizeTicker(position.ticker || position.symbol)
    }));
  }
  if (Array.isArray(cached.orders)) {
    cached.orders = cached.orders.map((order) => ({
      ...order,
      symbol: normalizeTicker(order.ticker || order.symbol)
    }));
  }
  return cached;
}
