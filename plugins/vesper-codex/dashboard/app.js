import {
  deriveInsights,
  deriveOverview,
  derivePositionLedger,
  filterPositions,
  groupAllocation,
  performanceSeries,
  sortPositions,
  summarizePerformance
} from "./analytics.js";
import { VesperChart } from "./chart.js";

const state = {
  status: null,
  snapshot: null,
  brief: null,
  positions: [],
  quoteResponse: {},
  overview: {},
  symbol: null,
  selected: null,
  history: null,
  trades: null,
  chartType: "candles",
  range: "1Y",
  interval: "1D",
  tradeFilter: "ALL",
  explorerFilter: "all",
  explorerQuery: "",
  explorerSort: "value",
  allocationDimension: "assetClass",
  performanceRange: "1M",
  historyRequestId: 0,
  tradesRequestId: 0,
  language: localStorage.getItem("vesper-language") === "en" ? "en" : "zh",
  loading: false
};

const translations = {
  zh: {
    "app.eyebrow": "PERSONAL INVESTMENT COCKPIT",
    "app.title": "组合总览",
    "nav.overview": "总览",
    "nav.performance": "表现",
    "nav.allocation": "配置",
    "nav.positions": "持仓",
    "summary.total": "组合总值",
    "summary.today": "今日",
    "summary.invested": "投资市值",
    "summary.cash": "可用现金",
    "summary.unrealized": "未实现盈亏",
    "summary.realized": "已实现盈亏",
    "summary.return": "总收益率",
    "summary.movement": "今日主要变化",
    "chart.interval": "周期",
    "chart.range": "区间",
    "chart.buy": "买入",
    "chart.sell": "卖出",
    "chart.average": "平均成本",
    "explorer.eyebrow": "INSTRUMENT EXPLORER",
    "explorer.title": "我的标的",
    "trades.eyebrow": "TRADE MEMORY",
    "trades.title": "交易历史",
    "insight.eyebrow": "PORTFOLIO INTELLIGENCE",
    "insight.title": "我看到了什么",
    "performance.eyebrow": "PERFORMANCE LEDGER",
    "performance.title": "组合表现",
    "performance.body": "只展示 Vesper 实际保存的组合快照，不把当前持仓倒推成不准确的历史净值。",
    "allocation.eyebrow": "EXPOSURE MAP",
    "allocation.title": "资产配置",
    "allocation.body": "按 Vesper 可验证的数据拆分；缺少行业元数据时明确标记，不做无依据分类。",
    "positions.eyebrow": "POSITION LEDGER",
    "positions.title": "全部持仓",
    "positions.body": "真实持仓、成本、未实现与已实现盈亏按标的合并展示。",
    "settings.title": "数据与连接",
    "settings.connection": "连接状态",
    "settings.sources": "数据源",
    "table.date": "时间",
    "table.side": "方向",
    "table.quantity": "数量",
    "table.price": "成交价",
    "table.currentPrice": "现价",
    "table.value": "金额",
    "table.position": "交易后仓位",
    "table.instrument": "标的",
    "table.average": "平均成本",
    "table.marketValue": "市值",
    "table.unrealized": "未实现",
    "table.realized": "已实现",
    "table.return": "收益率",
    "table.weight": "权重"
  },
  en: {
    "app.eyebrow": "PERSONAL INVESTMENT COCKPIT",
    "app.title": "Portfolio overview",
    "nav.overview": "Overview",
    "nav.performance": "Performance",
    "nav.allocation": "Allocation",
    "nav.positions": "Positions",
    "summary.total": "Total portfolio value",
    "summary.today": "today",
    "summary.invested": "Invested value",
    "summary.cash": "Available cash",
    "summary.unrealized": "Unrealized P&L",
    "summary.realized": "Realized P&L",
    "summary.return": "Total return",
    "summary.movement": "Today’s movement",
    "chart.interval": "Interval",
    "chart.range": "Range",
    "chart.buy": "Buy",
    "chart.sell": "Sell",
    "chart.average": "Average cost",
    "explorer.eyebrow": "INSTRUMENT EXPLORER",
    "explorer.title": "My instruments",
    "trades.eyebrow": "TRADE MEMORY",
    "trades.title": "Trade history",
    "insight.eyebrow": "PORTFOLIO INTELLIGENCE",
    "insight.title": "What I can see",
    "performance.eyebrow": "PERFORMANCE LEDGER",
    "performance.title": "Portfolio performance",
    "performance.body": "Only portfolio snapshots actually persisted by Vesper are shown. Current holdings are never projected backwards as a false historical NAV.",
    "allocation.eyebrow": "EXPOSURE MAP",
    "allocation.title": "Allocation",
    "allocation.body": "Grouped only from verifiable Vesper data. Missing sector metadata stays explicitly unavailable.",
    "positions.eyebrow": "POSITION LEDGER",
    "positions.title": "All positions",
    "positions.body": "Real positions, cost, unrealized and realized P&L consolidated by instrument.",
    "settings.title": "Data and connection",
    "settings.connection": "Connection",
    "settings.sources": "Data sources",
    "table.date": "Time",
    "table.side": "Side",
    "table.quantity": "Quantity",
    "table.price": "Execution price",
    "table.currentPrice": "Current price",
    "table.value": "Value",
    "table.position": "Position after",
    "table.instrument": "Instrument",
    "table.average": "Average cost",
    "table.marketValue": "Market value",
    "table.unrealized": "Unrealized",
    "table.realized": "Realized",
    "table.return": "Return",
    "table.weight": "Weight"
  }
};

const elements = {
  rail: document.querySelector("#rail"),
  menuButton: document.querySelector("#menu-button"),
  pageTitle: document.querySelector("#page-title"),
  settingsButton: document.querySelector("#settings-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  settingsClose: document.querySelector("#settings-close"),
  connectionDot: document.querySelector("#connection-dot"),
  connectionLabel: document.querySelector("#connection-label"),
  syncStrip: document.querySelector("#sync-strip"),
  syncStage: document.querySelector("#sync-stage"),
  freshness: document.querySelector("#freshness"),
  refresh: document.querySelector("#refresh-button"),
  language: document.querySelector("#language-button"),
  globalSearch: document.querySelector("#global-search"),
  globalSearchResults: document.querySelector("#global-search-results"),
  explorerSearch: document.querySelector("#explorer-search"),
  clearExplorerSearch: document.querySelector("#clear-explorer-search"),
  explorerFilters: document.querySelector("#explorer-filters"),
  explorerSort: document.querySelector("#explorer-sort"),
  explorerCount: document.querySelector("#explorer-count"),
  instrumentList: document.querySelector("#instrument-list"),
  summaryTotal: document.querySelector("#summary-total"),
  summaryToday: document.querySelector("#summary-today"),
  summaryTotalBasis: document.querySelector("#summary-total-basis"),
  summaryInvested: document.querySelector("#summary-invested"),
  summaryCash: document.querySelector("#summary-cash"),
  summaryUnrealized: document.querySelector("#summary-unrealized"),
  summaryRealized: document.querySelector("#summary-realized"),
  summaryReturn: document.querySelector("#summary-return"),
  summaryMovement: document.querySelector("#summary-movement"),
  instrumentSymbol: document.querySelector("#instrument-symbol"),
  instrumentName: document.querySelector("#instrument-name"),
  instrumentMarket: document.querySelector("#instrument-market"),
  instrumentPrice: document.querySelector("#instrument-price"),
  instrumentChange: document.querySelector("#instrument-change"),
  instrumentStats: document.querySelector("#instrument-stats"),
  intervalControl: document.querySelector("#interval-control"),
  rangeControl: document.querySelector("#range-control"),
  chartMode: document.querySelector("#chart-mode"),
  chartStage: document.querySelector("#chart-stage"),
  chart: document.querySelector("#market-chart"),
  chartEmpty: document.querySelector("#chart-empty"),
  chartLoading: document.querySelector("#chart-loading"),
  chartSource: document.querySelector("#chart-source"),
  chartReset: document.querySelector("#chart-reset"),
  tradeTitle: document.querySelector("#trade-title"),
  tradeFilter: document.querySelector("#trade-filter"),
  tradeCount: document.querySelector("#trade-count"),
  tradeSummary: document.querySelector("#trade-summary"),
  tradeList: document.querySelector("#trade-list"),
  insightList: document.querySelector("#insight-list"),
  performanceSummary: document.querySelector("#performance-summary"),
  performanceSparkline: document.querySelector("#performance-sparkline"),
  performanceEmpty: document.querySelector("#performance-empty"),
  performanceRange: document.querySelector("#performance-range"),
  allocationDimensions: document.querySelector("#allocation-dimensions"),
  allocationTotal: document.querySelector("#allocation-total"),
  allocationBar: document.querySelector("#allocation-bar"),
  allocationList: document.querySelector("#allocation-list"),
  positionsList: document.querySelector("#positions-list"),
  ledgerStatus: document.querySelector("#ledger-status"),
  settingsStatus: document.querySelector("#settings-status"),
  sourceList: document.querySelector("#source-list"),
  tradeInspector: document.querySelector("#trade-inspector"),
  tradeInspectorClose: document.querySelector("#trade-inspector-close"),
  tradeInspectorSide: document.querySelector("#trade-inspector-side"),
  tradeInspectorTitle: document.querySelector("#trade-inspector-title"),
  tradeInspectorDetails: document.querySelector("#trade-inspector-details"),
  toast: document.querySelector("#toast")
};

const chart = new VesperChart(elements.chart, {
  onMarkerSelect: (marker) => {
    selectTradeMarker(marker.id);
  },
  onMarkerHover: (markerId) => {
    document.querySelectorAll(".trade-row").forEach((row) => {
      row.classList.toggle("hovered", row.dataset.markerId === markerId);
    });
  }
});

document.querySelectorAll(".rail-item").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

elements.menuButton.addEventListener("click", () => elements.rail.classList.toggle("open"));
elements.settingsButton.addEventListener("click", () => elements.settingsDialog.showModal());
elements.settingsClose.addEventListener("click", () => elements.settingsDialog.close());
elements.settingsDialog.addEventListener("click", (event) => {
  if (event.target === elements.settingsDialog) elements.settingsDialog.close();
});
elements.refresh.addEventListener("click", () => refreshAll({ force: true }));
elements.language.addEventListener("click", async () => {
  state.language = state.language === "zh" ? "en" : "zh";
  localStorage.setItem("vesper-language", state.language);
  applyLanguage();
  renderAll();
});
elements.chartReset.addEventListener("click", () => chart.resetView());

elements.intervalControl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-interval]");
  if (!button) return;
  state.interval = button.dataset.interval;
  syncActiveButtons(elements.intervalControl, "interval", state.interval);
  await loadHistory();
});

elements.rangeControl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-range]");
  if (!button) return;
  state.range = button.dataset.range;
  syncActiveButtons(elements.rangeControl, "range", state.range);
  await loadHistory();
});

elements.chartMode.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chart-type]");
  if (!button) return;
  state.chartType = button.dataset.chartType;
  syncActiveButtons(elements.chartMode, "chartType", state.chartType);
  chart.setChartType(state.chartType);
});

elements.explorerFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.explorerFilter = button.dataset.filter;
  syncActiveButtons(elements.explorerFilters, "filter", state.explorerFilter);
  renderExplorer();
});

elements.explorerSearch.addEventListener("input", () => {
  state.explorerQuery = elements.explorerSearch.value;
  renderExplorer();
});
elements.clearExplorerSearch.addEventListener("click", () => {
  elements.explorerSearch.value = "";
  state.explorerQuery = "";
  renderExplorer();
  elements.explorerSearch.focus();
});
elements.explorerSort.addEventListener("change", () => {
  state.explorerSort = elements.explorerSort.value;
  renderExplorer();
});
elements.instrumentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-symbol]");
  if (!button) return;
  selectSymbol(button.dataset.symbol);
  elements.rail.classList.remove("open");
});

elements.tradeFilter.addEventListener("click", (event) => {
  const button = event.target.closest("[data-side]");
  if (!button) return;
  state.tradeFilter = button.dataset.side;
  syncActiveButtons(elements.tradeFilter, "side", state.tradeFilter);
  renderTrades();
});
elements.tradeList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-marker-id]");
  if (row) selectTradeMarker(row.dataset.markerId);
});
elements.tradeList.addEventListener("mouseover", (event) => {
  const row = event.target.closest("[data-marker-id]");
  if (!row) return;
  chart.setHoveredMarker(row.dataset.markerId, false);
});
elements.tradeList.addEventListener("mouseout", (event) => {
  const row = event.target.closest("[data-marker-id]");
  if (!row || row.contains(event.relatedTarget)) return;
  chart.setHoveredMarker(null, false);
});

elements.performanceRange.addEventListener("click", (event) => {
  const button = event.target.closest("[data-range]");
  if (!button) return;
  state.performanceRange = button.dataset.range;
  syncActiveButtons(elements.performanceRange, "range", state.performanceRange);
  renderPerformance();
});

elements.allocationDimensions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-dimension]");
  if (!button) return;
  state.allocationDimension = button.dataset.dimension;
  syncActiveButtons(elements.allocationDimensions, "dimension", state.allocationDimension);
  renderAllocation();
});

elements.positionsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-symbol]");
  if (!button) return;
  showView("overview");
  selectSymbol(button.dataset.symbol);
});

elements.globalSearch.addEventListener("input", renderGlobalSearch);
elements.globalSearch.addEventListener("focus", renderGlobalSearch);
elements.globalSearch.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    elements.globalSearchResults.hidden = true;
    elements.globalSearch.blur();
  }
  if (event.key === "Enter") {
    const first = elements.globalSearchResults.querySelector("[data-symbol]");
    if (first) {
      selectSymbol(first.dataset.symbol);
      elements.globalSearchResults.hidden = true;
      elements.globalSearch.value = "";
    }
  }
});
elements.globalSearchResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-symbol]");
  if (!button) return;
  selectSymbol(button.dataset.symbol);
  elements.globalSearchResults.hidden = true;
  elements.globalSearch.value = "";
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".global-search")) elements.globalSearchResults.hidden = true;
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.globalSearch.focus();
    renderGlobalSearch();
  }
  if (event.key === "Escape") {
    elements.tradeInspector.hidden = true;
    chart.setSelectedMarker(null);
  }
});
elements.tradeInspectorClose.addEventListener("click", () => {
  elements.tradeInspector.hidden = true;
  chart.setSelectedMarker(null);
  document.querySelectorAll(".trade-row.selected").forEach((row) => row.classList.remove("selected"));
});
window.addEventListener("resize", debounce(() => chart.draw(), 100));

applyLanguage();
refreshAll();

async function refreshAll({ force = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  setConnection("syncing");
  setSyncStage("连接 Trading 212", "loading");
  try {
    const status = await request("/api/status", 8_000);
    state.status = status;
    renderStatus();

    setSyncStage("同步持仓与成交", "loading");
    const snapshot = await request(`/api/snapshot${force ? "?refresh=1" : ""}`, 45_000).catch((error) => ({
      status: "ERROR",
      error: error.message,
      summary: {},
      positions: [],
      orders: [],
      tradeReview: [],
      performanceHistory: [],
      errors: [{ section: "account", message: error.message }]
    }));
    state.snapshot = snapshot;
    state.positions = derivePositionLedger(snapshot);
    renderSnapshotBase();

    setSyncStage("计算组合与今日变化", "loading");
    state.quoteResponse = await loadQuotes(state.positions.map((position) => position.symbol));
    state.overview = deriveOverview(snapshot, state.quoteResponse);

    if (!state.symbol || !state.positions.some((position) => position.symbol === state.symbol)) {
      state.symbol = state.positions[0]?.symbol || null;
    }

    renderAll();
    if (state.symbol) await selectSymbol(state.symbol);
    else showChartEmpty("Trading 212 尚未配置或账户没有持仓。");

    const ready = Boolean(status.credentials?.configured) && snapshot.status !== "ERROR";
    setConnection(ready ? "ready" : "error");
    setSyncStage(
      ready ? "组合已同步 · 看板已就绪" : (snapshot.error || "需要完成 Trading 212 连接"),
      ready ? "ready" : "error"
    );
    setFreshness(snapshot.syncedAt, snapshot.status);
  } catch (error) {
    setConnection("error");
    setSyncStage(error.message, "error");
    setFreshness(null, "ERROR");
    showToast(error.message);
  } finally {
    state.loading = false;
  }
}

async function loadQuotes(symbols) {
  const unique = [...new Set(symbols.filter(Boolean))].slice(0, 100);
  if (!unique.length) return { items: {} };
  try {
    return await request(`/api/quotes?symbols=${encodeURIComponent(unique.join(","))}`, 25_000);
  } catch {
    return { items: {}, missing: unique };
  }
}

async function selectSymbol(symbol) {
  if (!symbol) return;
  state.symbol = symbol;
  state.selected = state.positions.find((position) => position.symbol === symbol) || null;
  state.history = null;
  state.trades = null;
  renderExplorer();
  renderInstrument();
  elements.chartLoading.hidden = false;
  elements.chartEmpty.hidden = true;
  await Promise.all([loadHistory(), loadTrades()]);
  elements.chartLoading.hidden = true;
  renderInsights();
}

async function loadHistory() {
  if (!state.symbol) return;
  const symbol = state.symbol;
  const requestId = ++state.historyRequestId;
  try {
    const history = await request(
      `/api/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(state.range)}&interval=${encodeURIComponent(state.interval)}`,
      30_000
    );
    if (requestId !== state.historyRequestId || symbol !== state.symbol) return;
    state.history = history;
    elements.chartSource.textContent = `${state.history.source || "Source unavailable"} · ${formatDateTime(state.history.updatedAt)}`;
    updateChartData();
    if (!state.history.bars?.length) showChartEmpty("当前区间没有行情数据。可切换周期或配置行情数据源。");
  } catch (error) {
    if (requestId !== state.historyRequestId || symbol !== state.symbol) return;
    state.history = { bars: [], markers: [] };
    elements.chartSource.textContent = "Market source unavailable";
    showChartEmpty(friendlyChartError(error));
  }
}

async function loadTrades() {
  if (!state.symbol) return;
  const symbol = state.symbol;
  const requestId = ++state.tradesRequestId;
  try {
    const trades = await request(`/api/trades?symbol=${encodeURIComponent(symbol)}`, 20_000);
    if (requestId !== state.tradesRequestId || symbol !== state.symbol) return;
    state.trades = trades;
  } catch (error) {
    if (requestId !== state.tradesRequestId || symbol !== state.symbol) return;
    state.trades = { symbol, markers: [], tradeCount: 0, error: error.message };
  }
  renderTrades();
  renderInstrument();
  updateChartData();
  renderInsights();
}

function updateChartData() {
  const markers = state.trades?.markers?.length ? state.trades.markers : state.history?.markers || [];
  chart.setData({
    bars: state.history?.bars || [],
    markers,
    costBasis: state.selected?.averagePricePaid ?? null,
    symbol: state.symbol,
    currency: state.history?.currency || state.quoteResponse?.items?.[state.symbol]?.currency || state.selected?.instrumentCurrency,
    preserveView: false
  });
}

function renderAll() {
  renderSnapshotBase();
  renderInstrument();
  renderExplorer();
  renderTrades();
  renderInsights();
  renderPerformance();
  renderAllocation();
  renderPositions();
  renderStatus();
}

function renderSnapshotBase() {
  const summary = state.snapshot?.summary || {};
  const currency = summary.currency || "GBP";
  const totalPnl = number(summary.unrealizedPnL) + number(summary.realizedPnL);
  const totalReturn = number(summary.investedValue) ? totalPnl / number(summary.investedValue) * 100 : null;
  const dailyPnL = state.overview?.dailyPnL;
  const dailyReturn = state.overview?.dailyReturn;

  elements.summaryTotal.textContent = money(summary.totalValue, currency);
  elements.summaryToday.textContent = dailyPnL === null || dailyPnL === undefined
    ? "—"
    : `${signedMoney(dailyPnL, currency)} · ${signedPercent(dailyReturn * 100)}`;
  setValueClass(elements.summaryToday, dailyPnL);
  elements.summaryTotalBasis.textContent = `总收益 ${signedMoney(totalPnl, currency)} · ${signedPercent(totalReturn)}`;
  setValueClass(elements.summaryTotalBasis, totalPnl);

  elements.summaryInvested.textContent = money(summary.investedValue, currency);
  elements.summaryCash.textContent = money(summary.availableCash, currency);
  elements.summaryUnrealized.textContent = signedMoney(summary.unrealizedPnL, currency);
  setValueClass(elements.summaryUnrealized, summary.unrealizedPnL);
  elements.summaryRealized.textContent = signedMoney(summary.realizedPnL, currency);
  setValueClass(elements.summaryRealized, summary.realizedPnL);
  elements.summaryReturn.textContent = signedPercent(totalReturn);
  setValueClass(elements.summaryReturn, totalPnl);

  const movement = state.overview?.largestGain || state.overview?.largestLoss;
  if (movement) {
    elements.summaryMovement.innerHTML = `
      <strong class="${valueClass(movement.dailyPnL)}">${escapeHtml(movement.symbol)} ${signedMoney(movement.dailyPnL, currency)}</strong>
      <span>${signedPercent(movement.changePercent * 100)} 今日变动</span>
    `;
  } else {
    elements.summaryMovement.innerHTML = "<strong>—</strong><span>等待实时报价数据</span>";
  }
  elements.ledgerStatus.textContent = state.snapshot?.reconciliation?.status || state.snapshot?.status || "—";
}

function renderInstrument() {
  const position = state.selected;
  const quote = state.quoteResponse?.items?.[state.symbol] || null;
  const price = quote?.price ?? position?.currentPrice;
  const changePercent = quote?.changePercent ?? null;
  const currency = quote?.currency || position?.instrumentCurrency || position?.accountCurrency || state.snapshot?.summary?.currency || "GBP";
  elements.instrumentSymbol.textContent = state.symbol || "—";
  elements.instrumentName.textContent = position?.name || quote?.name || "选择一项持仓";
  elements.instrumentMarket.textContent = [
    position?.exchange,
    position?.instrumentType || position?.assetClass,
    position?.instrumentCurrency
  ].filter(Boolean).join(" · ") || "Trading 212";
  elements.instrumentPrice.textContent = price === undefined ? "—" : money(price, currency);
  elements.instrumentChange.textContent = changePercent === null ? "—" : signedPercent(changePercent * 100);
  setValueClass(elements.instrumentChange, changePercent);

  const stats = [
    ["持仓数量", formatNumber(position?.quantity, 4)],
    ["持仓市值", money(position?.marketValue, currency)],
    ["平均成本", money(position?.averagePricePaid, currency)],
    ["未实现盈亏", signedMoney(position?.unrealizedPnL, currency), valueClass(position?.unrealizedPnL)],
    ["已实现盈亏", signedMoney(state.trades?.realizedPnL, currency), valueClass(state.trades?.realizedPnL)],
    ["组合权重", formatPercent(position?.weightPercent)],
    ["收益率", signedPercent(number(position?.returnPct) * 100), valueClass(position?.returnPct)],
    ["首次交易", formatDate(state.trades?.firstTradeAt)],
    ["最近交易", formatDate(state.trades?.latestTradeAt)],
    ["买入次数", formatNumber(state.trades?.buyCount, 0)],
    ["卖出次数", formatNumber(state.trades?.sellCount, 0)],
    ["当前仓位", formatNumber(state.trades?.markers?.at(-1)?.positionAfter ?? position?.quantity, 4)]
  ];
  elements.instrumentStats.innerHTML = stats.slice(0, 12).map(([label, value, className = ""]) => `
    <div class="instrument-stat">
      <span>${escapeHtml(label)}</span>
      <strong class="${className}">${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function renderExplorer() {
  const filtered = filterPositions(state.positions, {
    query: state.explorerQuery,
    filter: state.explorerFilter
  });
  const sorted = sortPositions(filtered, state.explorerSort);
  elements.explorerCount.textContent = String(filtered.length);
  elements.instrumentList.innerHTML = sorted.length ? sorted.map((position) => {
    const currency = position.instrumentCurrency || position.accountCurrency || state.snapshot?.summary?.currency || "GBP";
    return `
      <button class="instrument-row ${position.symbol === state.symbol ? "active" : ""}" data-symbol="${escapeHtml(position.symbol)}">
        <div class="instrument-row-main">
          <div class="instrument-row-head"><strong>${escapeHtml(position.symbol)}</strong><span>${escapeHtml(position.name || position.assetClass)}</span></div>
          <div class="instrument-row-sub">
            <span>${formatNumber(position.quantity, 4)} 股</span>
            <span>${money(position.marketValue, currency)}</span>
          </div>
        </div>
        <div class="instrument-row-value">
          <strong>${money(position.currentPrice, currency)}</strong>
          <span class="${valueClass(position.unrealizedPnL)}">${signedPercent(number(position.returnPct) * 100)}</span>
        </div>
      </button>
    `;
  }).join("") : '<div class="empty-row">没有符合条件的持仓</div>';
}

function renderTrades() {
  const currency = state.history?.currency || state.selected?.instrumentCurrency || state.snapshot?.summary?.currency || "GBP";
  const review = state.trades || {};
  const markers = (review.markers || []).slice().reverse();
  const visible = state.tradeFilter === "ALL" ? markers : markers.filter((marker) => marker.side === state.tradeFilter);
  elements.tradeTitle.textContent = state.symbol ? `${state.symbol} · 交易历史` : "交易历史";
  elements.tradeCount.textContent = `${visible.length}`;
  elements.tradeSummary.innerHTML = [
    ["累计买入", money(review.totalInvested, currency)],
    ["累计卖出", money(review.totalRecovered, currency)],
    ["净投入", money(review.netInvested, currency)],
    ["已实现盈亏", signedMoney(review.realizedPnL, currency), valueClass(review.realizedPnL)],
    ["平均买入价", money(review.averageBuyPrice, currency)],
    ["平均卖出价", money(review.averageSellPrice, currency)]
  ].map(([label, value, className = ""]) => `
    <div class="trade-summary-item"><span>${escapeHtml(label)}</span><strong class="${className}">${escapeHtml(value)}</strong></div>
  `).join("");
  elements.tradeList.innerHTML = visible.length ? visible.map((marker) => `
    <tr class="trade-row" data-marker-id="${escapeHtml(marker.id)}">
      <td>${formatDateTime(marker.timestamp || marker.time)}</td>
      <td><span class="side-pill ${escapeHtml(marker.side)}">${marker.side === "BUY" ? "BUY" : "SELL"}</span></td>
      <td>${formatNumber(marker.quantity, 4)}</td>
      <td>${money(marker.executionPrice || marker.price, marker.currency || currency)}</td>
      <td>${money(marker.grossValue || marker.value, marker.currency || currency)}</td>
      <td>${formatNumber(marker.positionAfter, 4)}</td>
    </tr>
  `).join("") : '<tr><td colspan="6" class="empty-row">该股票暂无已成交记录</td></tr>';
}

function renderInsights() {
  const insights = deriveInsights({
    snapshot: state.snapshot,
    selected: state.selected,
    trades: state.trades,
    overview: state.overview
  });
  elements.insightList.innerHTML = insights.length ? insights.map((insight) => `
    <article class="insight-item ${escapeHtml(insight.tone)}">
      <span class="insight-label">${escapeHtml(insight.label)}</span>
      <strong>${escapeHtml(insight.title)}</strong>
      <p>${escapeHtml(insight.body)}</p>
    </article>
  `).join("") : '<div class="empty-row">同步持仓后生成个性洞察</div>';
}

function renderPerformance() {
  const points = performanceSeries(state.snapshot?.performanceHistory || [], state.performanceRange);
  const summary = summarizePerformance(points);
  const currency = summary?.currency || state.snapshot?.summary?.currency || "GBP";
  elements.performanceSummary.innerHTML = [
    ["区间起点", summary ? money(summary.startValue, currency) : "—"],
    ["当前总值", money(state.snapshot?.summary?.totalValue, currency)],
    ["区间变化", summary ? signedMoney(summary.change, currency) : "—", summary ? valueClass(summary.change) : ""],
    ["区间收益率", summary ? signedPercent(number(summary.returnPct) * 100) : "—", summary ? valueClass(summary.returnPct) : ""],
    ["快照数量", String(state.snapshot?.performanceHistory?.length || 0)]
  ].map(([label, value, className = ""]) => `
    <div><span>${escapeHtml(label)}</span><strong class="${className}">${escapeHtml(value)}</strong></div>
  `).join("");

  if (points.length < 2) {
    elements.performanceEmpty.hidden = false;
    elements.performanceSparkline.innerHTML = "";
    return;
  }
  elements.performanceEmpty.hidden = true;
  elements.performanceSparkline.innerHTML = performanceSvg(points);
}

function renderAllocation() {
  const groups = groupAllocation(state.positions, state.allocationDimension);
  const total = state.positions.reduce((sum, position) => sum + number(position.marketValue), 0);
  const currency = state.snapshot?.summary?.currency || "GBP";
  const colors = ["#d9b65b", "#38b26f", "#df6259", "#6ea7c7", "#a888c5", "#b6a07d", "#738c75", "#b6b2a5"];
  elements.allocationTotal.textContent = money(total, currency);
  elements.allocationBar.innerHTML = groups.map((group, index) => `
    <span class="allocation-segment" style="width:${group.weightPercent}%;--segment-color:${colors[index % colors.length]}" title="${escapeHtml(group.label)} ${formatPercent(group.weightPercent)}"></span>
  `).join("");
  elements.allocationList.innerHTML = groups.length ? groups.map((group, index) => `
    <div class="allocation-row" style="--segment-color:${colors[index % colors.length]}">
      <div class="allocation-name"><i></i><strong>${escapeHtml(group.label)}</strong></div>
      <div class="allocation-track"><span style="width:${Math.max(0, Math.min(100, group.weightPercent))}%"></span></div>
      <span>${formatPercent(group.weightPercent)}</span>
      <strong>${money(group.value, currency)}</strong>
    </div>
  `).join("") : '<div class="empty-row">没有可展示的配置数据</div>';
}

function renderPositions() {
  const currency = state.snapshot?.summary?.currency || "GBP";
  elements.positionsList.innerHTML = state.positions.length ? state.positions.map((position) => {
    const rowCurrency = position.instrumentCurrency || position.accountCurrency || currency;
    return `
      <tr>
        <td>
          <div class="symbol-cell">
            <button data-symbol="${escapeHtml(position.symbol)}">${escapeHtml(position.symbol)}</button>
            <div><strong>${escapeHtml(position.name || position.assetClass)}</strong><span>${escapeHtml(position.assetClass)} · ${escapeHtml(position.geography)}</span></div>
          </div>
        </td>
        <td>${formatNumber(position.quantity, 4)}</td>
        <td>${money(position.averagePricePaid, rowCurrency)}</td>
        <td>${money(position.currentPrice, rowCurrency)}</td>
        <td>${money(position.marketValue, currency)}</td>
        <td class="${valueClass(position.unrealizedPnL)}">${signedMoney(position.unrealizedPnL, currency)}</td>
        <td class="${valueClass(position.realizedPnL)}">${signedMoney(position.realizedPnL, currency)}</td>
        <td class="${valueClass(position.returnPct)}">${signedPercent(number(position.returnPct) * 100)}</td>
        <td>${formatPercent(position.weightPercent)}</td>
      </tr>
    `;
  }).join("") : '<tr><td colspan="9" class="empty-row">没有持仓数据</td></tr>';
}

function renderGlobalSearch() {
  const query = elements.globalSearch.value.trim();
  const matches = sortPositions(filterPositions(state.positions, { query }), "value").slice(0, 7);
  elements.globalSearchResults.innerHTML = matches.length ? matches.map((position) => `
    <button class="search-result" data-symbol="${escapeHtml(position.symbol)}">
      <strong>${escapeHtml(position.symbol)}</strong>
      <span>${escapeHtml(position.name || position.assetClass)}</span>
      <span>${formatPercent(position.weightPercent)}</span>
    </button>
  `).join("") : '<div class="empty-row">没有匹配的持仓</div>';
  elements.globalSearchResults.hidden = false;
}

function renderStatus() {
  const status = state.status || {};
  const sources = status.dataSources || {};
  const credentials = status.credentials || {};
  const orderError = state.snapshot?.errors?.find((error) => error.section === "orders");
  elements.settingsStatus.innerHTML = [
    ["API 凭证", credentials.configured ? "已配置" : "未配置"],
    ["凭证来源", credentials.source || "Missing"],
    ["账户环境", status.config?.environment || "live"],
    ["读写权限", "只读"],
    ["订单历史", orderError ? "部分不可用" : "可读取"],
    ["数据位置", "本机"]
  ].map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("");
  elements.sourceList.innerHTML = [
    ["Trading 212", "账户、持仓、Pies 与成交历史", sources.trading212],
    ["TradingView", "主要实时或延迟报价", sources.tradingView],
    ["Yahoo Finance", "历史 K 线与报价兜底", sources.yahoo],
    ["Nasdaq", "美股日线兜底", sources.nasdaq],
    ["Twelve Data", "可选跨市场与分钟级行情", sources.twelveData],
    ["Finnhub", "可选报价源", sources.finnhub]
  ].map(([name, description, enabled]) => `
    <div class="source-item">
      <strong>${escapeHtml(name)} · ${enabled ? "Available" : "Optional / unavailable"}</strong>
      <span>${escapeHtml(description)}</span>
    </div>
  `).join("");
}

function selectTradeMarker(markerId) {
  const marker = state.trades?.markers?.find((item) => item.id === markerId);
  if (!marker) return;
  chart.setSelectedMarker(markerId);
  chart.focusMarker(markerId);
  document.querySelectorAll(".trade-row").forEach((row) => {
    row.classList.toggle("selected", row.dataset.markerId === markerId);
    if (row.dataset.markerId === markerId) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  openTradeInspector(marker);
}

function openTradeInspector(marker) {
  const currency = marker.currency || state.history?.currency || state.selected?.instrumentCurrency || state.snapshot?.summary?.currency || "GBP";
  elements.tradeInspector.hidden = false;
  elements.tradeInspectorSide.textContent = marker.side;
  elements.tradeInspectorSide.className = `inspector-side ${marker.side}`;
  elements.tradeInspectorTitle.textContent = `${state.symbol} · ${formatDateTime(marker.timestamp || marker.time)}`;
  elements.tradeInspectorDetails.innerHTML = [
    ["数量", formatNumber(marker.quantity, 6)],
    ["成交价", money(marker.executionPrice || marker.price, currency)],
    ["成交金额", money(marker.grossValue || marker.value, currency)],
    ["费用", marker.fees === null || marker.fees === undefined ? "数据源未提供" : money(marker.fees, currency)],
    ["交易前仓位", formatNumber(marker.positionBefore, 6)],
    ["交易后仓位", formatNumber(marker.positionAfter, 6)],
    ["订单 ID", marker.orderId || "—"],
    ["成交 ID", marker.tradeId || "—"]
  ].map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("");
}

function showView(view) {
  const allowed = ["overview", "performance", "allocation", "positions"];
  const next = allowed.includes(view) ? view : "overview";
  document.querySelectorAll(".rail-item").forEach((item) => item.classList.toggle("active", item.dataset.view === next));
  document.querySelectorAll(".view").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === next));
  elements.pageTitle.textContent = t(`nav.${next}`);
  if (next === "performance") renderPerformance();
  if (next === "allocation") renderAllocation();
  if (next === "positions") renderPositions();
}

function applyLanguage() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  elements.language.textContent = state.language === "zh" ? "EN" : "中文";
  elements.globalSearch.placeholder = state.language === "zh" ? "搜索持仓，例如 NVDA" : "Search holdings, e.g. NVDA";
  elements.explorerSearch.placeholder = state.language === "zh" ? "搜索代码或名称" : "Search symbol or name";
  const activeNav = document.querySelector(".rail-item.active")?.dataset.view || "overview";
  elements.pageTitle.textContent = t(`nav.${activeNav}`);
}

function setConnection(stateName) {
  elements.connectionDot.className = "connection-dot";
  if (stateName === "ready") elements.connectionDot.classList.add("ready");
  if (stateName === "error") elements.connectionDot.classList.add("error");
  elements.connectionLabel.textContent = stateName === "ready"
    ? (state.language === "zh" ? "已连接" : "Connected")
    : stateName === "error"
      ? (state.language === "zh" ? "需检查" : "Check")
      : (state.language === "zh" ? "同步中" : "Syncing");
}

function setSyncStage(label, stateName) {
  elements.syncStage.textContent = label;
  elements.syncStrip.className = `sync-strip ${stateName || ""}`.trim();
}

function setFreshness(timestamp, status) {
  const label = elements.freshness.querySelector("span");
  elements.freshness.className = "freshness";
  if (!timestamp || status === "ERROR") {
    elements.freshness.classList.add("stale");
    label.textContent = state.language === "zh" ? "未同步" : "Not synced";
    return;
  }
  elements.freshness.classList.add("ready");
  label.textContent = `${state.language === "zh" ? "更新于" : "Updated"} ${formatTime(timestamp)}`;
}

function showChartEmpty(message) {
  elements.chartEmpty.hidden = false;
  const title = elements.chartEmpty.querySelector("strong");
  const body = elements.chartEmpty.querySelector("p");
  if (title) title.textContent = message;
  if (body) body.textContent = "Vesper 会把市场价格、成本线和你的真实成交放在同一时间轴上。";
  chart.setData({ bars: [], markers: [], symbol: state.symbol, currency: null });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 4_500);
}

function syncActiveButtons(container, dataKey, value) {
  const key = dataKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  container.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset[key] === value));
}

function performanceSvg(points) {
  const values = points.map((point) => number(point.totalValue));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, max * 0.005, 0.01);
  const width = 1000;
  const height = 280;
  const padding = 28;
  const x = (index) => padding + index / Math.max(1, points.length - 1) * (width - padding * 2);
  const y = (value) => padding + (max - value) / range * (height - padding * 2);
  const line = points.map((point, index) => `${x(index).toFixed(2)},${y(point.totalValue).toFixed(2)}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  return `
    <defs>
      <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d9b65b" stop-opacity=".22"/>
        <stop offset="100%" stop-color="#d9b65b" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <polygon points="${area}" fill="url(#area-fill)"/>
    <polyline points="${line}" fill="none" stroke="#d9b65b" stroke-width="2.2" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(points.length - 1)}" cy="${y(points.at(-1).totalValue)}" r="4" fill="#d9b65b" stroke="#141513" stroke-width="2"/>
  `;
}

async function request(url, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    const body = await response.json();
    if (!response.ok || body.error) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`请求超时（${timeoutMs}ms）`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function t(key) {
  return translations[state.language]?.[key] || translations.zh[key] || key;
}

function money(value, currency) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    maximumFractionDigits: 2
  }).format(parsed);
}

function signedMoney(value, currency) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return `${parsed > 0 ? "+" : ""}${money(parsed, currency)}`;
}

function signedPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(2)}%`;
}

function formatPercent(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(2)}%` : "—";
}

function formatNumber(value, digits = 2) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("en-GB", { maximumFractionDigits: digits })
    : "—";
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function valueClass(value) {
  return number(value) > 0 ? "positive" : number(value) < 0 ? "negative" : "neutral";
}

function setValueClass(element, value) {
  element.classList.remove("positive", "negative", "neutral");
  element.classList.add(valueClass(value));
}

function friendlyChartError(error) {
  const message = String(error?.message || error || "");
  if (/10m|1m|5m/.test(message)) {
    return state.language === "zh"
      ? "该分钟级行情需要可用数据源；可切换 15m、1h 或日线。"
      : "This intraday interval needs an available provider. Try 15m, 1h or daily.";
  }
  return state.language === "zh"
    ? "行情数据暂时不可用，Vesper 会自动保留并切换数据源。"
    : "Market data is temporarily unavailable. Vesper will switch sources automatically.";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function debounce(callback, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  };
}
