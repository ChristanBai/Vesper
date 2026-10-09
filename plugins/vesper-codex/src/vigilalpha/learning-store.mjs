import { chmod, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ensurePrivateDirectory, stateDirectory } from "../core/config.mjs";

export const SHADOW_RECORD_VERSION = "vigilalpha.shadow-record.v1";

export class ShadowLearningStore {
  constructor({ env = process.env, now = () => Date.now() } = {}) {
    this.env = env;
    this.now = now;
    this.operation = Promise.resolve();
  }

  directory() { return path.join(stateDirectory(this.env), "vigilalpha"); }
  file() { return path.join(this.directory(), "shadow-decisions.jsonl"); }

  append(decision) {
    return this.serial(async () => {
      const record = sanitizeShadowDecision(decision, new Date(this.now()).toISOString());
      await ensurePrivateDirectory(this.directory());
      await writeFile(this.file(), `${JSON.stringify(record)}\n`, { mode: 0o600, flag: "a" });
      await chmod(this.file(), 0o600);
      return record;
    });
  }

  async readAll() {
    try {
      return (await readFile(this.file(), "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async review() {
    const records = await this.readAll();
    const decisions = records.filter((record) => record.recordType === "decision");
    const outcomes = records.filter((record) => record.recordType === "outcome");
    const evaluatedIds = new Set(outcomes.map((record) => record.decisionId));
    const failures = outcomes.filter((record) => Number(record.actionAlignedReturn) < 0);
    const firstAt = decisions[0]?.recordedAt || null;
    const elapsedDays = firstAt ? Math.floor((this.now() - Date.parse(firstAt)) / 86_400_000) : 0;
    return {
      contractVersion: "vigilalpha.learning-review.v1",
      shadowDecisionCount: decisions.length,
      evaluableDecisionCount: evaluatedIds.size,
      failureCaseCount: failures.length,
      observationDays: Math.max(0, elapsedDays),
      promotionGate: { minimumDays: 90, minimumEvaluableDecisions: 30, humanApprovalRequired: true, passed: elapsedDays >= 90 && evaluatedIds.size >= 30 },
      pendingProposals: [],
      autoPromotion: false,
      recent: records.slice(-20)
    };
  }

  async evaluatePending(loadHistory) {
    const records = await this.readAll();
    const decisions = records.filter((record) => record.recordType === "decision" && record.referencePrice && record.sourceCutoff);
    const existing = new Set(records.filter((record) => record.recordType === "outcome").map((record) => `${record.decisionId}:${record.horizonSessions}`));
    const histories = new Map();
    const appended = [];
    for (const decision of decisions) {
      if (!histories.has(decision.symbol)) {
        try {
          histories.set(decision.symbol, await loadHistory(decision.symbol));
        } catch {
          histories.set(decision.symbol, null);
        }
      }
      const bars = histories.get(decision.symbol);
      if (!bars) continue;
      const future = (Array.isArray(bars) ? bars : [])
        .filter((bar) => Date.parse(bar?.time || "") > Date.parse(decision.sourceCutoff))
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
      for (const horizon of [20, 60]) {
        const key = `${decision.decisionId}:${horizon}`;
        if (existing.has(key) || future.length < horizon) continue;
        const outcomePrice = finite(future[horizon - 1]?.close);
        if (!outcomePrice || !decision.referencePrice) continue;
        const marketReturn = outcomePrice / decision.referencePrice - 1;
        const directional = ["REDUCE", "EXIT"].includes(decision.action) ? -marketReturn : ["ADD", "HOLD"].includes(decision.action) ? marketReturn : null;
        const outcome = {
          contractVersion: SHADOW_RECORD_VERSION,
          recordType: "outcome",
          recordedAt: new Date(this.now()).toISOString(),
          decisionId: decision.decisionId,
          symbol: decision.symbol,
          action: decision.action,
          horizonSessions: horizon,
          outcomeAt: future[horizon - 1].time,
          referencePrice: decision.referencePrice,
          outcomePrice,
          marketReturn,
          actionAlignedReturn: directional,
          interpretation: directional === null ? "OBSERVED_ONLY" : "HYPOTHETICAL_DIRECTIONAL_ALIGNMENT"
        };
        await this.appendEvent(outcome);
        appended.push(outcome);
        existing.add(key);
      }
    }
    return appended;
  }

  appendEvent(event) {
    return this.serial(async () => {
      await ensurePrivateDirectory(this.directory());
      await writeFile(this.file(), `${JSON.stringify(event)}\n`, { mode: 0o600, flag: "a" });
      await chmod(this.file(), 0o600);
      return event;
    });
  }

  deleteAll() {
    return this.serial(async () => {
      await rm(this.file(), { force: true });
      return { deleted: true, deletedScope: ["shadow decisions and outcome evaluations"] };
    });
  }

  serial(operation) {
    const next = this.operation.then(operation, operation);
    this.operation = next.catch(() => {});
    return next;
  }
}

export function sanitizeShadowDecision(decision, recordedAt) {
  const symbol = String(decision?.symbol || "UNKNOWN").slice(0, 32);
  const action = decision?.action || "WAIT";
  return {
    contractVersion: SHADOW_RECORD_VERSION,
    recordType: "decision",
    recordedAt,
    decisionId: randomUUID(),
    decisionVersion: decision?.contractVersion || null,
    mode: "SHADOW",
    symbol,
    action,
    quantity: finite(decision?.quantity),
    sourceCutoff: decision?.sourceCutoff || null,
    parametersVersion: decision?.parametersVersion || null,
    dataGate: decision?.dataGate || null,
    referencePrice: finite(decision?.reference?.price),
    portfolioWeightPercent: finite(decision?.reference?.portfolioWeightPercent),
    triggerConditions: strings(decision?.triggerConditions),
    invalidationConditions: strings(decision?.invalidationConditions),
    estimatedEconomics: decision?.estimatedEconomics ? {
      grossProceeds: finite(decision.estimatedEconomics.grossProceeds),
      estimatedCosts: finite(decision.estimatedEconomics.estimatedCosts),
      estimatedNetProceeds: finite(decision.estimatedEconomics.estimatedNetProceeds),
      costVersion: decision.estimatedEconomics.assumptions?.version || null
    } : null
  };
}

function strings(value) { return (Array.isArray(value) ? value : []).map((item) => String(item).slice(0, 300)); }
function finite(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
