import test from "node:test";
import assert from "node:assert/strict";
import { T212Client, throttleIntervalMs } from "../src/core/t212-client.mjs";

test("Trading 212 client only exposes read paths under the versioned API base", async () => {
  const calls = [];
  const client = new T212Client({
    apiKey: "key",
    apiSecret: "secret",
    environment: "live",
    minimumIntervalMs: 0,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  await client.accountSummary();
  await client.positions();
  await client.transactions();

  assert.equal(calls[0].url, "https://live.trading212.com/api/v0/equity/account/summary");
  assert.equal(calls[1].url, "https://live.trading212.com/api/v0/equity/positions");
  assert.match(calls[2].url, /https:\/\/live\.trading212\.com\/api\/v0\/equity\/history\/transactions/);
  assert.equal(calls[0].options.headers.Authorization, `Basic ${Buffer.from("key:secret").toString("base64")}`);
  assert.equal(calls.every((call) => String(call.options.method || "GET").toUpperCase() === "GET"), true);
  assert.equal(client.placeMarketOrder, undefined);
  assert.equal(client.placeLimitOrder, undefined);
  assert.equal(client.cancelOrder, undefined);
  await assert.rejects(
    () => client.request(new URL("https://live.trading212.com/api/v0/equity/orders/market"), { method: "POST" }),
    /read-only/
  );
});

test("uses endpoint-specific Trading 212 rate limits", () => {
  assert.equal(throttleIntervalMs("/equity/account/summary"), 5_100);
  assert.equal(throttleIntervalMs("/equity/positions"), 1_100);
  assert.equal(throttleIntervalMs("/equity/history/orders"), 1_300);
  assert.equal(throttleIntervalMs("/equity/metadata/instruments"), 1_100);
});

test("resolves Trading 212 pagination paths without duplicating the API prefix", () => {
  const client = new T212Client({ apiKey: "key", apiSecret: "secret", environment: "live" });
  assert.equal(
    client.resolve("/api/v0/equity/history/orders?limit=50&cursor=123").toString(),
    "https://live.trading212.com/api/v0/equity/history/orders?limit=50&cursor=123"
  );
});
