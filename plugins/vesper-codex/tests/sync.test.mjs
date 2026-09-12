import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PortfolioSyncService } from "../src/core/sync-service.mjs";

test("sync service maps account data and writes recoverable cache", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vesper-sync-"));
  const client = new FakeClient();
  const service = new PortfolioSyncService({ client, env: { VESPER_STATE_DIR: directory }, now: () => Date.parse("2026-09-12T12:00:00Z") });
  const snapshot = await service.getSnapshot({ force: true, full: true });

  assert.equal(snapshot.status, "SYNCED");
  assert.equal(snapshot.positions.length, 1);
  assert.equal(snapshot.orders.length, 1);
  assert.equal(snapshot.reconciliation.status, "VERIFIED");
  assert.equal(snapshot.tradeReview.length, 1);
  assert.equal(snapshot.allocation[0].weightPercent, 75);
});

test("sync service explains the read-only permission needed for order history", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vesper-sync-orders-"));
  const client = new FakeClient();
  client.orders = async () => {
    const error = new Error("Trading 212 API returned HTTP 404");
    error.status = 404;
    throw error;
  };
  const service = new PortfolioSyncService({ client, env: { VESPER_STATE_DIR: directory } });
  const snapshot = await service.getSnapshot({ force: true, full: true });
  const orderError = snapshot.errors.find((error) => error.section === "orders");

  assert.equal(orderError.status, 404);
  assert.match(orderError.userAction, /retry/i);
});

class FakeClient {
  async accountSummary() {
    return {
      currency: "GBP",
      totalValue: 200,
      cash: { availableToTrade: 50, inPies: 0, reservedForOrders: 0 },
      investments: { currentValue: 150, unrealizedProfitLoss: 10, realizedProfitLoss: -2 }
    };
  }

  async cash() {
    return { availableToTrade: 50, inPies: 0, reservedForOrders: 0 };
  }

  async positions() {
    return [{
      instrument: { ticker: "AAPL_US_EQ" },
      quantity: 1,
      averagePricePaid: 140,
      currentPrice: 150,
      quantityAvailableForTrading: 1,
      walletImpact: { unrealizedProfitLoss: 10 }
    }];
  }

  async pies() {
    return [{
      id: 7,
      name: "Core",
      instruments: [{ ticker: "AAPL_US_EQ", quantity: 1, ownedQuantity: 1 }]
    }];
  }

  async orders() {
    return {
      items: [{
        order: {
          id: 1,
          ticker: "AAPL_US_EQ",
          side: "BUY",
          quantity: 1,
          filledQuantity: 1,
          fillPrice: 140,
          filledValue: 140,
          status: "FILLED",
          filledAt: "2026-09-01T10:00:00Z"
        }
      }],
      nextPagePath: null
    };
  }

  async transactions() {
    return { items: [], nextPagePath: null };
  }
}
