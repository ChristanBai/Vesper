import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, lstat, rm, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { exportResearchNotebook, researchNotebook } from "../src/vigilalpha/research-notebook.mjs";
import { createToolRuntime, TOOL_DEFINITIONS } from "../src/mcp/tools.mjs";

test("research notebook works without credentials, account initialization or financial activation", async () => {
  const result = await createToolRuntime({ env: {} }).call("research_notebook");
  assert.equal(result.mode, "RESEARCH_ONLY");
  assert.equal(result.runtimeImport, false);
  assert.equal(result.automaticLearning, "PAUSED");
  assert.equal(result.candidates.length, 4);
  assert.ok(result.candidates.every((candidate) => candidate.productionWeight === 0 && candidate.sources.length));
  assert.equal(TOOL_DEFINITIONS.find((tool) => tool.name === "research_notebook").annotations.readOnlyHint, true);
});

test("notebook export preserves existing notes, refuses symlinks and records missing experiments", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-notebook-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "research");
  const result = await exportResearchNotebook(directory);
  assert.equal(result.files, 6);
  const before = await readFile(path.join(directory, "INDEX.md"), "utf8");
  assert.match(before, /PAUSED/);
  const candidate = await readFile(path.join(directory, "sma-trend-cross.md"), "utf8");
  assert.match(candidate, /NOT_RUN/);
  assert.match(candidate, /counter-hypothesis/);
  assert.equal((await lstat(path.join(directory, "registry.json"))).mode & 0o777, 0o600);
  await assert.rejects(exportResearchNotebook(directory), { code: "EEXIST" });
  assert.equal(await readFile(path.join(directory, "INDEX.md"), "utf8"), before);
  const link = path.join(root, "link");
  await symlink(directory, link);
  await assert.rejects(exportResearchNotebook(link), { code: "EEXIST" });
  await assert.rejects(exportResearchNotebook("relative"), /absolute path/);
  const changed = researchNotebook(); changed.candidates[0].failures.push("changed");
  assert.ok(!researchNotebook().candidates[0].failures.includes("changed"));
});
