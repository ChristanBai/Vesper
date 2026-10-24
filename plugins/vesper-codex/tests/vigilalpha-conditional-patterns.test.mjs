import test from "node:test";
import assert from "node:assert/strict";
import { conditionalPatterns } from "../src/vigilalpha/conditional-patterns.mjs";

function history() {
  return { interval: "1D", currency: "USD", bars: Array.from({ length: 100 }, (_, i) => ({
    time: new Date(Date.UTC(2025, 0, i + 1)).toISOString(), open: 99 + i, high: 101 + i,
    low: 98 + i, close: 100 + i, volume: 1000
  })) };
}

test("candidate plans share numeric regimes without creating executions", () => {
  const result = conditionalPatterns(history(), { asOf: "2025-04-11T00:00:00Z" });
  assert.equal(result.rules.length, 3);
  assert.equal(result.rules[0].state, "POSITIVE_REGIME");
  assert.equal(result.productionWeight, 0);
  assert.ok(result.markers.length > 0);
  assert.ok(result.markers.every((m) => m.isExecution === false));
  const reversed = history();
  reversed.bars.slice(-35).forEach((bar, i) => { bar.close = 180 - i * 3; });
  assert.equal(conditionalPatterns(reversed, { asOf: "2025-04-11T00:00:00Z" }).rules[0].state, "WAIT");
  assert.ok(conditionalPatterns(reversed, { asOf: "2025-04-11T00:00:00Z" }).markers.some((m) => m.state === "EXIT_CANDIDATE"));
});

test("unsupported intervals, missing volume and duplicate prices abstain", () => {
  assert.equal(conditionalPatterns({ ...history(), interval: "1wk" }).status, "UNAVAILABLE");
  const value = history(); value.bars.at(-1).volume = null;
  assert.equal(conditionalPatterns(value, { asOf: "2025-04-11T00:00:00Z" }).rules[2].reason, "OHLCV_INCOMPLETE");
  value.bars.push({ ...value.bars.at(-1) });
  assert.equal(conditionalPatterns(value, { asOf: "2025-04-11T00:00:00Z" }).reason, "INVALID_OR_DUPLICATE_PRICE_SERIES");
});

test("same-day and future bars cannot enter completed-date observations", () => {
  const h = history();
  const result = conditionalPatterns(h, { asOf: "2025-02-10T20:00:00Z" });
  assert.ok(!result.markers.some((m) => m.time >= "2025-02-10"));
  assert.equal(result.sourceCutoff, "2025-02-09T00:00:00.000Z");
});


test("stale history and a flat price series never create current positive momentum", () => {
  assert.equal(conditionalPatterns(history(), { asOf: "2026-10-24T00:00:00Z" }).status, "STALE");
  const flat = history(); flat.bars.forEach((bar) => { bar.close = 100; });
  const result = conditionalPatterns(flat, { asOf: "2025-04-11T00:00:00Z" });
  assert.equal(result.rules.find((r) => r.patternId === "rsi-momentum").state, "WAIT");
});
