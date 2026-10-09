import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveOverview,
  derivePositionLedger,
  filterPositions,
  summarizePerformance
} from "../dashboard/analytics.js";

test("calculates today's P&L in account currency from position market values", () => {
  const overview = deriveOverview({
    summary: { currency: "GBP", totalValue: 11_000 },
    positions: [
      { symbol: "NVDA", name: "NVIDIA", quantity: 10, marketValue: 1_000, accountCurrency: "GBP" },
      { symbol: "MSFT", name: "Microsoft", quantity: 5, marketValue: 2_000, accountCurrency: "GBP" }
    ]
  }, {
    items: {
      NVDA: { symbol: "NVDA", price: 100, changePercent: 0.01, currency: "USD" },
      MSFT: { symbol: "MSFT", price: 200, changePercent: -0.02, currency: "USD" }
    }
  });

  assert.ok(Math.abs(overview.dailyPnL - (1_000 * 0.01 / 1.01 - 2_000 * 0.02 / 0.98)) < 0.000001);
  assert.equal(overview.largestGain.symbol, "NVDA");
  assert.equal(overview.largestLoss.symbol, "MSFT");
});

test("combines realized P&L from sync review into the position ledger", () => {
  const positions = derivePositionLedger({
    summary: { totalValue: 150 },
    positions: [{
      symbol: "AAPL",
      quantity: 1,
      marketValue: 100,
      costBasis: 90,
      unrealizedPnL: 10,
      averagePricePaid: 90,
      currentPrice: 100
    }],
    tradeReview: [{ symbol: "AAPL", realizedPnL: 25 }]
  });

  assert.equal(positions[0].realizedPnL, 25);
  assert.equal(positions[0].totalReturn, 35 / 90);
});

test("filters and summarizes persisted portfolio snapshots", () => {
  const positions = filterPositions([
    { symbol: "AAPL", name: "Apple", assetClass: "Stock", unrealizedPnL: 2, marketValue: 100 },
    { symbol: "VUSA.L", name: "Vanguard ETF", assetClass: "ETF", unrealizedPnL: -1, marketValue: 200 }
  ], { filter: "etf" });
  assert.deepEqual(positions.map((position) => position.symbol), ["VUSA.L"]);

  const summary = summarizePerformance([
    { at: "2026-08-01T00:00:00Z", totalValue: 100, currency: "GBP" },
    { at: "2026-09-01T00:00:00Z", totalValue: 110, currency: "GBP" }
  ]);
  assert.equal(summary.change, 10);
  assert.equal(summary.returnPct, 0.1);
});
