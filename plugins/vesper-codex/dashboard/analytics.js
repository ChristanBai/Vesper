const EXCHANGE_GEOGRAPHY = {
  LSE: "United Kingdom",
  NASDAQ: "United States",
  NYSE: "United States",
  XETRA: "Germany",
  EURONEXT: "Europe",
  HKEX: "Hong Kong"
};

const SUFFIX_GEOGRAPHY = {
  L: "United Kingdom",
  AS: "Netherlands",
  DE: "Germany",
  PA: "France",
  HK: "Hong Kong"
};

export function deriveOverview(snapshot = {}, quoteResponse = {}) {
  const summary = snapshot.summary || {};
  const positions = Array.isArray(snapshot.positions) ? snapshot.positions : [];
  const quotes = quoteResponse.items || {};
  let coveredValue = 0;
  let dailyPnL = 0;
  const dailyChanges = [];

  for (const position of positions) {
    const quote = quotes[position.symbol];
    const changePercent = Number(quote?.changePercent);
    const marketValue = finite(position.marketValue);
    if (!Number.isFinite(changePercent) || !marketValue || 1 + changePercent === 0) continue;
    const positionDailyPnL = marketValue * changePercent / (1 + changePercent);
    dailyPnL += positionDailyPnL;
    coveredValue += marketValue;
    dailyChanges.push({
      symbol: position.symbol,
      name: position.name,
      quantity: finite(position.quantity),
      changePercent,
      dailyPnL: positionDailyPnL,
      dailyValueChange: positionDailyPnL,
      price: Number(quote.price || position.currentPrice || 0),
      currency: position.accountCurrency || summary.currency
    });
  }

  const totalValue = Number(summary.totalValue || 0);
  const previousTotal = totalValue - dailyPnL;
  dailyChanges.sort((left, right) => right.dailyPnL - left.dailyPnL);
  return {
    dailyPnL: coveredValue > 0 ? dailyPnL : null,
    dailyReturn: coveredValue > 0 && previousTotal ? dailyPnL / previousTotal : null,
    dailyCoverage: positions.length ? Object.keys(quotes).length / positions.length : 0,
    largestGain: dailyChanges[0] || null,
    largestLoss: dailyChanges.at(-1) || null,
    quotes
  };
}

export function derivePositionLedger(snapshot = {}) {
  const summary = snapshot.summary || {};
  const totalValue = finite(summary.totalValue);
  const reviews = new Map((snapshot.tradeReview || []).map((review) => [review.symbol, review]));
  return (snapshot.positions || [])
    .map((position) => {
      const review = reviews.get(position.symbol) || {};
      const marketValue = finite(position.marketValue);
      const costBasis = finite(position.costBasis);
      const unrealizedPnL = finite(position.unrealizedPnL);
      return {
        ...position,
        marketValue,
        costBasis,
        unrealizedPnL,
        realizedPnL: finite(review.realizedPnL),
        returnPct: costBasis ? unrealizedPnL / costBasis : finite(position.unrealizedPnLPercent),
        totalReturn: costBasis ? (unrealizedPnL + finite(review.realizedPnL)) / costBasis : 0,
        weightPercent: totalValue ? marketValue / totalValue * 100 : 0,
        assetClass: assetClassOf(position),
        geography: geographyOf(position),
        currency: currencyOf(position),
        account: position.accountId || "Trading 212",
        sector: position.sector || null
      };
    })
    .sort((left, right) => right.marketValue - left.marketValue);
}

export function filterPositions(positions, { query = "", filter = "all" } = {}) {
  const normalizedQuery = String(query).trim().toLocaleUpperCase();
  let filtered = positions.filter((position) => {
    if (!normalizedQuery) return true;
    return `${position.symbol} ${position.name || ""}`.toLocaleUpperCase().includes(normalizedQuery);
  });

  if (filter === "stocks") filtered = filtered.filter((position) => position.assetClass === "Stock");
  if (filter === "etf") filtered = filtered.filter((position) => position.assetClass === "ETF");
  if (filter === "winners") filtered = filtered.filter((position) => position.unrealizedPnL > 0);
  if (filter === "losers") filtered = filtered.filter((position) => position.unrealizedPnL < 0);
  if (filter === "largest") filtered = filtered.slice().sort((left, right) => right.marketValue - left.marketValue).slice(0, 10);
  return filtered;
}

export function sortPositions(positions, sort) {
  const sorted = positions.slice();
  if (sort === "return") sorted.sort((left, right) => right.returnPct - left.returnPct);
  else if (sort === "pnl") sorted.sort((left, right) => right.unrealizedPnL - left.unrealizedPnL);
  else if (sort === "symbol") sorted.sort((left, right) => left.symbol.localeCompare(right.symbol));
  else sorted.sort((left, right) => right.marketValue - left.marketValue);
  return sorted;
}

export function groupAllocation(positions, dimension) {
  const groups = new Map();
  const total = positions.reduce((sum, position) => sum + finite(position.marketValue), 0);
  for (const position of positions) {
    const label = allocationValue(position, dimension);
    const current = groups.get(label) || { label, value: 0, positions: [] };
    current.value += finite(position.marketValue);
    current.positions.push(position.symbol);
    groups.set(label, current);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      weightPercent: total ? group.value / total * 100 : 0
    }))
    .sort((left, right) => right.value - left.value);
}

export function deriveInsights({ snapshot, selected, trades, overview }) {
  const positions = derivePositionLedger(snapshot);
  const summary = snapshot?.summary || {};
  const currency = summary.currency || "GBP";
  const insights = [];

  if (overview?.largestGain?.dailyPnL > 0) {
    insights.push({
      tone: "positive",
      label: "TODAY",
      title: `${overview.largestGain.symbol} 是今日最大贡献`,
      body: `贡献 ${formatMoney(overview.largestGain.dailyPnL, currency)}，日变动 ${formatPercent(overview.largestGain.changePercent * 100)}。`
    });
  }

  if (overview?.largestLoss?.dailyPnL < 0) {
    insights.push({
      tone: "negative",
      label: "TODAY",
      title: `${overview.largestLoss.symbol} 是今日最大拖累`,
      body: `拖累 ${formatMoney(overview.largestLoss.dailyPnL, currency)}，日变动 ${formatPercent(overview.largestLoss.changePercent * 100)}。`
    });
  }

  const width = positions.reduce((sum, position) => sum + position.weightPercent, 0);
  const topFive = positions.slice(0, 5).reduce((sum, position) => sum + position.weightPercent, 0);
  if (positions.length > 5) {
    insights.push({
      tone: topFive > 75 ? "warning" : "neutral",
      label: "CONCENTRATION",
      title: `前五大持仓占 ${formatPercent(topFive)}`,
      body: `目前共 ${positions.length} 个持仓，投资仓位权重合计 ${formatPercent(width)}；其余为现金或未定价资产。`
    });
  }

  if (selected) {
    const difference = finite(selected.currentPrice) - finite(selected.averagePricePaid);
    const differencePercent = finite(selected.averagePricePaid)
      ? difference / finite(selected.averagePricePaid) * 100
      : 0;
    const instrumentCurrency = selected.instrumentCurrency || currency;
    insights.push({
      tone: difference >= 0 ? "positive" : "negative",
      label: selected.symbol,
      title: `现价相对平均成本 ${difference >= 0 ? "高" : "低"} ${formatPercent(Math.abs(differencePercent))}`,
      body: `平均成本 ${formatMoney(selected.averagePricePaid, instrumentCurrency)}，现价 ${formatMoney(selected.currentPrice, instrumentCurrency)}。`
    });
  }

  const markers = trades?.markers || [];
  if (markers.length) {
    const buys = markers.filter((marker) => marker.side === "BUY").length;
    const sells = markers.filter((marker) => marker.side === "SELL").length;
    insights.push({
      tone: "neutral",
      label: "BEHAVIOUR",
      title: `${selected?.symbol || "该标的"} 共有 ${buys} 次买入、${sells} 次卖出`,
      body: markers.length > 1
        ? `成交时间从 ${formatDate(markers[0].timestamp)} 到 ${formatDate(markers.at(-1).timestamp)}，成本和仓位变化已标在图表上。`
        : "目前只有一笔成交，尚不足以判断持续交易行为。"
    });
  }

  const realized = finite(summary.realizedPnL);
  const unrealized = finite(summary.unrealizedPnL);
  insights.push({
    tone: realized + unrealized >= 0 ? "positive" : "negative",
    label: "P&L",
    title: `已实现与未实现盈亏合计 ${formatMoney(realized + unrealized, currency)}`,
    body: `已实现 ${formatMoney(realized, currency)}，未实现 ${formatMoney(unrealized, currency)}。`
  });

  return insights.slice(0, 6);
}

export function performanceSeries(points = [], range = "1M") {
  const valid = points
    .map((point) => ({ ...point, timestamp: Date.parse(point.at) }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(Number(point.totalValue)))
    .sort((left, right) => left.timestamp - right.timestamp);
  if (!valid.length) return [];
  if (range === "MAX") return valid;

  const end = valid.at(-1).timestamp;
  const start = rangeStart(end, range);
  const filtered = valid.filter((point) => point.timestamp >= start);
  return filtered.length >= 2 ? filtered : valid.length >= 2 && range !== "1D" ? valid : filtered;
}

export function summarizePerformance(points = []) {
  if (!points.length) return null;
  const first = points[0];
  const last = points.at(-1);
  const change = finite(last.totalValue) - finite(first.totalValue);
  return {
    startValue: finite(first.totalValue),
    endValue: finite(last.totalValue),
    change,
    returnPct: finite(first.totalValue) ? change / finite(first.totalValue) : null,
    startAt: first.at,
    endAt: last.at,
    currency: last.currency || first.currency || "GBP"
  };
}

function allocationValue(position, dimension) {
  if (dimension === "assetClass") return position.assetClass || "Unclassified";
  if (dimension === "geography") return position.geography || "Unavailable";
  if (dimension === "currency") return position.currency || "Unavailable";
  if (dimension === "account") return position.account || "Trading 212";
  if (dimension === "sector") return position.sector || "Metadata unavailable";
  return "Unclassified";
}

function assetClassOf(position) {
  const type = String(position.instrumentType || "").toLowerCase();
  if (type.includes("etf") || type.includes("fund")) return "ETF";
  if (type.includes("crypto")) return "Crypto";
  if (type) return "Stock";
  const name = String(position.name || "").toLowerCase();
  if (/\b(etf|ucits|fund|trust)\b/.test(name)) return "ETF";
  if (/(bitcoin|ethereum|crypto)/.test(name)) return "Crypto";
  return "Stock";
}

function geographyOf(position) {
  const exchange = String(position.exchange || "").toUpperCase();
  if (EXCHANGE_GEOGRAPHY[exchange]) return EXCHANGE_GEOGRAPHY[exchange];
  const suffix = String(position.symbol || "").split(".")[1];
  if (suffix && SUFFIX_GEOGRAPHY[suffix]) return SUFFIX_GEOGRAPHY[suffix];
  if (!suffix) return "United States";
  return "Unavailable";
}

function currencyOf(position) {
  return position.instrumentCurrency || position.accountCurrency || "Unavailable";
}

function rangeStart(end, range) {
  const date = new Date(end);
  if (range === "1D") date.setDate(date.getDate() - 1);
  else if (range === "1W") date.setDate(date.getDate() - 7);
  else if (range === "1M") date.setMonth(date.getMonth() - 1);
  else if (range === "3M") date.setMonth(date.getMonth() - 3);
  else if (range === "1Y") date.setFullYear(date.getFullYear() - 1);
  else if (range === "YTD") return new Date(date.getFullYear(), 0, 1).getTime();
  else date.setFullYear(date.getFullYear() - 10);
  return date.getTime();
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    maximumFractionDigits: 2
  }).format(finite(value));
}

function formatPercent(value) {
  return `${finite(value).toFixed(2)}%`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}
