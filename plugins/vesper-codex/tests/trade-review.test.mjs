import test from "node:test";
import assert from "node:assert/strict";
import { calculateTradeReview, tradeMarkers } from "../src/runtime.mjs";

const orders = [
  {
    id: "buy-1",
    symbol: "AAPL",
    side: "BUY",
    filledQuantity: 2,
    price: 100,
    filledValue: 200,
    orderedAt: "2026-09-01T10:00:00.000Z",
    filledAt: "2026-09-01T10:00:01.000Z"
  },
  {
    id: "sell-1",
    symbol: "AAPL",
    side: "SELL",
    filledQuantity: 1,
    price: 120,
    filledValue: 120,
    orderedAt: "2026-09-10T10:00:00.000Z",
    filledAt: "2026-09-10T10:00:01.000Z"
  }
];

test("creates chart markers for both buys and sells", () => {
  const markers = tradeMarkers(orders, "AAPL");
  assert.deepEqual(markers.map((marker) => marker.side), ["BUY", "SELL"]);
  assert.deepEqual(markers.map((marker) => marker.price), [100, 120]);
  assert.deepEqual(markers.map((marker) => marker.positionBefore), [0, 2]);
  assert.deepEqual(markers.map((marker) => marker.positionAfter), [2, 1]);
  assert.equal(markers[0].source, "trading212");
});

test("trade review keeps read-only execution history separate from positions", () => {
  const review = calculateTradeReview(orders, [{ symbol: "AAPL", unrealizedPnL: 20 }], "AAPL");
  assert.equal(review.tradeCount, 2);
  assert.equal(review.buyCount, 1);
  assert.equal(review.sellCount, 1);
  assert.equal(review.totalInvested, 200);
  assert.equal(review.totalRecovered, 120);
  assert.equal(review.unrealizedPnL, 20);
  assert.equal(review.realizedPnLSource, "LOCAL_FIFO_ESTIMATE");
});

test("trade review prefers broker wallet impact and reports net cash and explicit costs", () => {
  const withWalletImpact = [
    { ...orders[0], netValue: -201, fees: 0.5, taxes: 0.5 },
    { ...orders[1], netValue: 118, fees: 0.5, taxes: 1.5, realisedProfitLoss: 17 }
  ];
  const review = calculateTradeReview(withWalletImpact, [{ symbol: "AAPL", unrealizedPnL: 20 }], "AAPL");
  assert.equal(review.totalInvestedNet, 201);
  assert.equal(review.totalRecoveredNet, 118);
  assert.equal(review.totalExplicitCosts, 3);
  assert.equal(review.realizedPnL, 17);
  assert.equal(review.realizedPnLSource, "TRADING212_WALLET_IMPACT");
});

test("partial broker realised PnL falls back to the complete local FIFO estimate", () => {
  const mixed = [
    orders[0],
    { ...orders[1], realisedProfitLoss: 20 },
    { ...orders[1], id: "sell-2", filledQuantity: 0.5, filledValue: 65, price: 130, filledAt: "2026-09-11T10:00:01.000Z", realisedProfitLoss: null }
  ];
  const review = calculateTradeReview(mixed, [{ symbol: "AAPL", unrealizedPnL: 0 }], "AAPL");
  assert.equal(review.realizedPnLSource, "LOCAL_FIFO_ESTIMATE");
  assert.equal(review.realizedPnL, 35);
});
