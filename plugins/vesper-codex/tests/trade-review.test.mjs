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
});

test("trade review keeps read-only execution history separate from positions", () => {
  const review = calculateTradeReview(orders, [{ symbol: "AAPL", unrealizedPnL: 20 }], "AAPL");
  assert.equal(review.tradeCount, 2);
  assert.equal(review.buyCount, 1);
  assert.equal(review.sellCount, 1);
  assert.equal(review.totalInvested, 200);
  assert.equal(review.totalRecovered, 120);
  assert.equal(review.unrealizedPnL, 20);
});
