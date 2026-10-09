import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readConfig } from "../src/core/config.mjs";
import { createToolRuntime } from "../src/mcp/tools.mjs";

async function runtime() {
  const state = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-preferences-"));
  const env = { ...process.env, VIGILALPHA_STATE_DIR: state, VESPER_DISABLE_KEYCHAIN: "1" };
  return { tools: createToolRuntime({ env }), env };
}

test("app-only preferences validate, version and preserve unrelated custom risk limits", async () => {
  const { tools, env } = await runtime();
  await tools.call("configure_preferences", { maxPositionWeightPercent: 27 });
  const changed = await tools.call("configure_preferences", { fastPeriod: 8, slowPeriod: 30 });
  assert.equal(changed.config.parameterValidation, "user_modified_unvalidated");
  assert.match(changed.config.parameterVersion, /^vigilalpha\.user\./);
  assert.equal(changed.config.riskLimits.maxPositionWeightPercent, 27);
  assert.deepEqual(changed.config.strategyParameters.trend, { fastPeriod: 8, slowPeriod: 30 });
  assert.ok(changed.differences.some((item) => item.field === "trend.fastPeriod"));
});

test("invalid preference relationships are rejected without changing the saved config", async () => {
  const { tools, env } = await runtime();
  const before = await readConfig(env);
  await assert.rejects(
    () => tools.call("configure_preferences", { fastPeriod: 50, slowPeriod: 20 }),
    /fastPeriod must be lower/
  );
  const after = await readConfig(env);
  assert.deepEqual(after, before);
});

test("preference reset restores the complete official default set", async () => {
  const { tools } = await runtime();
  await tools.call("configure_preferences", {
    profile: "growth",
    maxPositionWeightPercent: 35,
    fastPeriod: 8,
    slowPeriod: 30
  });
  const reset = await tools.call("configure_preferences", { reset: true });
  assert.equal(reset.config.riskProfile, "balanced");
  assert.equal(reset.config.parameterValidation, "official_default");
  assert.deepEqual(reset.config.strategyParameters.trend, { fastPeriod: 20, slowPeriod: 50 });
  assert.equal(reset.config.riskLimits.maxPositionWeightPercent, 20);
});
