import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeJson } from "../src/core/config.mjs";

test("replaces the previous cache and removes stale temporary files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vesper-cache-"));
  const file = path.join(directory, "cache.json");
  await writeFile(file, JSON.stringify({ version: 1 }));
  await writeFile(`${file}.999.tmp`, JSON.stringify({ version: 2 }));

  await writeJson(file, { version: 3 });

  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), { version: 3 });
  assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith(".tmp")), []);
});
