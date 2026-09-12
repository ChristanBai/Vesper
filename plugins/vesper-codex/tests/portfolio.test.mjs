import test from "node:test";
import assert from "node:assert/strict";
import {
  mapOrders,
  mapPies,
  mapPositions,
  mapSummary,
  normalizeTicker,
  reconcilePositionsAndPies
} from "../src/core/portfolio.mjs";

test("maps Trading 212 summary and positions", () => {
  const summary = mapSummary({
    currency: "GBP",
    totalValue: 303.79,
    cash: { availableToTrade: 0, inPies: 94.44, reservedForOrders: 0 },
    investments: { currentValue: 209.35, unrealizedProfitLoss: 4.98, realizedProfitLoss: -18.36 }
  });
  const positions = mapPositions([{
    instrument: { ticker: "AAPL_US_EQ" },
    quantity: 1.25,
    averagePricePaid: 100,
    currentPrice: 110,
    quantityAvailableForTrading: 0,
    walletImpact: { unrealizedProfitLoss: 12.5 }
  }]);

  assert.equal(summary.totalValue, 303.79);
  assert.equal(summary.reservedCash, 94.44);
  assert.equal(positions[0].symbol, "AAPL");
  assert.equal(positions[0].marketValue, 137.5);
});

test("reconciles Pies to real positions and reports mismatches", () => {
  const positions = mapPositions([
    { instrument: { ticker: "AAPL_US_EQ" }, quantity: 10, averagePricePaid: 1, currentPrice: 1, quantityAvailableForTrading: 10, walletImpact: {} },
    { instrument: { ticker: "MSFT_US_EQ" }, quantity: 3, averagePricePaid: 1, currentPrice: 1, quantityAvailableForTrading: 3, walletImpact: {} }
  ]);
  const pies = mapPies([{
    id: 1,
    name: "Core",
    instruments: [
      { ticker: "AAPL_US_EQ", quantity: 10, ownedQuantity: 9 },
      { ticker: "MSFT_US_EQ", quantity: 2, ownedQuantity: 2 }
    ]
  }]);
  const reconciliation = reconcilePositionsAndPies(positions, pies);

  assert.equal(reconciliation.status, "ATTENTION");
  assert.equal(reconciliation.pies[0].instruments[0].status, "VERIFIED");
  assert.equal(reconciliation.pies[0].instruments[1].status, "MISMATCH");
  assert.equal(reconciliation.pies[0].instruments[1].difference, 1);
});

test("normalizes tickers and maps filled orders", () => {
  assert.equal(normalizeTicker("VUSA_L_EQ"), "VUSA.L");
  assert.equal(normalizeTicker("DEMOl_EQ"), "DEMO.L");
  assert.equal(normalizeTicker("ASML_AS_EQ"), "ASML.AS");
  const orders = mapOrders([{
    id: 42,
    ticker: "AAPL_US_EQ",
    side: "BUY",
    filledQuantity: 3,
    status: "FILLED",
    filledValue: 304.5,
    fill: {
      quantity: 3,
      price: 101.5,
      filledAt: "2026-09-01T10:00:00Z"
    }
  }]);

  assert.equal(orders[0].symbol, "AAPL");
  assert.equal(orders[0].filledValue, 304.5);
});

test("uses account-currency wallet values for pence-listed positions", () => {
  const [position] = mapPositions([{
    instrument: { ticker: "TESTl_EQ", name: "Test PLC", currency: "GBX" },
    quantity: 2.5,
    averagePricePaid: 1580,
    currentPrice: 1552,
    quantityAvailableForTrading: 0,
    walletImpact: {
      currency: "GBP",
      totalCost: 39.83,
      currentValue: 39.13,
      unrealizedProfitLoss: -0.7
    }
  }]);

  assert.equal(position.instrumentCurrency, "GBX");
  assert.equal(position.costBasis, 39.83);
  assert.equal(position.marketValue, 39.13);
  assert.equal(position.unrealizedPnLPercent, -0.7 / 39.83);
});
