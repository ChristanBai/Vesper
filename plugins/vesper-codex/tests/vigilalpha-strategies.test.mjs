import test from "node:test";
import assert from "node:assert/strict";
import { buildConsensus, evaluateStrategies } from "../src/vigilalpha/strategies.mjs";

function bars(count = 140) {
  return Array.from({ length: count }, (_, index) => ({
    time: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    open: 100 + index,
    high: 102 + index,
    low: 99 + index,
    close: 101 + index,
    volume: 1_000 + index
  }));
}

test("six strategies use one contract and experimental strategies have zero consensus weight", () => {
  const review = evaluateStrategies({
    bars: bars(),
    position: { weightPercent: 32 },
    portfolio: { maxPositionWeightPercent: 20 }
  });

  assert.equal(review.strategies.length, 6);
  assert.equal(new Set(review.strategies.map((item) => item.contractVersion)).size, 1);
  for (const strategy of review.strategies.filter((item) => item.maturity === "experimental")) {
    assert.equal(strategy.consensusWeight, 0);
  }
  const concentration = review.strategies.find((item) => item.name === "concentration_position");
  assert.equal(concentration.maturity, "observed");
  assert.equal(concentration.direction, "NEGATIVE");
  assert.equal(review.consensus.direction, "NEGATIVE");
});

test("missing data abstains instead of converting missing values to zero", () => {
  const review = evaluateStrategies({ bars: [] });
  assert.ok(review.strategies.every((item) => item.direction === "INSUFFICIENT_DATA"));
  assert.equal(review.consensus.direction, "NO_CONSENSUS");
});

test("consensus excludes experimental directional results", () => {
  const consensus = buildConsensus([
    { name: "trend", maturity: "experimental", direction: "POSITIVE" },
    { name: "concentration_position", maturity: "observed", direction: "NEUTRAL" }
  ]);
  assert.equal(consensus.direction, "MIXED");
  assert.deepEqual(consensus.excludedExperimental, ["trend"]);
});

test("custom strategy parameters are reported and used without changing maturity", () => {
  const review = evaluateStrategies({
    bars: bars(80),
    parameters: {
      trend: { fastPeriod: 5, slowPeriod: 10 },
      momentum: { period: 7, positiveThreshold: 60, negativeThreshold: 40 },
      meanReversion: { period: 12, deviationPercent: 5 },
      volatilityDrawdown: { annualizedVolatilityPercent: 35 }
    },
    parameterVersion: "vigilalpha.user.test"
  });
  const trend = review.strategies.find((item) => item.name === "trend");
  assert.equal(review.parameterVersion, "vigilalpha.user.test");
  assert.deepEqual(trend.parameters, { fastPeriod: 5, slowPeriod: 10 });
  assert.equal(trend.parametersVersion, "vigilalpha.user.test");
  assert.equal(trend.maturity, "experimental");
  assert.equal(trend.consensusWeight, 0);
});
