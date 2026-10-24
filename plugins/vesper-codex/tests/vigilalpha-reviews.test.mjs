import test from "node:test";
import assert from "node:assert/strict";
import { holdingReview, portfolioReview } from "../src/vigilalpha/reviews.mjs";

function fallingBars() {
  return Array.from({ length: 80 }, (_, index) => ({
    time: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    close: index < 20 ? 100 + index : 120 - index
  }));
}

test("holding review applies configured concentration and drawdown vetoes", async () => {
  const snapshot = {
    status: "READY",
    syncedAt: "2026-10-06T00:00:00.000Z",
    summary: { totalValue: 100, currency: "GBP" },
    positions: [{ symbol: "AAA", marketValue: 35, quantity: 1, averagePricePaid: 100, currentPrice: 75, unrealizedPnL: -25 }],
    orders: [],
    errors: []
  };
  const service = {
    config: { riskLimits: { maxPositionWeightPercent: 30, drawdownWarningPercent: 15 } },
    snapshot: async () => snapshot,
    history: async () => ({ source: "fixture", interval: "1D", bars: fallingBars() })
  };
  const review = await holdingReview(service, "AAA");
  assert.equal(review.signal, "REDUCE_RISK");
  assert.ok(review.riskVeto.reasons.some((reason) => reason.code === "SEVERE_CONCENTRATION"));
  assert.ok(review.riskVeto.reasons.some((reason) => reason.code === "EXTREME_DRAWDOWN"));
  assert.equal(review.chart.currency, null);
  assert.equal(review.eventContext.predictsResults, false);
  assert.equal(review.eventContext.coverageComplete, false);
  assert.equal(typeof review.eventContext.requiresRefresh, "boolean");
});

test("portfolio review keeps missing account values null", async () => {
  const service = {
    config: { riskLimits: { maxPositionWeightPercent: 20 } },
    snapshot: async () => ({ status: "DEGRADED", syncedAt: null, summary: {}, positions: [], orders: [], errors: [{ section: "summary", message: "missing" }] })
  };
  const store = { append: async () => ({ savedAt: "2026-10-06T00:00:00.000Z" }) };
  const review = await portfolioReview(service, store);
  assert.equal(review.summary.totalValue, null);
  assert.equal(review.signal, "WATCH");
  assert.ok(review.riskVeto.reasons.some((reason) => reason.code === "MISSING_CUTOFF"));
});


test("holding review separates successful account retrieval times from a refresh attempt", async () => {
  const snapshot = {
    status: "PARTIAL", syncedAt: "2026-10-23T00:00:00Z",
    lastAttemptAt: "2026-10-24T00:00:00Z",
    sectionSyncedAt: { positions: "2026-10-24T00:00:00Z", orders: "2026-10-23T00:00:00Z" },
    summary: { totalValue: 100 }, positions: [{ symbol: "AAA", marketValue: 12, quantity: 1, averagePricePaid: null }],
    orders: [], errors: [{ section: "orders", status: 429 }]
  };
  let requested;
  const service = { config: {}, snapshot: async options => { requested = options; return snapshot; }, history: async () => ({ source: "fixture", bars: [] }) };
  const result = await holdingReview(service, "AAA", { refresh: true });
  assert.equal(requested.force, true);
  assert.equal(result.accountFreshness.isRealtime, false);
  assert.equal(result.accountFreshness.positionsAsOf, snapshot.sectionSyncedAt.positions);
  assert.equal(result.accountFreshness.ordersAsOf, snapshot.sectionSyncedAt.orders);
  assert.deepEqual(result.accountFreshness.failedSections, ["orders"]);
  assert.equal(result.chart.averageCost, null);
  assert.equal(result.holding.weightPercent, 12);
});


test("missing market value is not converted to zero account exposure", async () => {
  const service = { config: {}, snapshot: async () => ({ summary: { totalValue: 100 }, positions: [{ symbol: "AAA", marketValue: null }], orders: [], errors: [] }), history: async () => ({ bars: [] }) };
  const holding = await holdingReview(service, "AAA");
  assert.equal(holding.holding.weightPercent, null);
  const portfolio = await portfolioReview(service, null, { saveSnapshot: false });
  assert.equal(portfolio.positions[0].weightPercent, null);
});
