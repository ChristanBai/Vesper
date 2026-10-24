import http from "node:http";
import { readVisualizationResource, PORTFOLIO_FLOW_UI_URI, HOLDING_CHART_UI_URI, RISK_TIMELINE_UI_URI } from "../src/vigilalpha/inline-ui.mjs";
import { conditionalPatterns } from "../src/vigilalpha/conditional-patterns.mjs";

// Entirely synthetic. Never initialize an account runtime for a design preview.
const bars = Array.from({ length: 180 }, (_, i) => {
  const close = 100 + i * 0.16 + Math.sin(i / 9) * 9;
  const open = close + Math.sin(i) * 2;
  return { time: new Date(Date.UTC(2026, 3, i + 1)).toISOString(), open, high: Math.max(open, close) + 2, low: Math.min(open, close) - 2, close, volume: 1000 + i * 5 };
});
const history = { bars, interval: "1D", currency: "USD" };
const conditionalResearch = conditionalPatterns(history, { asOf: "2026-09-28T00:00:00Z" });
const holding = { demo: true, signal: "RESEARCH_ONLY", sourceCutoff: "2026-09-27 · SYNTHETIC", holding: { symbol: "DEMO", currency: "USD", weightPercent: 12 }, evidence: { market: { source: "Synthetic fixture / 合成数据" } }, riskVeto: { active: null, reasons: [] }, conditionalResearch, chart: { status: "AVAILABLE", currency: "USD", averageCost: 116, bars, strategyMarkers: conditionalResearch.markers, executionMarkers: [{ timestamp: bars[100].time, executionPrice: bars[100].close, quantity: 5, side: "BUY" }, { timestamp: bars[160].time, executionPrice: bars[160].close, quantity: 2, side: "SELL" }] }, tradeReview: { historyCompleteness: "SYNTHETIC" } };
const portfolio = { demo: true, signal: "REVIEW", sourceCutoff: "2026-09-27 · SYNTHETIC", summary: { totalValue: 100000, currency: "GBP" }, positions: [32, 24, 18, 16, 10].map((weightPercent, i) => ({ symbol: `DEMO ${String.fromCharCode(65 + i)}`, weightPercent, marketValue: weightPercent * 1000, currency: "GBP" })), riskVeto: { active: true, reasons: [{ code: "EXAMPLE_CONCENTRATION", message: "合成案例：单股暴露需要复核 / Synthetic concentration example" }] } };
const timeline = { demo: true, status: "SYNTHETIC", materialChange: true, timeline: [100000, 101000, 98500, 102000].map((totalValue, i) => ({ totalValue, timestamp: `2026-09-${20 + i}` })), changes: [{ code: "SYNTHETIC_EXAMPLE", before: 20, after: 24, material: true }] };
const routes = new Map([["/", [HOLDING_CHART_UI_URI, holding]], ["/holding", [HOLDING_CHART_UI_URI, holding]], ["/portfolio", [PORTFOLIO_FLOW_UI_URI, portfolio]], ["/timeline", [RISK_TIMELINE_UI_URI, timeline]], ["/empty", [HOLDING_CHART_UI_URI, { demo: true, signal: "WAIT", chart: { status: "UNAVAILABLE", bars: [] } }]]]);
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const route = routes.get(url.pathname);
  if (!route) { response.writeHead(404); response.end(); return; }
  const [uri, data] = route;
  const json = JSON.stringify(data).replaceAll("<", "\\u003c");
  const bootstrap = `<script>window.openai={toolOutput:${json}};</script>`;
  let html = readVisualizationResource(uri).text.replace("<script>", bootstrap + "<script>");
  if (url.searchParams.get("theme") === "light") {
    html = html.replace("</head>", '<style>:root{color-scheme:light;--bg:#f5f5f7;--card:#fff;--line:#d8dce2;--text:#202124;--muted:#59616e;--accent:#326e91;--warn:#965321;--research:#79509c;--hover:#e8ebef}</style></head>');
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(html);
});
server.listen(0, "127.0.0.1", () => {
  console.log(`Synthetic UI preview: http://127.0.0.1:${server.address().port}/`);
  console.log("Routes: /holding /portfolio /timeline /empty. Ctrl+C stops the preview. No account data or network market calls.");
});
