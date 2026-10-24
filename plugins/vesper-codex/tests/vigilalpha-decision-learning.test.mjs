import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildShadowDecision } from "../src/vigilalpha/decision.mjs";
import { ShadowLearningStore } from "../src/vigilalpha/learning-store.mjs";
import { PATTERN_SPECS } from "../src/vigilalpha/research.mjs";
import { validatePattern } from "../src/vigilalpha/validation.mjs";
import { tradeMarkers } from "../src/runtime.mjs";
import { createChartAnnotation, createEventObservation, createLearningCandidate, createStrategyPromotionDecision } from "../src/vigilalpha/research-contracts.mjs";

test("risk-target shadow decision sizes toward 80 percent of the configured maximum", () => {
  const decision = buildShadowDecision({
    symbol: "AAA",
    position: { quantity: 40, quantityAvailableForTrading: 30, marketValue: 400, instrumentCurrency: "USD", accountCurrency: "GBP" },
    totalValue: 1_000,
    riskVeto: { reasons: [{ code: "SEVERE_CONCENTRATION", limitPercent: 20, message: "Holding weight 40.00% is above the 20% configured review threshold." }] },
    consensus: { direction: "NO_CONSENSUS", eligibleStrategies: 0 },
    historyCompleteness: { complete: true },
    parametersVersion: "test-v1",
    sourceCutoff: "2026-10-08T00:00:00Z"
  });
  assert.equal(decision.mode, "SHADOW");
  assert.equal(decision.action, "REDUCE");
  assert.equal(decision.sizing.targetWeightPercent, 16);
  assert.equal(decision.quantity, 24);
  assert.equal(decision.executionAuthority, "NONE");
  assert.equal(decision.estimatedEconomics.assumptions.fxApplied, true);
});

test("directional decision waits when order history or promoted evidence is absent", () => {
  const partial = buildShadowDecision({
    symbol: "AAA", position: { quantity: 10, quantityAvailableForTrading: 10, marketValue: 100 }, totalValue: 1_000,
    riskVeto: { reasons: [] }, consensus: { direction: "POSITIVE", eligibleStrategies: 1 }, historyCompleteness: { complete: false }
  });
  assert.equal(partial.action, "WAIT");
  assert.equal(partial.dataGate, "FAILED");
  const noConsensus = buildShadowDecision({
    symbol: "AAA", position: { quantity: 10, quantityAvailableForTrading: 10, marketValue: 100 }, totalValue: 1_000,
    riskVeto: { reasons: [] }, consensus: { direction: "NO_CONSENSUS", eligibleStrategies: 0 }, historyCompleteness: { complete: true }
  });
  assert.equal(noConsensus.action, "WAIT");
});

test("concentration calculation remains non-actionable when execution history is partial", () => {
  const decision = buildShadowDecision({
    symbol: "AAA", position: { quantity: 40, quantityAvailableForTrading: 40, marketValue: 400 }, totalValue: 1_000,
    riskVeto: { reasons: [{ code: "SEVERE_CONCENTRATION", limitPercent: 20, message: "Holding weight 40.00% is above the 20% configured review threshold." }] },
    consensus: { direction: "NO_CONSENSUS", eligibleStrategies: 0 }, historyCompleteness: { complete: false, reason: "CURSOR_LOOP" }
  });
  assert.equal(decision.action, "WAIT");
  assert.equal(decision.quantity, 0);
  assert.equal(decision.riskOnlyCalculation.sizing.targetWeightPercent, 16);
});

test("corporate actions never become chart buy or sell markers", () => {
  const markers = tradeMarkers([
    { id: "trade", symbol: "AAA", side: "BUY", filledQuantity: 1, price: 10, filledValue: 10, filledAt: "2026-01-01", isTrade: true },
    { id: "split", symbol: "AAA", side: "BUY", filledQuantity: 2, price: 0, filledValue: 0, filledAt: "2026-01-02", isTrade: false }
  ], "AAA");
  assert.equal(markers.length, 1);
  assert.equal(markers[0].id, "trade");
});

test("cost-aware validation is chronological and never promotes a pattern", () => {
  const bars = Array.from({ length: 180 }, (_, index) => ({
    time: new Date(Date.UTC(2025, 0, index + 1)).toISOString(),
    open: 100 + index * 0.4,
    high: 101 + index * 0.4,
    low: 99 + index * 0.4,
    close: 100.5 + index * 0.4,
    volume: 1_000 + index
  }));
  const pattern = PATTERN_SPECS.find((item) => item.id === "sma-trend-cross");
  const result = validatePattern(pattern, bars, { interval: "1D" });
  assert.equal(result.split.method, "expanding-window-walk-forward");
  assert.equal(result.folds.length, 3);
  assert.equal(result.split.randomShuffle, false);
  assert.equal(result.execution.futureDataUsed, false);
  assert.equal(result.maturityEffect, "NONE_WITHOUT_SHADOW_AND_HUMAN_APPROVAL");
  assert.equal(result.costs.version, "vigilalpha.costs.2026-10-08");
});

test("shadow learning store is sanitized, mode 0600 and cannot auto-promote", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-shadow-"));
  const store = new ShadowLearningStore({ env: { VIGILALPHA_STATE_DIR: directory }, now: () => Date.parse("2026-10-08T00:00:00Z") });
  await store.append({
    contractVersion: "test", symbol: "AAA", action: "WAIT", quantity: 0,
    privateFixtureMarker: "SYNTHETIC_PRIVATE_FIELD",
    triggerConditions: ["wait"], invalidationConditions: []
  });
  const records = await store.readAll();
  const raw = JSON.stringify(records);
  assert.doesNotMatch(raw, /privateFixtureMarker|SYNTHETIC_PRIVATE_FIELD/);
  assert.equal(((await stat(store.file())).mode & 0o777).toString(8), "600");
  const review = await store.review();
  assert.equal(review.autoPromotion, false);
  assert.equal(review.promotionGate.humanApprovalRequired, true);
});

test("20 and 60 session outcomes append without rewriting the shadow decision", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-outcomes-"));
  const store = new ShadowLearningStore({ env: { VIGILALPHA_STATE_DIR: directory }, now: () => Date.parse("2026-04-01T00:00:00Z") });
  await store.append({
    contractVersion: "test", symbol: "AAA", action: "REDUCE", quantity: 1,
    dataGate: "PASSED", sourceCutoff: "2026-01-01T00:00:00Z", reference: { price: 100, currency: "USD", portfolioWeightPercent: 30 },
    triggerConditions: ["risk"], invalidationConditions: []
  });
  const bars = Array.from({ length: 65 }, (_, index) => ({
    time: new Date(Date.UTC(2026, 0, index + 2)).toISOString(),
    close: 100 - index * 0.25
  }));
  const load = async () => ({ bars, interval: "1D", currency: "USD", currencySource: "provider" });
  const added = await store.evaluatePending(load);
  assert.deepEqual(added.map((item) => item.horizonSessions), [20, 60]);
  assert.ok(added.every((item) => item.actionAlignedReturn > 0));
  const records = await store.readAll();
  assert.equal(records.filter((item) => item.recordType === "decision").length, 1);
  assert.equal(records.filter((item) => item.recordType === "outcome").length, 2);
  assert.equal((await store.evaluatePending(load)).length, 0);
});

test("image evidence stays illustrative until axes, timeframe and numeric triggers are resolved", () => {
  const illustrative = createChartAnnotation({ sourceId: "source-1", imageLocator: "page-4", ocrLabels: ["buy"] });
  assert.equal(illustrative.status, "ILLUSTRATIVE");
  assert.equal(illustrative.canTriggerDecision, false);
  const candidate = createChartAnnotation({
    sourceId: "source-1", imageLocator: "page-4", timeframe: "daily",
    axis: { time: "date", price: "USD" }, triggerRules: ["close > prior 20-day high"]
  });
  assert.equal(candidate.status, "RECONSTRUCTABLE_CANDIDATE");
  assert.equal(candidate.canTriggerDecision, false);
});

test("event and promotion contracts prohibit hindsight and automatic financial activation", () => {
  assert.throws(() => createEventObservation({
    symbol: "AAA", eventType: "earnings", knownAt: "2026-02-01", observedAt: "2026-01-01", sourceId: "s", summary: "late fact"
  }), /knownAt/);
  const learning = createLearningCandidate({ id: "c1", patternId: "sma-trend-cross", sourceIds: ["s1"] });
  assert.equal(learning.productionWeight, 0);
  assert.throws(() => createStrategyPromotionDecision({ candidateId: "c1", decidedAt: "2026-10-08", approved: true, reason: "test" }), /human approval/i);
  const approved = createStrategyPromotionDecision({ candidateId: "c1", decidedAt: "2026-10-08", approved: true, humanApproval: true, reason: "approved for another shadow version" });
  assert.equal(approved.changesRuntimeAutomatically, false);
  assert.equal(approved.decision, "APPROVED_FOR_NEW_SHADOW_VERSION");
});
