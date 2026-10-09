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
const MAX_HISTORY_PAGES = 200;

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
      transactions: [],
      historyCompleteness: {}
    };

    const errors = [];
    const attemptedAt = new Date(this.now()).toISOString();
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
        const result = await this.fetchOrders();
        sync.orders = result.items;
        sync.historyCompleteness.orders = result.completeness;
      }],
      ["transactions", shouldRefresh("transactions", FRESHNESS_MS.transactions), async () => {
        const result = await this.fetchTransactions();
        sync.transactions = result.items;
        sync.historyCompleteness.transactions = result.completeness;
      }]
    ];

    // Trading 212 applies strict per-endpoint limits. Keep requests sequential.
    for (const [section, enabled, task] of tasks) {
      if (!enabled) continue;
      try {
        await task();
        sync.sectionSyncedAt[section] = attemptedAt;
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
        sync.historyCompleteness ||= {};
        if (["orders", "transactions"].includes(section)) {
          sync.historyCompleteness[section] = {
            status: "FAILED",
            complete: false,
            reason: "FETCH_FAILED",
            pagesFetched: 0,
            itemCount: Array.isArray(sync[section]) ? sync[section].length : 0
          };
        }
        if (error.status === 401 || error.status === 403) {
          break;
        }
        if (section === "orders" && error.status === 429) {
          this.ordersRetryAfter = this.now() + (error.retryAfterMs || 60_000);
        }
      }
    }

    sync.lastAttemptAt = attemptedAt;
    sync.syncedAt = currentAccountCutoff(sync.sectionSyncedAt) || sync.syncedAt || null;
    const incompleteHistory = Object.values(sync.historyCompleteness || {}).some((item) => item?.complete === false);
    sync.status = sync.positions.length > 0
      ? errors.length || incompleteHistory ? "PARTIAL" : "SYNCED"
      : cached && errors.length ? "CACHED" : "ERROR";
    sync.errors = errors;
    sync.reconciliation = reconcilePositionsAndPies(sync.positions, sync.pies);
    sync.allocation = allocationByPosition(sync.positions, sync.summary?.totalValue || 0);
    sync.tradeReview = buildTradeReview(sync.orders, sync.positions);
    sync.performanceHistory = appendPerformancePoint(sync.performanceHistory, sync.summary, sync.syncedAt);

    this.memoryCache = sync;
    await writeJson(cachePath(this.env), sync);
    return sync;
  }

  async fetchOrders() {
    const page = await fetchAllPages({
      fetchPage: (cursor) => this.client.orders({ limit: 50, cursor }),
      normalizePage: normalizeOrderPage,
      maxPages: MAX_HISTORY_PAGES
    });
    const unique = deduplicate(page.items, (item) => String(item?.fill?.id ?? item?.fill?.tradeId ?? item?.id ?? item?.orderId ?? ""));
    return {
      items: mapOrders(unique).sort((a, b) => dateValue(b.filledAt || b.orderedAt) - dateValue(a.filledAt || a.orderedAt)),
      completeness: { ...page.completeness, itemCount: unique.length }
    };
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
    const page = await fetchAllPages({
      fetchPage: (cursor) => this.client.transactions({ limit: 50, cursor }),
      normalizePage: normalizeTransactionPage,
      maxPages: MAX_HISTORY_PAGES
    });
    const unique = deduplicate(page.items, (item) => String(item?.reference ?? item?.id ?? ""));
    return {
      items: mapTransactions(unique).sort((a, b) => dateValue(b.date) - dateValue(a.date)),
      completeness: { ...page.completeness, itemCount: unique.length }
    };
  }
}

export async function fetchAllPages({ fetchPage, normalizePage, maxPages = MAX_HISTORY_PAGES }) {
  const items = [];
  const seenCursors = new Set();
  let cursor = null;
  for (let page = 1; page <= maxPages; page += 1) {
    const payload = normalizePage(await fetchPage(cursor));
    items.push(...payload.items);
    const next = payload.nextPagePath;
    if (!next) {
      return { items, completeness: { status: "COMPLETE", complete: true, reason: null, pagesFetched: page, itemCount: items.length } };
    }
    if (seenCursors.has(next)) {
      return { items, completeness: { status: "PARTIAL", complete: false, reason: "CURSOR_LOOP", pagesFetched: page, itemCount: items.length } };
    }
    seenCursors.add(next);
    cursor = next;
  }
  return { items, completeness: { status: "PARTIAL", complete: false, reason: "SAFETY_PAGE_LIMIT", pagesFetched: maxPages, itemCount: items.length } };
}

function deduplicate(items, identity) {
  const seen = new Set();
  return items.filter((item, index) => {
    const key = identity(item) || `index:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildTradeReview(orders, positions) {
  const bySymbol = new Map();
  const chronological = orders
    .slice()
    .sort((left, right) => dateValue(left.filledAt || left.orderedAt) - dateValue(right.filledAt || right.orderedAt));
  const positionsBySymbol = new Map();

  for (const order of chronological) {
    if (order.isTrade === false) continue;
    if (!order.symbol) continue;
    const current = bySymbol.get(order.symbol) || {
      symbol: order.symbol,
      totalInvested: 0,
      totalRecovered: 0,
      realizedPnL: 0,
      buyCount: 0,
      sellCount: 0,
      totalExplicitCosts: 0,
      trades: []
    };
    const positionBefore = positionsBySymbol.get(order.symbol) || 0;
    const positionAfter = positionBefore + (order.side === "BUY" ? order.filledQuantity : order.side === "SELL" ? -order.filledQuantity : 0);
    positionsBySymbol.set(order.symbol, positionAfter);
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
      fees: order.fees ?? null,
      taxes: order.taxes ?? null,
      fxRate: order.fxRate ?? null,
      netValue: order.netValue ?? null,
      realisedProfitLoss: order.realisedProfitLoss ?? null,
      currency: order.currency || null,
      orderId: order.orderId || order.id || null,
      tradeId: order.tradeId || null,
      positionBefore,
      positionAfter,
      source: order.source || "trading212",
      at: order.filledAt || order.orderedAt
    });
    current.totalExplicitCosts += Number(order.fees || 0) + Number(order.taxes || 0);
    bySymbol.set(order.symbol, current);
  }

  const positionBySymbol = new Map(positions.map((position) => [position.symbol, position]));
  return [...bySymbol.values()].map((review) => {
    const position = positionBySymbol.get(review.symbol);
    const netInvested = review.totalInvested - review.totalRecovered;
    const sells = review.trades.filter((trade) => trade.side === "SELL");
    const brokerRealized = sells.map((trade) => finiteOrNull(trade.realisedProfitLoss));
    const brokerComplete = sells.length > 0 && brokerRealized.every((value) => value !== null);
    review.realizedPnL = brokerComplete ? brokerRealized.reduce((sum, value) => sum + value, 0) : calculateRealizedPnL(review.trades);
    review.realizedPnLSource = brokerComplete ? "TRADING212_WALLET_IMPACT" : "LOCAL_FIFO_ESTIMATE";
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

function calculateRealizedPnL(trades) {
  const lots = [];
  let realized = 0;
  for (const trade of trades) {
    if (trade.side === "BUY") {
      lots.push({
        quantity: trade.quantity,
        price: trade.price,
        feesPerShare: (Number(trade.fees || 0) + Number(trade.taxes || 0)) / Math.max(trade.quantity, 1)
      });
      continue;
    }
    if (trade.side !== "SELL") continue;
    let remaining = trade.quantity;
    let cost = 0;
    while (remaining > 0 && lots.length) {
      const lot = lots[0];
      const matched = Math.min(remaining, lot.quantity);
      cost += matched * (lot.price + lot.feesPerShare);
      lot.quantity -= matched;
      remaining -= matched;
      if (lot.quantity <= 0.00000001) lots.shift();
    }
    if (remaining > 0) cost += remaining * trade.price;
    realized += trade.quantity * trade.price - cost - Number(trade.fees || 0) - Number(trade.taxes || 0);
  }
  return realized;
}

function dateValue(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function finiteOrNull(value) {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed) ? parsed : null;
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
  cached.historyCompleteness ||= {};
  return cached;
}

function appendPerformancePoint(history, summary, timestamp) {
  const points = Array.isArray(history) ? history.slice(-1_999) : [];
  if (!summary || !timestamp) return points;
  const point = {
    at: timestamp,
    totalValue: Number(summary.totalValue || 0),
    investedValue: Number(summary.investedValue || 0),
    availableCash: Number(summary.availableCash || 0),
    unrealizedPnL: Number(summary.unrealizedPnL || 0),
    realizedPnL: Number(summary.realizedPnL || 0),
    currency: summary.currency || "GBP"
  };
  const previous = points.at(-1);
  if (previous && Date.parse(previous.at) === Date.parse(point.at)) {
    points[points.length - 1] = point;
  } else {
    points.push(point);
  }
  return points;
}

function currentAccountCutoff(sectionSyncedAt = {}) {
  const required = [sectionSyncedAt.summary, sectionSyncedAt.positions];
  if (required.some((value) => !Number.isFinite(Date.parse(value || "")))) return null;
  return new Date(Math.min(...required.map((value) => Date.parse(value)))).toISOString();
}
