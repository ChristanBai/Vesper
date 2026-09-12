import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE_PREFIX = "com.vesper.codex.trading212";

export const DEFAULT_RISK_LIMITS = Object.freeze({
  maxSingleRiskPercent: 2,
  maxPositionWeightPercent: 20,
  maxSectorWeightPercent: 40,
  drawdownWarningPercent: 15,
  defaultStopLossPercent: 10,
  minimumConfidence: 0.6
});

export function stateDirectory(env = process.env) {
  return env.VESPER_STATE_DIR || path.join(os.homedir(), "Library", "Application Support", "Vesper Codex");
}

export function configPath(env = process.env) {
  return path.join(stateDirectory(env), "config.json");
}

export function cachePath(env = process.env) {
  return path.join(stateDirectory(env), "cache.json");
}

export function auditPath(env = process.env) {
  return path.join(stateDirectory(env), "audit.jsonl");
}

export const DEFAULT_CONFIG = Object.freeze({
  environment: "live",
  accountVerifiedAt: null,
  readOnly: true,
  riskLimits: DEFAULT_RISK_LIMITS,
  cloud: {
    url: null,
    syncEnabled: false
  }
});

export async function ensureStateDirectory(env = process.env) {
  const directory = stateDirectory(env);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  return directory;
}

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${file}`);
    }
    throw error;
  }
}

export async function writeJson(file, value, mode = 0o600) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode });
  await rename(temp, file);
  await removeStaleTemps(file);
}

async function removeStaleTemps(file) {
  const directory = path.dirname(file);
  const prefix = `${path.basename(file)}.`;
  const entries = await readdir(directory).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.startsWith(prefix) && entry.endsWith(".tmp"))
    .map((entry) => rm(path.join(directory, entry), { force: true })));
}

export async function readConfig(env = process.env) {
  const stored = await readJson(configPath(env), {});
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    readOnly: true,
    riskLimits: {
      ...DEFAULT_RISK_LIMITS,
      ...(stored.riskLimits || {})
    },
    cloud: {
      ...DEFAULT_CONFIG.cloud,
      ...(stored.cloud || {})
    }
  };
}

export async function updateConfig(patch, env = process.env) {
  const current = await readConfig(env);
  const next = {
    ...current,
    ...patch,
    riskLimits: {
      ...current.riskLimits,
      ...(patch.riskLimits || {})
    },
    cloud: {
      ...current.cloud,
      ...(patch.cloud || {})
    }
  };
  await writeJson(configPath(env), next);
  return next;
}

function keychainName(kind) {
  return `${KEYCHAIN_SERVICE_PREFIX}.${kind}`;
}

export async function keychainAvailable() {
  if (process.platform !== "darwin") return false;
  try {
    await execFileAsync("/usr/bin/security", ["-h"]);
    return true;
  } catch {
    return false;
  }
}

export async function storeCredential(kind, value) {
  if (process.platform !== "darwin") {
    throw new Error("Keychain storage is currently implemented for macOS only.");
  }
  if (!value) throw new Error(`${kind} cannot be empty.`);
  await execFileAsync("/usr/bin/security", [
    "add-generic-password",
    "-U",
    "-a",
    process.env.USER || os.userInfo().username,
    "-s",
    keychainName(kind),
    "-w",
    value
  ]);
}

export async function readCredential(kind, env = process.env) {
  const envName = {
    apiKey: "T212_API_KEY",
    apiSecret: "T212_API_SECRET",
    twelveDataKey: "TWELVE_DATA_API_KEY"
  }[kind];
  if (!envName) throw new Error(`Unknown credential kind: ${kind}`);
  if (env[envName]) return env[envName];
  if (env.VESPER_DISABLE_KEYCHAIN === "1") return null;
  if (process.platform !== "darwin") return null;
  try {
    const { stdout } = await execFileAsync("/usr/bin/security", [
      "find-generic-password",
      "-a",
      env.USER || os.userInfo().username,
      "-s",
      keychainName(kind),
      "-w"
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function credentialStatus(env = process.env) {
  const [apiKey, apiSecret, twelveDataKey] = await Promise.all([
    readCredential("apiKey", env),
    readCredential("apiSecret", env),
    readCredential("twelveDataKey", env)
  ]);
  return {
    configured: Boolean(apiKey && apiSecret),
    source: env.T212_API_KEY && env.T212_API_SECRET
      ? "environment"
      : apiKey && apiSecret
        ? "macos-keychain"
        : "missing",
    twelveDataConfigured: Boolean(twelveDataKey)
  };
}

export function publicConfig(config) {
  return {
    environment: config.environment,
    accountVerifiedAt: config.accountVerifiedAt,
    mode: "read-only",
    readOnly: true,
    riskLimits: config.riskLimits,
    cloud: {
      url: config.cloud.url,
      syncEnabled: config.cloud.syncEnabled
    }
  };
}
