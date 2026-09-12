import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("MCP stdio server initializes and advertises all Vesper tools", async (t) => {
  const state = await mkdtemp(path.join(os.tmpdir(), "vesper-mcp-"));
  const child = spawn(process.execPath, ["scripts/vesper-mcp.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      VESPER_STATE_DIR: state,
      T212_API_KEY: "",
      T212_API_SECRET: "",
      FINNHUB_API_KEY: "",
      VESPER_DISABLE_KEYCHAIN: "1"
    },
    stdio: ["pipe", "pipe", "pipe"]
  });
  t.after(() => {
    if (!child.killed) child.kill("SIGKILL");
  });
  const responses = new Map();
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let boundary = buffer.indexOf("\n");
    while (boundary >= 0) {
      const line = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 1);
      if (line) {
        const message = JSON.parse(line);
        if (message.id !== undefined) responses.set(message.id, message);
      }
      boundary = buffer.indexOf("\n");
    }
  });

  write(child, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } }
  });
  const initialized = await waitFor(responses, 1);
  assert.equal(initialized.result.serverInfo.name, "vesper-codex");
  assert.match(initialized.result.instructions, /read-only/i);
  assert.match(initialized.result.instructions, /cannot place/i);

  write(child, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const tools = await waitFor(responses, 2);
  const names = tools.result.tools.map((tool) => tool.name);
  for (const required of ["setup", "start_vesper", "holdings", "pies", "trades", "quote", "history", "dashboard", "news", "analysis", "backtest", "report", "daily_brief", "order_history"]) {
    assert.ok(names.includes(required), `missing ${required}`);
  }
  for (const forbidden of ["order_preview", "order_place", "order_cancel"]) {
    assert.ok(!names.includes(forbidden), `unexpected write tool ${forbidden}`);
  }

  write(child, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "setup", arguments: {} } });
  const setup = await waitFor(responses, 3);
  assert.equal(setup.result.structuredContent.credentials.configured, false);
  assert.match(setup.result.structuredContent.instructions, /setup.mjs/);

  write(child, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "start_vesper", arguments: { port: 18989 } } });
  const started = await waitFor(responses, 4);
  assert.equal(started.result.structuredContent.ready, false);
  assert.equal(started.result.structuredContent.credentialSource, "missing");
  assert.match(started.result.structuredContent.instructions, /macOS Keychain/);

  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
});

function write(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

async function waitFor(responses, id, timeoutMs = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (responses.has(id)) return responses.get(id);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for MCP response ${id}`);
}
