import test from "node:test";
import assert from "node:assert/strict";
import { MarketService } from "../src/market/market-service.mjs";

test("falls back to Nasdaq daily bars when Yahoo history is unavailable", async () => {
  const calls = [];
  const service = new MarketService({
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).includes("query1.finance.yahoo.com")) {
        return new Response("blocked", { status: 403 });
      }
      return new Response(JSON.stringify({
        data: {
          chart: [
            { x: 1789084800000, y: 101, z: { open: "100", high: "102", low: "99", close: "101", volume: "1,000" } },
            { x: 1789171200000, y: 103, z: { open: "101", high: "104", low: "100", close: "103", volume: "1,200" } }
          ]
        }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  const history = await service.history("AAPL", "1M");
  assert.equal(history.source, "Nasdaq");
  assert.equal(history.bars.length, 2);
  assert.equal(history.bars[1].close, 103);
  assert.match(calls[0], /query1\.finance\.yahoo\.com/);
  assert.match(calls[1], /api\.nasdaq\.com/);
});

test("does not send UK symbols to the Nasdaq US fallback", async () => {
  const calls = [];
  const service = new MarketService({
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).includes("query1.finance.yahoo.com")) {
        return new Response("blocked", { status: 403 });
      }
      throw new Error(`Unexpected request: ${url}`);
    }
  });

  await assert.rejects(() => service.history("DEMO.L", "1M"), /Nasdaq history fallback is only available for US symbols/);
  assert.equal(calls.length, 1);
});

test("uses Twelve Data for intraday 10-minute bars when configured", async () => {
  const calls = [];
  const service = new MarketService({
    env: {},
    twelveDataKey: "test-key",
    fetchImpl: async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({
        meta: { symbol: "WISE", currency: "GBP", exchange: "LSE" },
        values: [
          { datetime: "2026-09-12 10:00:00", open: "10", high: "11", low: "9.5", close: "10.5", volume: "1000" },
          { datetime: "2026-09-12 10:10:00", open: "10.5", high: "11.2", low: "10.2", close: "11", volume: "1200" }
        ],
        status: "ok"
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  const history = await service.history("DEMO.L", "1D", "10m");
  assert.equal(history.source, "Twelve Data");
  assert.equal(history.interval, "10m");
  assert.equal(history.bars.length, 2);
  assert.match(calls[0], /interval=10min/);
  assert.match(calls[0], /symbol=DEMO%3ALSE/);
});

test("uses Nasdaq fallback for explicit daily bars", async () => {
  const service = new MarketService({
    env: {},
    fetchImpl: async (url) => {
      if (String(url).includes("query1.finance.yahoo.com")) {
        return new Response("blocked", { status: 403 });
      }
      return new Response(JSON.stringify({
        data: {
          chart: [
            { x: 1789084800000, y: 101, z: { open: "100", high: "102", low: "99", close: "101", volume: "1000" } },
            { x: 1789171200000, y: 103, z: { open: "101", high: "104", low: "100", close: "103", volume: "1200" } }
          ]
        }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  const history = await service.history("NVDA", "1Y", "1D");
  assert.equal(history.source, "Nasdaq");
  assert.equal(history.interval, "1D");
  assert.equal(history.bars.length, 2);
});
