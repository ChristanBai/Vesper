import { normalizeTicker } from "../core/portfolio.mjs";

const RANGE_CONFIG = {
  "1D": { range: "1d", interval: "5m" },
  "1W": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  MAX: { range: "max", interval: "1wk" }
};

const HISTORY_FALLBACK_DAYS = {
  "1D": 5,
  "1W": 10,
  "1M": 40,
  "6M": 220,
  "1Y": 400,
  MAX: 3650
};

const INTERVAL_CONFIG = {
  "10m": { yahooRange: null, yahooInterval: null, twelveInterval: "10min", label: "10m" },
  "15m": { yahooRange: "5d", yahooInterval: "15m", twelveInterval: "15min", label: "15m" },
  "30m": { yahooRange: "1mo", yahooInterval: "30m", twelveInterval: "30min", label: "30m" },
  "1h": { yahooRange: "6mo", yahooInterval: "60m", twelveInterval: "1h", label: "1h" },
  "1D": { yahooRange: "1y", yahooInterval: "1d", twelveInterval: "1day", label: "1D" },
  "1W": { yahooRange: "5y", yahooInterval: "1wk", twelveInterval: "1week", label: "1W" }
};

export class MarketService {
  constructor({ fetchImpl = fetch, env = process.env, twelveDataKey = env.TWELVE_DATA_API_KEY || null } = {}) {
    this.fetchImpl = fetchImpl;
    this.env = env;
    this.twelveDataKey = twelveDataKey;
    this.timeoutMs = 20_000;
    this.historyTimeoutMs = 8_000;
  }

  async quote(inputSymbol) {
    const symbol = normalizeTicker(inputSymbol);
    const errors = [];
    if (this.env.FINNHUB_API_KEY) {
      try {
        return await this.finnhubQuote(symbol);
      } catch (error) {
        errors.push(error.message);
      }
    }
    try {
      return await this.tradingViewQuote(symbol);
    } catch (error) {
      errors.push(error.message);
    }
    try {
      return await this.yahooQuote(symbol);
    } catch (error) {
      errors.push(error.message);
    }
    throw new Error(`No quote source available for ${symbol}. ${errors.join(" | ")}`);
  }

  async history(inputSymbol, requestedRange = "1Y", requestedInterval = "auto") {
    const symbol = normalizeTicker(inputSymbol);
    const normalizedRange = String(requestedRange).toUpperCase();
    const normalizedInterval = requestedInterval === "auto" ? "auto" : String(requestedInterval);
    const errors = [];
    if (this.twelveDataKey && normalizedInterval !== "auto") {
      try {
        return await this.twelveDataHistory(symbol, normalizedRange, normalizedInterval);
      } catch (error) {
        errors.push(error.message);
      }
    }
    try {
      return await this.yahooHistory(symbol, normalizedRange, normalizedInterval);
    } catch (error) {
      errors.push(error.message);
    }
    if (normalizedInterval === "auto" || normalizedInterval === "1D") {
      try {
        return await this.nasdaqHistory(symbol, normalizedRange, normalizedInterval);
      } catch (error) {
        errors.push(error.message);
      }
    }
    if (this.twelveDataKey) {
      try {
        return await this.twelveDataHistory(symbol, normalizedRange, normalizedInterval);
      } catch (error) {
        errors.push(error.message);
      }
    }
    throw new Error(`Market history is unavailable for ${symbol}. ${errors.join(" | ")}`);
  }

  async yahooHistory(symbol, requestedRange, requestedInterval = "auto") {
    const intervalConfig = INTERVAL_CONFIG[requestedInterval];
    if (requestedInterval !== "auto" && !intervalConfig?.yahooInterval) {
      throw new Error(`Yahoo does not support ${requestedInterval} intervals`);
    }
    const range = intervalConfig
      ? { range: intervalConfig.yahooRange, interval: intervalConfig.yahooInterval }
      : RANGE_CONFIG[String(requestedRange).toUpperCase()] || RANGE_CONFIG["1Y"];
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
    url.searchParams.set("range", range.range);
    url.searchParams.set("interval", range.interval);
    const response = await this.fetchImpl(url, {
      headers: { "User-Agent": "Vesper-Codex/0.1" },
      signal: AbortSignal.timeout(this.historyTimeoutMs)
    });
    if (!response.ok) throw new Error(`Yahoo chart returned HTTP ${response.status}`);
    const payload = await response.json();
    return normalizeYahooHistory(payload, {
      source: "Yahoo Finance",
      range: String(requestedRange).toUpperCase(),
      interval: requestedInterval === "auto" ? range.interval : requestedInterval,
      delayedByMinutes: marketDelayMinutes(symbol),
      updatedAt: new Date().toISOString()
    });
  }

  async nasdaqHistory(symbol, requestedRange, requestedInterval = "auto") {
    if (!isUsSymbol(symbol)) throw new Error("Nasdaq history fallback is only available for US symbols");
    const base = symbol.split(".")[0];
    const to = new Date();
    const from = new Date(to.getTime() - HISTORY_FALLBACK_DAYS[requestedRange] * 24 * 60 * 60 * 1_000);
    const url = new URL(`https://api.nasdaq.com/api/quote/${encodeURIComponent(base)}/chart`);
    url.searchParams.set("assetclass", "stocks");
    url.searchParams.set("fromdate", isoDate(from));
    url.searchParams.set("todate", isoDate(to));
    const response = await this.fetchImpl(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json,text/plain,*/*"
      },
      signal: AbortSignal.timeout(this.historyTimeoutMs)
    });
    if (!response.ok) throw new Error(`Nasdaq chart returned HTTP ${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload?.data?.chart) ? payload.data.chart : [];
    const bars = rows
      .map((row) => ({
        time: new Date(Number(row?.x)).toISOString(),
        open: nullableNumber(row?.z?.open),
        high: nullableNumber(row?.z?.high),
        low: nullableNumber(row?.z?.low),
        close: nullableNumber(row?.z?.close ?? row?.y),
        volume: nullableNumber(String(row?.z?.volume || "").replace(/,/g, ""))
      }))
      .filter((bar) => bar.close !== null);
    if (bars.length < 2) throw new Error("Nasdaq chart response is empty");
    return {
      symbol,
      currency: inferCurrency(symbol),
      exchange: "NASDAQ",
      bars,
      source: "Nasdaq",
      range: requestedRange,
      interval: requestedInterval === "auto" ? "1D" : requestedInterval,
      delayedByMinutes: 15,
      updatedAt: new Date().toISOString()
    };
  }

  async twelveDataHistory(symbol, requestedRange, requestedInterval = "auto") {
    const intervalConfig = INTERVAL_CONFIG[requestedInterval];
    const interval = intervalConfig?.twelveInterval || (requestedRange === "1D" ? "15min" : requestedRange === "1W" ? "1h" : "1day");
    const outputsize = requestedInterval === "10m" ? 120 : requestedInterval === "15m" ? 160 : requestedInterval === "30m" ? 200 : 500;
    const url = new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol", twelveDataSymbol(symbol));
    url.searchParams.set("interval", interval);
    url.searchParams.set("outputsize", String(outputsize));
    url.searchParams.set("apikey", this.twelveDataKey);
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.historyTimeoutMs) });
    if (!response.ok) throw new Error(`Twelve Data returned HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.status === "error") throw new Error(payload.message || "Twelve Data request failed");
    const rows = Array.isArray(payload?.values) ? payload.values : [];
    const bars = rows
      .map((row) => ({
        time: new Date(row.datetime.replace(" ", "T") + "Z").toISOString(),
        open: nullableNumber(row.open),
        high: nullableNumber(row.high),
        low: nullableNumber(row.low),
        close: nullableNumber(row.close),
        volume: nullableNumber(row.volume)
      }))
      .filter((bar) => bar.close !== null)
      .reverse();
    if (bars.length < 2) throw new Error("Twelve Data response is empty");
    return {
      symbol,
      currency: payload?.meta?.currency || inferCurrency(symbol),
      exchange: payload?.meta?.exchange || null,
      bars,
      source: "Twelve Data",
      range: requestedRange,
      interval: requestedInterval === "auto" ? interval : requestedInterval,
      delayedByMinutes: marketDelayMinutes(symbol),
      updatedAt: new Date().toISOString()
    };
  }

  async tradingViewQuote(symbol) {
    const candidates = tradingViewSymbols(symbol);
    let lastError = null;
    for (const candidate of candidates) {
      try {
        const response = await this.fetchImpl("https://scanner.tradingview.com/global/scan", {
          method: "POST",
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: { "Content-Type": "application/json", "User-Agent": "Vesper-Codex/0.1" },
          body: JSON.stringify({
            symbols: { tickers: [candidate], query: { types: [] } },
            columns: ["name", "close", "change", "volume", "update_mode", "currency"]
          })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const values = payload?.data?.[0]?.d;
        if (!Array.isArray(values) || !Number.isFinite(Number(values[1]))) {
          throw new Error("missing price");
        }
        const mode = String(values[4] || "");
        return {
          symbol,
          name: values[0] || symbol,
          price: Number(values[1]),
          changePercent: Number(values[2] || 0) / 100,
          volume: Number(values[3] || 0),
          currency: values[5] || inferCurrency(symbol),
          source: "TradingView",
          updatedAt: new Date().toISOString(),
          delayedByMinutes: mode.includes("900") ? 15 : mode.includes("streaming") ? 0 : null,
          streaming: mode.includes("streaming")
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("TradingView quote unavailable");
  }

  async yahooQuote(symbol) {
    const response = await this.fetchImpl(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`,
      { headers: { "User-Agent": "Vesper-Codex/0.1" }, signal: AbortSignal.timeout(this.timeoutMs) }
    );
    if (!response.ok) throw new Error(`Yahoo returned HTTP ${response.status}`);
    const payload = await response.json();
    const meta = payload?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    const previousClose = Number(meta?.chartPreviousClose ?? meta?.previousClose);
    if (!Number.isFinite(price)) throw new Error("Yahoo response is missing a price");
    return {
      symbol,
      name: meta?.longName || meta?.shortName || symbol,
      price,
      changePercent: previousClose ? (price - previousClose) / previousClose : 0,
      currency: meta?.currency || inferCurrency(symbol),
      source: "Yahoo Finance",
      updatedAt: new Date().toISOString(),
      delayedByMinutes: marketDelayMinutes(symbol),
      streaming: false
    };
  }

  async finnhubQuote(symbol) {
    const token = this.env.FINNHUB_API_KEY;
    const response = await this.fetchImpl(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(this.timeoutMs) }
    );
    if (!response.ok) throw new Error(`Finnhub returned HTTP ${response.status}`);
    const payload = await response.json();
    if (!Number.isFinite(Number(payload.c)) || Number(payload.c) <= 0) {
      throw new Error("Finnhub response is missing a price");
    }
    return {
      symbol,
      name: symbol,
      price: Number(payload.c),
      changePercent: Number(payload.dp || 0) / 100,
      currency: inferCurrency(symbol),
      source: "Finnhub",
      updatedAt: new Date(payload.t ? payload.t * 1000 : Date.now()).toISOString(),
      delayedByMinutes: marketDelayMinutes(symbol),
      streaming: false
    };
  }
}

export function normalizeYahooHistory(payload, sourceMetadata = {}) {
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp || [];
  if (!result || !quote || timestamps.length < 2) throw new Error("Market history is unavailable.");

  const bars = timestamps.map((timestamp, index) => ({
    time: new Date(timestamp * 1000).toISOString(),
    open: nullableNumber(quote.open?.[index]),
    high: nullableNumber(quote.high?.[index]),
    low: nullableNumber(quote.low?.[index]),
    close: nullableNumber(quote.close?.[index]),
    volume: nullableNumber(quote.volume?.[index])
  })).filter((bar) => bar.close !== null);

  return {
    symbol: result.meta?.symbol || null,
    currency: result.meta?.currency || null,
    exchange: result.meta?.exchangeName || null,
    bars,
    ...sourceMetadata
  };
}

export function tradingViewSymbols(input) {
  const symbol = normalizeTicker(input);
  const base = symbol.split(".")[0];
  if (symbol.endsWith(".L")) return [`LSE:${base}`];
  if (symbol.endsWith(".AS")) return [`EURONEXT:${base}`];
  if (symbol.endsWith(".DE")) return [`XETRA:${base}`];
  if (symbol.endsWith(".PA")) return [`EURONEXT:${base}`];
  if (symbol.endsWith(".HK")) return [`HKEX:${base}`];
  return [`NASDAQ:${base}`, `NYSE:${base}`];
}

export function marketDelayMinutes(symbol) {
  const upper = normalizeTicker(symbol);
  if (upper.endsWith(".L")) return 0;
  if (/\.(AS|DE|PA)$/.test(upper)) return 15;
  return 15;
}

function inferCurrency(symbol) {
  const upper = normalizeTicker(symbol);
  if (upper.endsWith(".L")) return "GBP";
  if (/\.(AS|DE|PA)$/.test(upper)) return "EUR";
  if (upper.endsWith(".HK")) return "HKD";
  return "USD";
}

function isUsSymbol(symbol) {
  return !/\.(L|AS|DE|PA|HK)$/.test(normalizeTicker(symbol));
}

function twelveDataSymbol(symbol) {
  const upper = normalizeTicker(symbol);
  const base = upper.split(".")[0];
  if (upper.endsWith(".L")) return `${base}:LSE`;
  if (upper.endsWith(".AS")) return `${base}:AMS`;
  if (upper.endsWith(".DE")) return `${base}:XETRA`;
  if (upper.endsWith(".PA")) return `${base}:EURONEXT`;
  if (upper.endsWith(".HK")) return `${base}:HKEX`;
  return base;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
