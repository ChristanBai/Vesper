const state = {
  status: null,
  snapshot: null,
  brief: null,
  symbol: null,
  range: "1Y",
  interval: "auto",
  windowStart: 60,
  windowEnd: 100,
  historyKey: null,
  chartType: "line",
  history: null,
  quote: null,
  trades: null,
  chartRequestId: 0,
  quoteRequestId: 0,
  tradesRequestId: 0,
  language: localStorage.getItem("vesper-language") === "en" ? "en" : "zh"
};

const translations = {
  zh: {
    "nav.dashboard": "看板",
    "nav.sources": "数据源",
    "nav.ai": "AI 引擎",
    "nav.settings": "设置",
    "common.refresh": "刷新",
    "status.syncing": "同步中",
    "status.connected": "已连接",
    "status.setup": "需要配置",
    "status.error": "错误",
    "brief.eyebrow": "每日简报",
    "brief.title": "组合审查",
    "brief.contribution": "收益贡献",
    "brief.risk": "风险审查",
    "brief.quality": "数据质量",
    "metric.total": "账户总值",
    "metric.unrealized": "未实现盈亏",
    "metric.cash": "可用现金",
    "metric.sync": "同步状态",
    "chart.eyebrow": "行情图",
    "chart.line": "折线",
    "chart.candles": "K 线",
    "chart.buy": "买入标记",
    "chart.sell": "卖出标记",
    "positions.eyebrow": "持仓",
    "positions.title": "组合",
    "table.symbol": "股票",
    "table.quantity": "数量",
    "table.average": "平均成本",
    "table.price": "现价",
    "table.value": "市值",
    "table.pnl": "盈亏",
    "table.return": "收益率",
    "table.latest": "最近买卖",
    "trade.eyebrow": "交易复盘",
    "sources.marketEyebrow": "行情数据",
    "sources.hierarchy": "数据源层级",
    "sources.description": "每个报价都标注来源、更新时间和延迟。Trading 212 只用于账户与成交数据。",
    "sources.accountEyebrow": "Trading 212",
    "sources.accountTitle": "账户同步",
    "sources.setupEyebrow": "对接说明",
    "sources.permissionsTitle": "只需要开放只读权限",
    "sources.permissionsBody": "在 Trading 212 中打开 Settings → API (Beta) → Permissions，开放账户、持仓、Pies 读取和 History/Orders 读取。不要开放 Orders - Execute 或 Pies - Write。",
    "ai.eyebrow": "研究引擎",
    "ai.title": "AI 分析",
    "ai.description": "技术分析、组合审查、回测和报告都通过 MCP 完成。Vesper 严格只读，不能下单或撤单。",
    "settings.eyebrow": "安全",
    "settings.title": "本地优先配置",
    "settings.startTitle": "一键启动 Vesper",
    "settings.startBody": "在 Codex 中只需要发送“启动 Vesper”。它会一次性检查 API、刷新真实持仓和订单历史、生成每日简报并打开这个看板。API Key 只需第一次保存到 macOS Keychain，之后的运行会自动复用。"
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.sources": "Data sources",
    "nav.ai": "AI engines",
    "nav.settings": "Settings",
    "common.refresh": "Refresh",
    "status.syncing": "Syncing",
    "status.connected": "Connected",
    "status.setup": "Setup required",
    "status.error": "Error",
    "brief.eyebrow": "Daily brief",
    "brief.title": "Portfolio review",
    "brief.contribution": "Contribution",
    "brief.risk": "Risk review",
    "brief.quality": "Data quality",
    "metric.total": "Total value",
    "metric.unrealized": "Unrealized P/L",
    "metric.cash": "Available cash",
    "metric.sync": "Sync",
    "chart.eyebrow": "Market chart",
    "chart.line": "Line",
    "chart.candles": "Candles",
    "chart.buy": "Buy marker",
    "chart.sell": "Sell marker",
    "positions.eyebrow": "Positions",
    "positions.title": "Portfolio",
    "table.symbol": "Symbol",
    "table.quantity": "Quantity",
    "table.average": "Average",
    "table.price": "Price",
    "table.value": "Value",
    "table.pnl": "P/L",
    "table.return": "Return",
    "table.latest": "Latest trade",
    "trade.eyebrow": "Trade review",
    "sources.marketEyebrow": "Market data",
    "sources.hierarchy": "Source hierarchy",
    "sources.description": "Every quote is labeled with provider, update time and delay. Trading 212 is used only for account and execution data.",
    "sources.accountEyebrow": "Trading 212",
    "sources.accountTitle": "Account synchronization",
    "sources.setupEyebrow": "Setup guide",
    "sources.permissionsTitle": "Required read-only permissions",
    "sources.permissionsBody": "Open Trading 212 Settings → API (Beta) → Permissions. Enable account, portfolio, Pies read and History/Orders read. Leave Orders - Execute and Pies - Write disabled.",
    "ai.eyebrow": "Research stack",
    "ai.title": "AI engines",
    "ai.description": "Technical analysis, portfolio review, backtesting and report generation run through MCP tools. Vesper is strictly read-only.",
    "settings.eyebrow": "Security",
    "settings.title": "Local-first configuration",
    "settings.startTitle": "Start Vesper",
    "settings.startBody": "Send “Start Vesper” in Codex. One command checks the API, refreshes holdings and order history, generates the daily brief and opens this dashboard. The API key is stored once in macOS Keychain and reused automatically."
  }
};

function t(key) {
  return translations[state.language]?.[key] || translations.en[key] || key;
}

const elements = {
  sidebar: document.querySelector("#sidebar"),
  sidebarToggle: document.querySelector("#sidebar-toggle"),
  pageTitle: document.querySelector("#page-title"),
  sourceBadge: document.querySelector("#source-badge"),
  refresh: document.querySelector("#refresh-button"),
  languageToggle: document.querySelector("#language-toggle"),
  total: document.querySelector("#metric-total"),
  totalNote: document.querySelector("#metric-total-note"),
  unrealized: document.querySelector("#metric-unrealized"),
  unrealizedNote: document.querySelector("#metric-unrealized-note"),
  cash: document.querySelector("#metric-cash"),
  cashNote: document.querySelector("#metric-cash-note"),
  sync: document.querySelector("#metric-sync"),
  syncNote: document.querySelector("#metric-sync-note"),
  briefTitle: document.querySelector("#brief-title"),
  briefMeta: document.querySelector("#brief-meta"),
  briefStatus: document.querySelector("#brief-status"),
  briefContributors: document.querySelector("#brief-contributors"),
  briefRisks: document.querySelector("#brief-risks"),
  briefQuality: document.querySelector("#brief-quality"),
  chartTitle: document.querySelector("#chart-title"),
  chartMeta: document.querySelector("#chart-meta"),
  chart: document.querySelector("#market-chart"),
  chartEmpty: document.querySelector("#chart-empty"),
  windowStart: document.querySelector("#window-start"),
  windowEnd: document.querySelector("#window-end"),
  windowStartLabel: document.querySelector("#window-start-label"),
  windowEndLabel: document.querySelector("#window-end-label"),
  tooltip: document.querySelector("#chart-tooltip"),
  symbol: document.querySelector("#symbol-select"),
  interval: document.querySelector("#interval-select"),
  positionsBody: document.querySelector("#positions-body"),
  verification: document.querySelector("#verification-badge"),
  tradeTitle: document.querySelector("#trade-title"),
  tradeCount: document.querySelector("#trade-count"),
  tradeSummary: document.querySelector("#trade-summary"),
  tradeList: document.querySelector("#trade-list"),
  pieStatus: document.querySelector("#pie-status"),
  pieGrid: document.querySelector("#pie-grid"),
  sourceList: document.querySelector("#source-list"),
  syncDetails: document.querySelector("#sync-details"),
  settingsStatus: document.querySelector("#settings-status"),
  updatedAt: document.querySelector("#updated-at"),
  markerStatus: document.querySelector("#marker-status"),
  sidebarStatus: document.querySelector("#sidebar-status"),
  sidebarStatusText: document.querySelector("#sidebar-status-text")
};

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".view").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === button.dataset.view));
    elements.pageTitle.textContent = t(`nav.${button.dataset.view}`);
    elements.sidebar.classList.remove("open");
  });
});

document.querySelectorAll("[data-range]").forEach((button) => {
  button.addEventListener("click", async () => {
    document.querySelectorAll("[data-range]").forEach((item) => item.classList.toggle("active", item === button));
    state.range = button.dataset.range;
    await loadChart();
  });
});

document.querySelectorAll("[data-chart-type]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-chart-type]").forEach((item) => item.classList.toggle("active", item === button));
    state.chartType = button.dataset.chartType;
    drawChart();
  });
});

elements.symbol.addEventListener("change", async () => {
  await selectSymbol(elements.symbol.value);
});
elements.interval.addEventListener("change", async () => {
  state.interval = elements.interval.value;
  await loadChart();
});
elements.windowStart.addEventListener("input", () => {
  state.windowStart = Math.min(Number(elements.windowStart.value), state.windowEnd - 5);
  elements.windowStart.value = String(state.windowStart);
  syncWindowControls();
  drawChart();
});
elements.windowEnd.addEventListener("input", () => {
  state.windowEnd = Math.max(Number(elements.windowEnd.value), state.windowStart + 5);
  elements.windowEnd.value = String(state.windowEnd);
  syncWindowControls();
  drawChart();
});
elements.positionsBody.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-symbol]");
  if (button) await selectSymbol(button.dataset.symbol);
});
elements.refresh.addEventListener("click", () => refreshAll({ force: true }));
elements.languageToggle.addEventListener("click", async () => {
  state.language = state.language === "zh" ? "en" : "zh";
  localStorage.setItem("vesper-language", state.language);
  applyLanguage();
  await refreshAll();
});
elements.sidebarToggle.addEventListener("click", () => elements.sidebar.classList.toggle("open"));
window.addEventListener("resize", debounce(drawChart, 120));
elements.chart.addEventListener("mousemove", handleChartHover);
elements.chart.addEventListener("mouseleave", () => { elements.tooltip.hidden = true; });

applyLanguage();
await refreshAll();

const events = new EventSource("/api/events");
events.addEventListener("snapshot", () => refreshAll());
setInterval(() => {
  if (!document.hidden && state.symbol) loadQuote();
}, 30_000);

function applyLanguage() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  elements.languageToggle.textContent = state.language === "zh" ? "EN" : "中文";
  const activeNav = document.querySelector(".nav-item.active");
  if (activeNav) elements.pageTitle.textContent = t(`nav.${activeNav.dataset.view}`);
  const tooltip = document.querySelector(".has-tooltip[data-tooltip-key='unrealized']");
  if (tooltip) {
    tooltip.dataset.tooltip = state.language === "zh"
      ? "未实现盈亏：当前还持有的仓位，按现价计算但尚未卖出。已实现盈亏：已经卖出后确定的盈亏。"
      : "Unrealized P/L is the current gain or loss on open positions. Realized P/L is locked in after a sale.";
  }
  renderChartMeta();
  renderMarkerStatus();
}

async function refreshAll({ force = false } = {}) {
  setStatus(t("status.syncing"), false);
  try {
    const status = await request("/api/status", 8_000);
    const snapshot = await request(`/api/snapshot${force ? "?refresh=1" : ""}`, 45_000).catch((error) => ({
      status: "ERROR",
      error: error.message,
      positions: [],
      pies: [],
      orders: [],
      errors: [{ section: "account", message: error.message }]
    }));
    const brief = await request("/api/brief", 20_000).catch((error) => ({
      generatedAt: new Date().toISOString(),
      syncedAt: null,
      summary: {},
      concentration: {},
      topContributors: [],
      topDetractors: [],
      recentOrders: [],
      riskSignals: [{ severity: "medium", code: "DATA_QUALITY", message: error.message }],
      dataQuality: { reconciliationStatus: "UNKNOWN", errors: [] }
    }));
    state.status = status;
    state.snapshot = snapshot;
    state.brief = brief;
    renderStatus();
    renderSnapshot(snapshot);
    renderBrief(brief);
    populateSymbols(snapshot);
    if (!state.symbol) state.symbol = snapshot.positions?.[0]?.symbol || snapshot.allocation?.[0]?.symbol || null;
    if (state.symbol) {
      elements.symbol.value = state.symbol;
      await Promise.all([loadQuote(), loadChart(), loadTrades()]);
    } else {
      showChartEmpty(snapshot.error || "Trading 212 is not configured yet.");
    }
    setStatus(status.credentials?.configured ? t("status.connected") : t("status.setup"), Boolean(status.credentials?.configured));
  } catch (error) {
    setStatus(t("status.error"), false);
    showChartEmpty(error.message);
  }
}

async function loadChart() {
  if (!state.symbol) return;
  const symbol = state.symbol;
  const requestId = ++state.chartRequestId;
  try {
    const history = await request(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${state.range}&interval=${encodeURIComponent(state.interval)}`, 30_000);
    if (requestId !== state.chartRequestId || symbol !== state.symbol) return;
    state.history = history;
    const historyKey = `${symbol}:${state.range}:${state.interval}`;
    if (state.historyKey !== historyKey) {
      state.historyKey = historyKey;
      const count = history.bars?.length || 0;
      state.windowStart = count > 120 ? 70 : count > 60 ? 55 : 0;
      state.windowEnd = 100;
      syncWindowControls();
    }
    elements.chartEmpty.hidden = state.history.bars?.length > 0;
    elements.chartTitle.textContent = `${state.symbol} · ${state.range}${state.interval === "auto" ? "" : ` · ${state.interval}`}`;
    elements.sourceBadge.textContent = state.history.source || "Source unavailable";
    elements.updatedAt.textContent = `Updated ${formatDateTime(state.history.updatedAt)}`;
    renderChartMeta();
    renderMarkerStatus();
    drawChart();
  } catch (error) {
    showChartEmpty(friendlyChartError(error));
  }
}

async function loadQuote() {
  if (!state.symbol) return;
  const symbol = state.symbol;
  const requestId = ++state.quoteRequestId;
  try {
    const quote = await request(`/api/quote?symbol=${encodeURIComponent(symbol)}`, 12_000);
    if (requestId !== state.quoteRequestId || symbol !== state.symbol) return;
    state.quote = quote;
    renderChartMeta();
    elements.sourceBadge.textContent = quote.source || "Source unavailable";
  } catch (error) {
    elements.markerStatus.textContent = `Quote unavailable: ${error.message}`;
  }
}

function renderChartMeta() {
  const history = state.history;
  const quote = state.quote;
  const source = quote?.source || history?.source || "Unknown source";
  const delayValue = quote?.delayedByMinutes ?? history?.delayedByMinutes;
  const delay = delayValue === 0
    ? (state.language === "zh" ? "实时推送" : "streaming")
    : `${delayValue ?? "?"} ${state.language === "zh" ? "分钟延迟" : "min delay"}`;
  const price = quote ? ` · ${formatNumber(quote.price, 2)} ${quote.currency || ""}` : "";
  elements.chartMeta.textContent = `${state.symbol || "Symbol"}${price} · ${source} · ${delay}`;
}

function renderMarkerStatus() {
  const chartMarkerCount = state.history?.markers?.length || 0;
  const tradeMarkerCount = state.trades?.markers?.length || 0;
  const markerCount = Math.max(chartMarkerCount, tradeMarkerCount);
  const orderError = state.snapshot?.errors?.find((error) => error.section === "orders");
  elements.markerStatus.textContent = markerCount
    ? chartMarkerCount > 0
      ? `${markerCount} ${state.language === "zh" ? "个买卖标记" : "execution markers"}`
      : `${markerCount} ${state.language === "zh" ? "笔成交记录，图表源暂不可用" : "trades loaded; chart source unavailable"}`
    : orderError
      ? orderError.status === 429
        ? (state.language === "zh" ? "订单接口达到限频，稍后自动重试" : "Order-history rate limit reached; retrying automatically")
        : (state.language === "zh" ? "订单历史暂不可用，刷新后重试" : "Order history unavailable; refresh to retry")
      : (state.language === "zh" ? "暂无买卖标记" : "No execution markers");
}

async function loadTrades() {
  if (!state.symbol) return;
  const symbol = state.symbol;
  const requestId = ++state.tradesRequestId;
  try {
    const trades = await request(`/api/trades?symbol=${encodeURIComponent(symbol)}`);
    if (requestId !== state.tradesRequestId || symbol !== state.symbol) return;
    state.trades = trades;
    renderTrades(state.trades);
  } catch (error) {
    elements.tradeList.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
  }
}

function renderStatus() {
  const status = state.status;
  const orderError = state.snapshot?.errors?.find((error) => error.section === "orders");
  const sourceState = status.dataSources || {};
  elements.sourceList.innerHTML = [
    sourceItem("Trading 212 / 212", state.language === "zh" ? "真实账户、持仓、Pies、订单历史和现金流水；不提供 K 线。" : "Real account, positions, Pies, order history and cash movements. No K-lines.", sourceState.trading212 ? (state.language === "zh" ? "已连接" : "Connected") : (state.language === "zh" ? "未配置" : "Missing")),
    sourceItem("TradingView / TradingView", state.language === "zh" ? "主要实时报价源；英股可能推送，美股和欧股会显示延迟。" : "Primary quote source. LSE may stream; US and EU quotes show their delay.", sourceState.tradingView ? (state.language === "zh" ? "可用" : "Active") : (state.language === "zh" ? "不可用" : "Unavailable")),
    sourceItem("Yahoo Finance / Yahoo Finance", state.language === "zh" ? "历史 K 线和报价兜底；当前网络下英股可能返回 403。" : "Historical bars and quote fallback. LSE may return HTTP 403 on this network.", sourceState.yahoo ? (state.language === "zh" ? "兜底" : "Fallback") : (state.language === "zh" ? "不可用" : "Unavailable")),
    sourceItem("Nasdaq / Nasdaq", state.language === "zh" ? "Yahoo 不可用时，为美股提供日 K 线兜底。" : "US daily-bar fallback when Yahoo is unavailable.", sourceState.nasdaq ? (state.language === "zh" ? "美股兜底" : "US fallback") : (state.language === "zh" ? "不可用" : "Unavailable")),
    sourceItem("Twelve Data / Twelve Data", state.language === "zh" ? "可选的英股、欧股和跨市场 K 线源。" : "Optional UK/EU and cross-market K-line source.", sourceState.twelveData ? (state.language === "zh" ? "已配置" : "Configured") : (state.language === "zh" ? "可选 Key" : "Optional key")),
    sourceItem("Longbridge MCP / Longbridge MCP", state.language === "zh" ? "可选外部 MCP，提供实时行情、K 线、基本面和长桥新闻。" : "Optional external MCP for live quotes, candlesticks, fundamentals and Longbridge news.", state.language === "zh" ? "独立 MCP" : "Separate MCP")
  ].join("");

  elements.syncDetails.innerHTML = definitionRows({
    [state.language === "zh" ? "凭证来源" : "Credential source"]: status.credentials?.source || "missing",
    [state.language === "zh" ? "环境" : "Environment"]: status.config?.environment || "live",
    [state.language === "zh" ? "账户权限" : "Account access"]: state.language === "zh" ? "只读" : "Read-only",
    [state.language === "zh" ? "订单历史" : "Order history"]: orderError
      ? orderError.status === 429
        ? (state.language === "zh" ? "达到限频，稍后重试" : "Rate limited; retrying")
        : (state.language === "zh" ? "接口异常，稍后重试" : "API issue; retrying")
      : (state.language === "zh" ? "可读取" : "Readable"),
    [state.language === "zh" ? "长桥" : "Longbridge"]: sourceState.longbridge ? (state.language === "zh" ? "已连接" : "Connected") : (state.language === "zh" ? "未连接" : "Not connected"),
    [state.language === "zh" ? "看板模式" : "Dashboard mode"]: status.dashboard?.cloudConfigured ? (state.language === "zh" ? "云端已配置" : "Cloud configured") : (state.language === "zh" ? "本地" : "Local"),
    [state.language === "zh" ? "插件版本" : "Plugin version"]: status.version
  });
  elements.settingsStatus.innerHTML = definitionRows({
    [state.language === "zh" ? "API Key" : "API key"]: status.credentials?.configured ? (state.language === "zh" ? "已配置" : "Configured") : (state.language === "zh" ? "未配置" : "Missing"),
    [state.language === "zh" ? "存储位置" : "Storage"]: status.credentials?.source || "Not configured",
    [state.language === "zh" ? "下单能力" : "Order execution"]: state.language === "zh" ? "未实现" : "Not implemented",
    [state.language === "zh" ? "云端密钥" : "Cloud secrets"]: state.language === "zh" ? "从不上传" : "Never uploaded"
  });
}

function renderBrief(brief) {
  const summary = brief.summary || {};
  const currency = summary.currency || "GBP";
  elements.briefTitle.textContent = `${brief.concentration?.positionCount || 0} ${state.language === "zh" ? "个持仓" : "positions"} · ${money(summary.totalValue, currency)}`;
  elements.briefMeta.textContent = state.language === "zh"
    ? `快照 ${formatDateTime(brief.syncedAt)} · 生成 ${formatDateTime(brief.generatedAt)}`
    : `Snapshot ${formatDateTime(brief.syncedAt)} · generated ${formatDateTime(brief.generatedAt)}`;
  elements.briefStatus.textContent = state.language === "zh" ? "只读" : "Read-only";
  elements.briefStatus.className = "badge ok";

  const contributors = [...(brief.topContributors || []), ...(brief.topDetractors || [])];
  elements.briefContributors.innerHTML = contributors.length ? contributors.map((position) => `
    <li><strong>${escapeHtml(position.symbol)} ${money(position.unrealizedPnL, currency)}</strong>${formatPercent(position.unrealizedPnLPercent)} return · ${formatPercent(position.weightPercent)} weight</li>
  `).join("") : `<li>${state.language === "zh" ? "暂无收益贡献数据" : "No contribution data available."}</li>`;

  elements.briefRisks.innerHTML = (brief.riskSignals || []).length ? brief.riskSignals.map((signal) => `
    <li class="${escapeHtml(signal.severity)}"><strong>${escapeHtml(signal.code)}</strong>${escapeHtml(signal.message)}</li>
  `).join("") : `<li>${state.language === "zh" ? "暂无阈值风险" : "No threshold-based risks detected."}</li>`;

  const errors = brief.dataQuality?.errors || [];
  elements.briefQuality.innerHTML = [
    `<li><strong>${state.language === "zh" ? "Pies" : "Pies"} ${escapeHtml(brief.dataQuality?.reconciliationStatus || "UNKNOWN")}</strong>${errors.length ? `${errors.length} ${state.language === "zh" ? "条同步警告" : "sync warning(s)"}` : (state.language === "zh" ? "无核对问题" : "No reconciliation warnings")}</li>`,
    `<li><strong>${state.language === "zh" ? "有效持仓数" : "Effective positions"} ${formatNumber(brief.concentration?.effectivePositionCount, 2)}</strong>${state.language === "zh" ? "最大仓位" : "Top one"} ${formatPercent(brief.concentration?.topOneWeightPercent)}</li>`,
    `<li><strong>${state.language === "zh" ? "近期订单" : "Recent orders"} ${brief.recentOrders?.length || 0}</strong>${state.language === "zh" ? "最近 14 天" : "Last 14 days"}</li>`
  ].join("");
}

function renderSnapshot(snapshot) {
  const summary = snapshot.summary || {};
  const currency = summary.currency || "GBP";
  elements.total.textContent = money(summary.totalValue, currency);
  elements.totalNote.textContent = snapshot.syncedAt
    ? `${state.language === "zh" ? "同步于" : "Synced"} ${formatDateTime(snapshot.syncedAt)}`
    : (state.language === "zh" ? "暂无账户快照" : "No account snapshot");
  elements.unrealized.textContent = money(summary.unrealizedPnL, currency);
  elements.unrealized.className = valueClass(summary.unrealizedPnL);
  elements.unrealizedNote.textContent = `${state.language === "zh" ? "已实现" : "Realized"} ${money(summary.realizedPnL, currency)}`;
  elements.cash.textContent = money(summary.availableCash, currency);
  elements.cashNote.textContent = `${state.language === "zh" ? "Pie/预留" : "Pie/reserved"} ${money(summary.reservedCash, currency)}`;
  elements.sync.textContent = snapshot.status || "UNKNOWN";
  elements.syncNote.textContent = snapshot.errors?.length
    ? `${snapshot.errors.length} ${state.language === "zh" ? "项同步警告" : "section warnings"}`
    : (state.language === "zh" ? "缓存正常" : "Cache current");
  elements.verification.textContent = snapshot.reconciliation?.status || "Unverified";
  elements.verification.className = snapshot.reconciliation?.status === "VERIFIED" ? "muted positive" : "muted";
  elements.pieStatus.textContent = snapshot.reconciliation?.status || "Waiting";

  const latestOrderBySymbol = new Map();
  for (const order of snapshot.orders || []) {
    const current = latestOrderBySymbol.get(order.symbol);
    if (!current || Date.parse(order.filledAt || order.orderedAt || "") > Date.parse(current.filledAt || current.orderedAt || "")) {
      latestOrderBySymbol.set(order.symbol, order);
    }
  }
  const orderError = snapshot.errors?.find((error) => error.section === "orders");

  elements.positionsBody.innerHTML = (snapshot.positions || []).map((position) => {
    const latestOrder = latestOrderBySymbol.get(position.symbol);
    const latestTrade = latestOrder
      ? `${latestOrder.side === "BUY" ? (state.language === "zh" ? "买入" : "Buy") : (state.language === "zh" ? "卖出" : "Sell")} · ${formatDateTime(latestOrder.filledAt || latestOrder.orderedAt)}`
      : orderError
        ? (state.language === "zh" ? "需要开启 History - Orders" : "Enable History - Orders")
        : (state.language === "zh" ? "暂无成交" : "No filled trades");
    return `
    <tr>
      <td><button class="symbol-link" data-symbol="${escapeHtml(position.symbol)}">${escapeHtml(position.symbol)}</button></td>
      <td>${formatNumber(position.quantity, 4)}</td>
      <td>${formatNumber(position.averagePricePaid, 2)}</td>
      <td>${formatNumber(position.currentPrice, 2)}</td>
      <td>${formatNumber(position.marketValue, 2)}</td>
      <td class="${valueClass(position.unrealizedPnL)}">${formatNumber(position.unrealizedPnL, 2)}</td>
      <td class="${valueClass(position.unrealizedPnLPercent)}">${formatPercent(position.unrealizedPnLPercent * 100)}</td>
      <td>${escapeHtml(latestTrade)}</td>
    </tr>
  `;
  }).join("") || emptyRow(8, snapshot.error || "No positions returned.");

  const pies = snapshot.reconciliation?.pies || [];
  elements.pieGrid.innerHTML = pies.length ? pies.map((pie) => `
    <article class="pie-card">
      <h3>${escapeHtml(pie.pieName || "Unnamed Pie")}</h3>
      <span class="muted">${pie.instruments.length} instruments</span>
      <ul>${pie.instruments.map((item) => `
        <li>
          <span>${escapeHtml(item.symbol)} · Pie ${formatNumber(item.pieQuantity, 4)} / Broker ${formatNullable(item.brokerageQuantity, 4)}</span>
          <span class="badge ${item.status === "VERIFIED" ? "ok" : "bad"}">${item.status}</span>
        </li>
      `).join("")}</ul>
    </article>
  `).join("") : '<p class="muted">No Pies are available in this account.</p>';
}

function renderTrades(review) {
  elements.tradeTitle.textContent = review.symbol || "Portfolio";
  elements.tradeCount.textContent = `${review.tradeCount || 0} trades`;
  elements.tradeSummary.innerHTML = [
    [state.language === "zh" ? "累计买入" : "Invested", formatNumber(review.totalInvested, 2)],
    [state.language === "zh" ? "累计卖出" : "Recovered", formatNumber(review.totalRecovered, 2)],
    [state.language === "zh" ? "净投入" : "Net invested", formatNumber(review.netInvested, 2)],
    [state.language === "zh" ? "已实现盈亏" : "Realized P/L", formatNumber(review.realizedPnL, 2)],
    [state.language === "zh" ? "未实现盈亏" : "Unrealized P/L", formatNumber(review.unrealizedPnL, 2)],
    [state.language === "zh" ? "平均买入价" : "Average buy", formatNullable(review.averageBuyPrice, 2)],
    [state.language === "zh" ? "平均卖出价" : "Average sell", formatNullable(review.averageSellPrice, 2)],
    [state.language === "zh" ? "胜率" : "Win rate", review.winRate === null || review.winRate === undefined ? "—" : formatPercent(review.winRate * 100)]
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  elements.tradeList.innerHTML = (review.markers || []).slice().reverse().map((marker) => `
    <div class="trade-row">
      <span class="trade-side ${marker.side}">${marker.side === "BUY" ? "B" : "S"}</span>
      <div><strong>${formatNumber(marker.quantity, 4)} @ ${formatNumber(marker.price, 2)}</strong><span>${formatDateTime(marker.time)}</span></div>
      <span>${formatNumber(marker.value, 2)}</span>
    </div>
  `).join("") || `<p class="muted" style="padding: 0 18px 14px">${state.language === "zh" ? "该股票暂无已成交记录。" : "No filled trades for this symbol."}</p>`;
  renderMarkerStatus();
}

function populateSymbols(snapshot) {
  const symbols = (snapshot.positions || []).map((position) => position.symbol);
  const existing = new Set([...elements.symbol.options].map((option) => option.value));
  for (const symbol of symbols) {
    if (!symbol || existing.has(symbol)) continue;
    const option = document.createElement("option");
    option.value = symbol;
    option.textContent = symbol;
    elements.symbol.append(option);
    existing.add(symbol);
  }
}

async function selectSymbol(symbol) {
  if (!symbol) return;
  state.symbol = symbol;
  elements.symbol.value = symbol;
  state.history = null;
  state.quote = null;
  renderChartMeta();
  await Promise.all([loadChart(), loadTrades()]);
  await loadQuote();
}

function drawChart() {
  const canvas = elements.chart;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;
  context.clearRect(0, 0, width, height);
  const allBars = state.history?.bars || [];
  const startIndex = Math.floor(allBars.length * state.windowStart / 100);
  const endIndex = Math.max(startIndex + 1, Math.ceil(allBars.length * state.windowEnd / 100));
  const bars = allBars.slice(startIndex, endIndex);
  if (bars.length < 2) {
    showChartEmpty();
    return;
  }
  elements.chartEmpty.hidden = true;
  const padding = { top: 18, right: 62, bottom: 30, left: 10 };
  const values = bars.flatMap((bar) => [bar.low ?? bar.close, bar.high ?? bar.close]).filter(Number.isFinite);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const spread = Math.max(max - min, max * 0.01);
  min -= spread * 0.08;
  max += spread * 0.08;
  const x = (index) => padding.left + index / Math.max(bars.length - 1, 1) * (width - padding.left - padding.right);
  const y = (value) => padding.top + (max - value) / (max - min) * (height - padding.top - padding.bottom);

  context.strokeStyle = "rgba(29,29,31,.08)";
  context.fillStyle = "#86868b";
  context.font = "10px -apple-system, sans-serif";
  context.textAlign = "left";
  for (let line = 0; line <= 4; line += 1) {
    const value = min + (max - min) * line / 4;
    const lineY = y(value);
    context.beginPath();
    context.moveTo(padding.left, lineY);
    context.lineTo(width - padding.right, lineY);
    context.stroke();
    context.fillText(value.toFixed(2), width - padding.right + 8, lineY + 3);
  }

  if (state.chartType === "candles") {
    const candleWidth = Math.max(1, Math.min(8, (width - padding.left - padding.right) / bars.length * 0.62));
    bars.forEach((bar, index) => {
      const center = x(index);
      const open = bar.open ?? bar.close;
      const close = bar.close;
      const high = bar.high ?? Math.max(open, close);
      const low = bar.low ?? Math.min(open, close);
      context.strokeStyle = close >= open ? "#16834a" : "#c43a34";
      context.fillStyle = close >= open ? "#16834a" : "#c43a34";
      context.beginPath();
      context.moveTo(center, y(high));
      context.lineTo(center, y(low));
      context.stroke();
      context.fillRect(center - candleWidth / 2, Math.min(y(open), y(close)), candleWidth, Math.max(2, Math.abs(y(open) - y(close))));
    });
  } else {
    const gradient = context.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, "rgba(29,29,31,.16)");
    gradient.addColorStop(1, "rgba(29,29,31,0)");
    context.beginPath();
    bars.forEach((bar, index) => {
      const pointX = x(index);
      const pointY = y(bar.close);
      if (index === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    });
    const linePath = context;
    context.lineTo(x(bars.length - 1), height - padding.bottom);
    context.lineTo(x(0), height - padding.bottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
    linePath.beginPath();
    bars.forEach((bar, index) => {
      const pointX = x(index);
      const pointY = y(bar.close);
      if (index === 0) linePath.moveTo(pointX, pointY);
      else linePath.lineTo(pointX, pointY);
    });
    context.strokeStyle = "#1d1d1f";
    context.lineWidth = 1.6;
    context.stroke();
  }

  const times = bars.map((bar) => Date.parse(bar.time));
  const markers = state.history?.markers || [];
  markers.forEach((marker) => {
    const markerTime = Date.parse(marker.time);
    const index = nearestIndex(times, markerTime);
    if (index < 0 || !Number.isFinite(marker.price)) return;
    const pointX = x(index);
    const pointY = y(marker.price);
    const radius = Math.max(6, Math.min(14, 5 + Math.sqrt(Number(marker.value || 0)) / 10));
    context.beginPath();
    context.fillStyle = marker.side === "BUY" ? "#16834a" : "#c43a34";
    context.arc(pointX, pointY, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "white";
    context.font = `700 ${Math.max(8, radius)}px -apple-system, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(marker.side === "BUY" ? "B" : "S", pointX, pointY + .5);
  });

  canvas._chartGeometry = { bars, padding, x, y, times };
}

function handleChartHover(event) {
  const geometry = elements.chart._chartGeometry;
  if (!geometry) return;
  const rect = elements.chart.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  const index = Math.round((mouseX - geometry.padding.left) / Math.max(1, rect.width - geometry.padding.left - geometry.padding.right) * (geometry.bars.length - 1));
  if (index < 0 || index >= geometry.bars.length) return;
  const bar = geometry.bars[index];
  elements.tooltip.hidden = false;
  elements.tooltip.style.left = `${event.clientX - rect.left}px`;
  elements.tooltip.style.top = `${event.clientY - rect.top}px`;
  elements.tooltip.innerHTML = `<strong>${escapeHtml(state.symbol)}</strong><br>${formatDateTime(bar.time)}<br>O ${formatNumber(bar.open, 2)} H ${formatNumber(bar.high, 2)}<br>L ${formatNumber(bar.low, 2)} C ${formatNumber(bar.close, 2)}`;
}

function showChartEmpty(message) {
  elements.chartEmpty.hidden = true;
  elements.chartEmpty.textContent = "";
}

function syncWindowControls() {
  elements.windowStart.value = String(state.windowStart);
  elements.windowEnd.value = String(state.windowEnd);
  const bars = state.history?.bars || [];
  const start = bars[Math.floor(bars.length * state.windowStart / 100)];
  const end = bars[Math.max(0, Math.ceil(bars.length * state.windowEnd / 100) - 1)];
  elements.windowStartLabel.textContent = start ? formatDateTime(start.time) : "Start";
  elements.windowEndLabel.textContent = end ? formatDateTime(end.time) : "End";
}

function friendlyChartError(error) {
  const message = String(error?.message || error || "Chart unavailable");
  if (/10m|10-minute|10 minute/i.test(message)) {
    return state.language === "zh"
      ? "10 分钟行情需要配置 Twelve Data Key。其他周期仍可使用。"
      : "10-minute charts require a Twelve Data key. Other intervals remain available.";
  }
  return state.language === "zh"
    ? "图表数据暂时不可用，Vesper 会保留缓存并自动切换数据源。"
    : "Chart data is temporarily unavailable. Vesper will keep the cache and switch sources automatically.";
}

function setStatus(text, ready) {
  elements.sidebarStatusText.textContent = text;
  elements.sidebarStatus.classList.toggle("ready", ready);
}

async function request(url, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    const body = await response.json();
    if (!response.ok || body.error) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`Request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function sourceItem(title, description, status) {
  return `<div class="source-item"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span><span class="badge">${escapeHtml(status)}</span></div>`;
}

function definitionRows(values) {
  return Object.entries(values).map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value ?? "—"))}</dd>`).join("");
}

function emptyRow(columns, text) {
  return `<tr><td colspan="${columns}" class="muted">${escapeHtml(text)}</td></tr>`;
}

function money(value, currency) {
  if (!Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP", maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-GB", { maximumFractionDigits: digits }) : "—";
}

function formatNullable(value, digits = 2) {
  return value === null || value === undefined ? "—" : formatNumber(value, digits);
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : "—";
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Unavailable";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function valueClass(value) {
  return Number(value) > 0 ? "positive" : Number(value) < 0 ? "negative" : "";
}

function nearestIndex(values, target) {
  if (!Number.isFinite(target)) return -1;
  let bestIndex = -1;
  let bestDistance = Infinity;
  values.forEach((value, index) => {
    const distance = Math.abs(value - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
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
