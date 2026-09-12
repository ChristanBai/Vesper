import { analyzeBars, movingAverageBacktest } from "./analysis/technical.mjs";
import { buildPortfolioBrief } from "./analysis/portfolio-brief.mjs";
import { buildResearchReport } from "./analysis/report.mjs";
import { NewsService } from "./analysis/news.mjs";
import {
  credentialStatus,
  publicConfig,
  readConfig,
  readCredential
} from "./core/config.mjs";
import { PortfolioSyncService } from "./core/sync-service.mjs";
import { T212Client } from "./core/t212-client.mjs";
import { MarketService } from "./market/market-service.mjs";

export async function createRuntime(env = process.env) {
  const config = await readConfig(env);
  const credentials = await credentialStatus(env);
  const market = new MarketService({ env });
  const news = new NewsService();
  let client = null;
  let sync = null;

  if (credentials.configured) {
    const [apiKey, apiSecret, twelveDataKey] = await Promise.all([
      readCredential("apiKey", env),
      readCredential("apiSecret", env),
      readCredential("twelveDataKey", env)
    ]);
    client = new T212Client({ apiKey, apiSecret, environment: config.environment });
    sync = new PortfolioSyncService({ client, env });
    market.twelveDataKey = twelveDataKey;
  }

  return {
    config,
    credentials,
    market,
    news,
    client,
    sync,

    async status() {
      return {
        plugin: "vesper-codex",
        version: "2.0.0",
        credentials,
        config: publicConfig(config),
        dataSources: {
          trading212: credentials.configured,
          finnhub: Boolean(env.FINNHUB_API_KEY),
          twelveData: Boolean(market.twelveDataKey),
          yahoo: true,
          nasdaq: true,
          tradingView: true,
          longbridge: false
        },
        node: process.version,
        platform: process.platform
      };
    },

    async snapshot(options) {
      return requireSync(sync).getSnapshot(options);
    },

    async quote(symbol) {
      return market.quote(symbol);
    },

    async history(symbol, range, interval = "auto") {
      return market.history(symbol, range, interval);
    },

    async analysis(symbol, range = "1Y") {
      const history = await market.history(symbol, range);
      return {
        symbol,
        range,
        source: history.source,
        ...analyzeBars(history.bars)
      };
    },

    async backtest(symbol, range = "MAX", options = {}) {
      const history = await market.history(symbol, range);
      return movingAverageBacktest(history.bars, options);
    },

    async report(symbol, range = "1Y") {
      const [quote, history, headlines] = await Promise.all([
        market.quote(symbol),
        market.history(symbol, range),
        news.search({ symbol, limit: 5 })
      ]);
      const analysis = analyzeBars(history.bars);
      const backtest = history.bars.length > 51
        ? movingAverageBacktest(history.bars, { fast: 20, slow: 50 })
        : null;
      return buildResearchReport({ symbol, quote, history, analysis, news: headlines, backtest });
    },

    async dailyBrief() {
      const snapshot = await requireSync(sync).getSnapshot();
      return buildPortfolioBrief({ snapshot });
    },

    async orderHistory() {
      const snapshot = await requireSync(sync).getSnapshot();
      return snapshot.orders;
    }
  };
}

export function requireSync(sync) {
  if (!sync) {
    throw new Error("Trading 212 is not configured. Run `npm run setup` from the plugin directory.");
  }
  return sync;
}

export function tradeMarkers(orders, symbol) {
  const normalized = String(symbol || "").toUpperCase();
  return orders
    .filter((order) => !normalized || order.symbol === normalized)
    .map((order) => ({
      time: order.filledAt || order.orderedAt,
      side: order.side,
      price: order.price,
      quantity: order.filledQuantity,
      value: order.filledValue,
      orderId: order.id
    }));
}

export function calculateTradeReview(orders, positions, symbol = null) {
  const normalized = String(symbol || "").toUpperCase();
  const relevant = normalized ? orders.filter((order) => order.symbol === normalized) : orders;
  const buys = relevant.filter((order) => order.side === "BUY");
  const sells = relevant.filter((order) => order.side === "SELL");
  const totalInvested = sum(buys, "filledValue");
  const totalRecovered = sum(sells, "filledValue");
  const realizedPnL = totalRecovered - totalInvested * (sells.reduce((quantity, order) => quantity + order.filledQuantity, 0) / Math.max(buys.reduce((quantity, order) => quantity + order.filledQuantity, 0), 1));
  const position = normalized ? positions.find((item) => item.symbol === normalized) : null;
  return {
    symbol: normalized || null,
    totalInvested,
    totalRecovered,
    netInvested: totalInvested - totalRecovered,
    realizedPnL,
    unrealizedPnL: position?.unrealizedPnL || positions.reduce((total, item) => total + item.unrealizedPnL, 0),
    tradeCount: relevant.length,
    buyCount: buys.length,
    sellCount: sells.length,
    averageBuyPrice: weightedAverage(buys),
    averageSellPrice: weightedAverage(sells),
    markers: tradeMarkers(relevant)
  };
}

function weightedAverage(orders) {
  const quantity = orders.reduce((sum, order) => sum + order.filledQuantity, 0);
  return quantity ? sum(orders, "filledValue") / quantity : null;
}

function sum(orders, field) {
  return orders.reduce((total, order) => total + Number(order[field] || 0), 0);
}
