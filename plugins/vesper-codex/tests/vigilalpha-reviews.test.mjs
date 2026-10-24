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
