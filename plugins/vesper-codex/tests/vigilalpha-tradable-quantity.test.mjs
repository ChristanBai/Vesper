import test from "node:test";
import assert from "node:assert/strict";
import { mapPositions } from "../src/core/portfolio.mjs";
import { buildShadowDecision } from "../src/vigilalpha/decision.mjs";
import { marketReview } from "../src/vigilalpha/reviews.mjs";
import { createToolRuntime } from "../src/mcp/tools.mjs";

test("missing tradable quantity remains missing and cannot fall back to total shares", () => {
  const [missing] = mapPositions([{ quantity: 10 }]);
  const [zero] = mapPositions([{ quantity: 10, quantityAvailableForTrading: 0 }]);
  assert.equal(missing.quantityAvailableForTrading, null);
  assert.equal(zero.quantityAvailableForTrading, 0);
  const input = { symbol: "AAA", position: { quantity: 10, marketValue: 100 }, totalValue: 1000 };
  const absent = buildShadowDecision(input);
  assert.equal(absent.dataIssues[0].field, "quantityAvailableForTrading");
  assert.equal(absent.dataIssues[0].code, "MISSING_OR_INVALID");
  const unavailable = buildShadowDecision({ ...input, position: { ...input.position, quantityAvailableForTrading: 0 } });
  assert.equal(unavailable.dataIssues[0].code, "NON_POSITIVE");
  assert.equal(unavailable.action, "WAIT");
});

test("public-symbol compact review never reads an account or invents portfolio facts", async () => {
  const service = { history: async () => ({ interval: "1D", currency: "USD", source: "synthetic", bars: [] }),
    snapshot: async () => { throw new Error("Account access is forbidden in this test"); } };
  const result = await marketReview(service, "AAA");
  assert.equal(result.accountContext, "NOT_PROVIDED");
  assert.equal(result.chart.bars.length, 0);
  assert.equal(result.chart.status, "NOT_REQUESTED");
  assert.equal(result.executionAuthority, "NONE");
  const emptyChart = await marketReview(service, "AAA", { includeChart: true });
  assert.equal(emptyChart.chart.status, "UNAVAILABLE");
  assert.equal(emptyChart.riskVeto.active, null);
});

test("event tool can run without credentials or account initialization", async () => {
  const result = await createToolRuntime({ env: {} }).call("event_review", { asOf: "2026-10-24", days: 30 });
  assert.equal(result.isLive, false);
  assert.ok(result.events.length > 0);
});
