import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensurePrivateDirectory, stateDirectory } from "../core/config.mjs";

const SNAPSHOT_VERSION = "vigilalpha.derived-portfolio-snapshot.v1";
const RETENTION_DAYS = 365;

export class DerivedSnapshotStore {
  constructor({ env = process.env, now = () => Date.now() } = {}) {
    this.env = env;
    this.now = now;
    this.operation = Promise.resolve();
  }

  directory() {
    return path.join(stateDirectory(this.env), "vigilalpha");
  }

  file() {
    return path.join(this.directory(), "portfolio-snapshots.jsonl");
  }

  append(snapshot) {
    return this.serial(() => this.appendUnsafe(snapshot));
  }

  async appendUnsafe(snapshot) {
    const derived = sanitizeDerivedSnapshot(snapshot, new Date(this.now()).toISOString());
    const existing = await this.readAll();
    const retained = prune(existing, this.now());
    await ensurePrivateDirectory(this.directory());
    await writeFile(this.file(), `${[...retained, derived].map((item) => JSON.stringify(item)).join("\n")}\n`, { mode: 0o600 });
    await chmod(this.file(), 0o600);
    return derived;
  }

  async readAll() {
    try {
      const text = await readFile(this.file(), "utf8");
      return text.split("\n").filter(Boolean).map((line) => normalizeStoredSnapshot(JSON.parse(line)));
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async status() {
    const snapshots = await this.readAll();
    let fileMode = null;
    try {
      fileMode = (await stat(this.file())).mode & 0o777;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    return {
      snapshotCount: snapshots.length,
      comparisonEligibleCount: snapshots.filter((snapshot) => snapshot.comparisonEligible).length,
      firstSavedAt: snapshots[0]?.savedAt || null,
      latestSavedAt: snapshots.at(-1)?.savedAt || null,
      retentionDays: RETENTION_DAYS,
      fileMode: fileMode === null ? null : fileMode.toString(8).padStart(3, "0")
    };
  }

  async changes() {
    const snapshots = await this.readAll();
    const eligible = snapshots.filter((snapshot) => snapshot.comparisonEligible);
    if (eligible.length < 2) {
      return { status: "INSUFFICIENT_HISTORY", comparedSnapshots: eligible.length, excludedSnapshots: snapshots.length - eligible.length, materialChange: false, changes: [], timeline: timeline(snapshots) };
    }
    return { ...compareDerivedSnapshots(eligible.at(-2), eligible.at(-1)), excludedSnapshots: snapshots.length - eligible.length, timeline: timeline(snapshots) };
  }

  async exportTo(destination) {
    if (!path.isAbsolute(destination)) throw new Error("Export destination must be an absolute path.");
    const snapshots = await this.readAll();
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      await writeFile(destination, `${JSON.stringify({ version: SNAPSHOT_VERSION, exportedAt: new Date(this.now()).toISOString(), snapshots }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    } catch (error) {
      if (error?.code === "EEXIST") throw new Error("Export destination already exists; choose a new file path.");
      throw error;
    }
    return { exported: true, destination, snapshotCount: snapshots.length };
  }

  deleteAll() {
    return this.serial(async () => {
      await rm(this.file(), { force: true });
      return { deleted: true, deletedScope: ["derived portfolio snapshots"] };
    });
  }

  serial(operation) {
    const next = this.operation.then(operation, operation);
    this.operation = next.catch(() => {});
    return next;
  }
}

function timeline(snapshots) {
  return snapshots.slice(-120).map((snapshot) => ({
    savedAt: snapshot.savedAt,
    sourceCutoff: snapshot.sourceCutoff,
    totalValue: snapshot.totalValue,
    unrealizedPnL: snapshot.unrealizedPnL,
    positionCount: snapshot.positionCount,
    comparisonEligible: snapshot.comparisonEligible,
    dataQualityStatus: snapshot.dataQuality?.reconciliationStatus || "UNKNOWN"
  }));
}

export function sanitizeDerivedSnapshot(snapshot, savedAt = new Date().toISOString()) {
  const summary = snapshot?.summary || {};
  const positions = Array.isArray(snapshot?.positions) ? snapshot.positions : [];
  const totalValue = finiteOrNull(summary.totalValue);
  return {
    version: SNAPSHOT_VERSION,
    savedAt,
    sourceCutoff: snapshot?.syncedAt || null,
    status: snapshot?.status || "UNKNOWN",
    comparisonEligible: isComparisonEligible(snapshot?.status, snapshot?.syncedAt),
    currency: summary.currency || null,
    totalValue,
    availableCash: finiteOrNull(summary.availableCash),
    unrealizedPnL: finiteOrNull(summary.unrealizedPnL),
    positionCount: positions.length,
    positions: positions.map((position) => ({
      symbol: String(position.symbol || "UNKNOWN").slice(0, 32),
      marketValue: finiteOrNull(position.marketValue),
      weightPercent: totalValue && finiteOrNull(position.marketValue) !== null ? finiteOrNull(position.marketValue) / totalValue * 100 : null,
      unrealizedPnL: finiteOrNull(position.unrealizedPnL)
    })).sort((left, right) => left.symbol.localeCompare(right.symbol)),
    dataQuality: {
      reconciliationStatus: snapshot?.reconciliation?.status || "UNKNOWN",
      errorSections: (Array.isArray(snapshot?.errors) ? snapshot.errors : []).map((error) => String(error.section || "unknown")).sort()
    }
  };
}

function normalizeStoredSnapshot(snapshot) {
  return {
    ...snapshot,
    comparisonEligible: typeof snapshot?.comparisonEligible === "boolean"
      ? snapshot.comparisonEligible
      : isComparisonEligible(snapshot?.status, snapshot?.sourceCutoff)
  };
}

function isComparisonEligible(status, sourceCutoff) {
  return Boolean(sourceCutoff) && !["PARTIAL", "DEGRADED", "FAILED"].includes(status || "UNKNOWN");
}

export function compareDerivedSnapshots(previous, current) {
  const changes = [];
  if (previous.totalValue === null || current.totalValue === null) {
    changes.push({ code: "TOTAL_VALUE_DATA_GAP", before: previous.totalValue, after: current.totalValue, material: true });
  }
  addChange(changes, "TOTAL_VALUE", previous.totalValue, current.totalValue, materialPercent(previous.totalValue, current.totalValue, 5));
  addChange(changes, "UNREALIZED_PNL", previous.unrealizedPnL, current.unrealizedPnL, materialAbsolute(previous.unrealizedPnL, current.unrealizedPnL, Math.max(Math.abs(current.totalValue) * 0.02, 1)));
  const before = new Map((previous.positions || []).map((item) => [item.symbol, item]));
  const after = new Map((current.positions || []).map((item) => [item.symbol, item]));
  for (const symbol of new Set([...before.keys(), ...after.keys()])) {
    const left = before.get(symbol);
    const right = after.get(symbol);
    if (!left || !right) {
      changes.push({ code: "POSITION_SET", symbol, before: Boolean(left), after: Boolean(right), material: true });
      continue;
    }
    if (left.weightPercent !== null && right.weightPercent !== null && Math.abs(left.weightPercent - right.weightPercent) >= 5) {
      changes.push({ code: "POSITION_WEIGHT", symbol, before: left.weightPercent, after: right.weightPercent, material: true });
    }
  }
  if (previous.dataQuality?.reconciliationStatus !== current.dataQuality?.reconciliationStatus) {
    changes.push({ code: "DATA_QUALITY", before: previous.dataQuality?.reconciliationStatus, after: current.dataQuality?.reconciliationStatus, material: true });
  }
  return {
    status: "COMPARED",
    comparedSnapshots: 2,
    from: previous.savedAt,
    to: current.savedAt,
    materialChange: changes.some((change) => change.material),
    changes
  };
}

function prune(snapshots, now) {
  const cutoff = now - RETENTION_DAYS * 86_400_000;
  return snapshots.filter((snapshot) => Date.parse(snapshot.savedAt || "") >= cutoff);
}

function addChange(changes, code, before, after, material) {
  if (before === after) return;
  changes.push({ code, before, after, material });
}

function materialPercent(before, after, threshold) {
  if (before === null || after === null) return false;
  if (!before) return before !== after;
  return Math.abs((after - before) / before * 100) >= threshold;
}

function materialAbsolute(before, after, threshold) {
  if (before === null || after === null || threshold === null) return false;
  return Math.abs(after - before) >= threshold;
}

function finiteOrNull(value) {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed) ? parsed : null;
}
