import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fetchAllPages, PortfolioSyncService } from "../src/core/sync-service.mjs";

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
  assert.equal(snapshot.performanceHistory.length, 1);
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

test("history pagination continues beyond the old fixed cap", async () => {
  const fetched = [];
  const result = await fetchAllPages({
    fetchPage: async (cursor) => {
      const page = cursor ? Number(cursor) : 0;
      fetched.push(page);
      return { items: [{ id: page }], nextPagePath: page < 6 ? String(page + 1) : null };
    },
    normalizePage: (value) => value
  });
  assert.deepEqual(fetched, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(result.completeness.complete, true);
  assert.equal(result.items.length, 7);
});

test("history pagination detects cursor loops instead of claiming completeness", async () => {
  const result = await fetchAllPages({
    fetchPage: async () => ({ items: [{ id: 1 }], nextPagePath: "same" }),
    normalizePage: (value) => value
  });
  assert.equal(result.completeness.complete, false);
  assert.equal(result.completeness.reason, "CURSOR_LOOP");
});

test("a failed refresh never relabels cached account facts with the current attempt time", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-stale-cache-"));
  let now = Date.parse("2026-10-01T00:00:00Z");
  const client = new FakeClient();
  const service = new PortfolioSyncService({ client, env: { VESPER_STATE_DIR: directory }, now: () => now });
  const baseline = await service.getSnapshot({ force: true, full: true });
  assert.equal(baseline.syncedAt, "2026-10-01T00:00:00.000Z");
  now = Date.parse("2026-10-09T00:00:00Z");
  client.accountSummary = async () => { throw new Error("network unavailable"); };
  const refreshed = await service.getSnapshot({ force: true, full: true });
  assert.equal(refreshed.status, "PARTIAL");
  assert.equal(refreshed.lastAttemptAt, "2026-10-09T00:00:00.000Z");
  assert.equal(refreshed.syncedAt, "2026-10-01T00:00:00.000Z");
  assert.equal(refreshed.sectionSyncedAt.positions, "2026-10-09T00:00:00.000Z");
});

test("manual refresh and full refresh bypass every section TTL", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-force-"));
  const client = new FakeClient();
  let calls = 0;
  const orders = client.orders.bind(client);
  client.orders = async () => { calls += 1; return orders(); };
  let now = Date.parse("2026-10-24T00:00:00Z");
  const service = new PortfolioSyncService({ client, env: { VESPER_STATE_DIR: directory }, now: () => now });
  await service.getSnapshot();
  now += 1000;
  await service.getSnapshot();
  assert.equal(calls, 1);
  const refreshed = await service.getSnapshot({ force: true });
  assert.equal(calls, 2);
  assert.equal(refreshed.sectionSyncedAt.orders, new Date(now).toISOString());
  now += 1000;
  await service.getSnapshot({ full: true });
  assert.equal(calls, 3);
});

test("manual refresh queues behind a weaker in-flight request", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-refresh-queue-"));
  const service = new PortfolioSyncService({ client: new FakeClient(), env: { VESPER_STATE_DIR: directory } });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const options = [];
  service.loadSnapshot = async (value) => {
    options.push(value);
    if (options.length === 1) await gate;
    return { refreshed: Boolean(value.force || value.full) };
  };
  const weak = service.getSnapshot();
  const strong = service.getSnapshot({ force: true });
  const secondStrong = service.getSnapshot({ full: true });
  release();
  assert.equal((await weak).refreshed, false);
  assert.equal((await strong).refreshed, true);
  assert.equal((await secondStrong).refreshed, true);
  assert.equal(options.length, 2);
});

test("manual refresh respects order-history backoff and preserves its timestamp", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-refresh-backoff-"));
  let now = Date.parse("2026-10-24T00:00:00Z");
  const client = new FakeClient();
  const service = new PortfolioSyncService({ client, env: { VESPER_STATE_DIR: directory }, now: () => now });
  await service.getSnapshot();
  const original = new Date(now).toISOString();
  let calls = 0;
  client.orders = async () => {
    calls += 1;
    throw Object.assign(new Error("rate limited"), { status: 429, retryAfterMs: 60000 });
  };
  now += 1000;
  await service.getSnapshot({ force: true });
  now += 1000;
  const snapshot = await service.getSnapshot({ force: true });
  assert.equal(calls, 1);
  assert.equal(snapshot.sectionSyncedAt.orders, original);
  assert.equal(snapshot.historyCompleteness.orders.complete, false);
  assert.equal(snapshot.sectionSyncedAt.positions, new Date(now).toISOString());
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
