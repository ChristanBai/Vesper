import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolioBrief } from "../src/analysis/portfolio-brief.mjs";

test("builds a read-only portfolio brief with concentration and contribution", () => {
  const brief = buildPortfolioBrief({
    generatedAt: "2026-09-12T00:00:00.000Z",
    snapshot: {
      status: "SYNCED",
      syncedAt: "2026-09-12T00:00:00.000Z",
      summary: {
        currency: "GBP",
        totalValue: 1000,
        availableCash: 200,
        investedValue: 800,
        unrealizedPnL: 100,
        realizedPnL: -20
      },
      positions: [
        { symbol: "A", marketValue: 500, costBasis: 450, unrealizedPnL: 50, quantity: 1, averagePricePaid: 450 },
        { symbol: "B", marketValue: 300, costBasis: 250, unrealizedPnL: 50, quantity: 1, averagePricePaid: 250 }
      ],
      orders: [],
      reconciliation: { status: "VERIFIED" },
      errors: []
    }
  });

  assert.equal(brief.concentration.positionCount, 2);
  assert.equal(brief.concentration.topOneWeightPercent, 50);
  assert.equal(brief.concentration.topFiveWeightPercent, 80);
  assert.equal(brief.topContributors[0].symbol, "A");
  assert.match(brief.markdown, /Vesper Daily Brief/);
  assert.match(brief.markdown, /read-only|RISK|Risk/);
});

test("flags a concentrated portfolio without creating trade instructions", () => {
  const brief = buildPortfolioBrief({
    snapshot: {
      status: "SYNCED",
      summary: { currency: "GBP", totalValue: 100, availableCash: 0 },
      positions: [
        { symbol: "ONLY", marketValue: 100, costBasis: 80, unrealizedPnL: 20, quantity: 1, averagePricePaid: 80 }
      ],
      orders: [],
      reconciliation: { status: "VERIFIED" },
      errors: []
    }
  });

  assert.ok(brief.riskSignals.some((signal) => signal.code === "POSITION_WEIGHT"));
  assert.doesNotMatch(brief.markdown, /\bBUY\b|\bSELL\b/);
});
