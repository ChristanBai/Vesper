import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { appendAudit } from "../src/core/audit.mjs";
import { ensureStateDirectory, readConfig, updateConfig, writeJson } from "../src/core/config.mjs";

test("replaces the previous cache and removes stale temporary files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vesper-cache-"));
  const file = path.join(directory, "cache.json");
  await writeFile(file, JSON.stringify({ version: 1 }));
  await writeFile(`${file}.999.tmp`, JSON.stringify({ version: 2 }));

  await writeJson(file, { version: 3 });

  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), { version: 3 });
  assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith(".tmp")), []);
});

test("VigilAlpha config permanently disables cloud sync", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-config-"));
  const env = { VIGILALPHA_STATE_DIR: directory };
  await updateConfig({ cloud: { url: "https://example.invalid", syncEnabled: true } }, env);
  const config = await readConfig(env);
  assert.deepEqual(config.cloud, { url: null, syncEnabled: false });
  assert.equal(config.readOnly, true);
});

test("repairs an existing state directory to owner-only permissions", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-permissions-"));
  await chmod(directory, 0o755);

  await ensureStateDirectory({ VIGILALPHA_STATE_DIR: directory });

  assert.equal((await stat(directory)).mode & 0o777, 0o700);
});

test("repairs an existing audit file to owner-only permissions", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-audit-permissions-"));
  const file = path.join(directory, "audit.jsonl");
  await writeFile(file, '{"type":"old"}\n', { mode: 0o644 });
  await chmod(file, 0o644);

  await appendAudit({ type: "permission_check" }, { VIGILALPHA_STATE_DIR: directory });

  assert.equal((await stat(file)).mode & 0o777, 0o600);
});
