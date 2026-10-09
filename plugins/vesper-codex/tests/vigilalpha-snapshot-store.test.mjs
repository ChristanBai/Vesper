import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DerivedSnapshotStore } from "../src/vigilalpha/snapshot-store.mjs";

function snapshot({ value = 100, weightValue = 60, syncedAt = "2026-10-01T00:00:00.000Z" } = {}) {
  return {
    status: "READY",
    syncedAt,
    summary: { currency: "GBP", totalValue: value, availableCash: value - weightValue, unrealizedPnL: 5 },
    positions: [{ symbol: "AAA", marketValue: weightValue, unrealizedPnL: 5 }],
    reconciliation: { status: "VERIFIED" },
    errors: []
  };
}

test("derived snapshots are redacted, mode 0600 and support material comparison", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-store-"));
  let now = Date.parse("2026-10-01T00:00:00.000Z");
  const store = new DerivedSnapshotStore({ env: { VESPER_STATE_DIR: directory }, now: () => now });
  await store.append(snapshot());
  now += 86_400_000;
  await store.append(snapshot({ value: 120, weightValue: 90, syncedAt: "2026-10-02T00:00:00.000Z" }));

  assert.equal((await stat(store.file())).mode & 0o777, 0o600);
  const raw = await readFile(store.file(), "utf8");
  assert.doesNotMatch(raw, /accountId|apiKey|secret/i);
  const changes = await store.changes();
  assert.equal(changes.status, "COMPARED");
  assert.equal(changes.materialChange, true);
  assert.ok(changes.changes.some((change) => change.code === "TOTAL_VALUE"));
  assert.equal(changes.timeline.length, 2);
  assert.deepEqual(Object.keys(changes.timeline[0]).sort(), ["comparisonEligible", "dataQualityStatus", "positionCount", "savedAt", "sourceCutoff", "totalValue", "unrealizedPnL"].sort());
});

test("partial snapshots remain auditable but are excluded from historical comparison", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-partial-"));
  let now = Date.parse("2026-10-01T00:00:00.000Z");
  const store = new DerivedSnapshotStore({ env: { VESPER_STATE_DIR: directory }, now: () => now });
  await store.append(snapshot());
  now += 86_400_000;
  await store.append({ ...snapshot({ value: 999, syncedAt: "2026-10-02T00:00:00.000Z" }), status: "PARTIAL", errors: [{ section: "summary" }] });

  const status = await store.status();
  assert.equal(status.snapshotCount, 2);
  assert.equal(status.comparisonEligibleCount, 1);
  const changes = await store.changes();
  assert.equal(changes.status, "INSUFFICIENT_HISTORY");
  assert.equal(changes.comparedSnapshots, 1);
  assert.equal(changes.excludedSnapshots, 1);
  assert.equal(changes.timeline.at(-1).comparisonEligible, false);
});

test("export is explicit and deletion removes derived snapshots", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-export-"));
  const store = new DerivedSnapshotStore({ env: { VESPER_STATE_DIR: directory } });
  await store.append(snapshot());
  const destination = path.join(directory, "export", "snapshots.json");
  const exported = await store.exportTo(destination);
  assert.equal(exported.snapshotCount, 1);
  assert.match(await readFile(destination, "utf8"), /derived-portfolio-snapshot/);
  await store.deleteAll();
  assert.equal((await store.status()).snapshotCount, 0);
});

test("missing financial values stay null instead of becoming zero", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-missing-"));
  const store = new DerivedSnapshotStore({ env: { VESPER_STATE_DIR: directory } });
  await store.append({ status: "DEGRADED", syncedAt: null, summary: {}, positions: [{ symbol: "AAA" }], errors: [{ section: "summary" }] });
  const saved = (await store.readAll())[0];
  assert.equal(saved.totalValue, null);
  assert.equal(saved.positions[0].marketValue, null);
  assert.equal(saved.positions[0].weightPercent, null);
});

test("export refuses to overwrite an existing file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vigilalpha-no-overwrite-"));
  const store = new DerivedSnapshotStore({ env: { VESPER_STATE_DIR: directory } });
  const destination = path.join(directory, "existing.json");
  await store.append(snapshot());
  await store.exportTo(destination);
  await assert.rejects(() => store.exportTo(destination), /already exists/i);
});
