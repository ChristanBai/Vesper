import { execFile, spawn } from "node:child_process";
import { chmod, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE_PREFIX = "com.vesper.codex.trading212";
const VIGILALPHA_KEYCHAIN_SERVICE_PREFIX = "com.vigilalpha.codex.trading212";

export const DEFAULT_RISK_LIMITS = Object.freeze({
  maxSingleRiskPercent: 2,
  maxPositionWeightPercent: 20,
  maxSectorWeightPercent: 40,
  drawdownWarningPercent: 15,
  defaultStopLossPercent: 10,
  minimumConfidence: 0.6
});

export const DEFAULT_STRATEGY_PARAMETERS = Object.freeze({
  trend: Object.freeze({ fastPeriod: 20, slowPeriod: 50 }),
  momentum: Object.freeze({ period: 14, positiveThreshold: 55, negativeThreshold: 45 }),
  meanReversion: Object.freeze({ period: 20, deviationPercent: 8 }),
  volatilityDrawdown: Object.freeze({ annualizedVolatilityPercent: 50 })
});

export function stateDirectory(env = process.env) {
  return env.VIGILALPHA_STATE_DIR || env.VESPER_STATE_DIR || path.join(os.homedir(), "Library", "Application Support", "Vesper Codex");
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
  product: "VigilAlpha",
  configVersion: "vigilalpha.config.v1",
  parameterVersion: "vigilalpha.defaults.2026-10-06",
  riskProfile: "balanced",
  parameterValidation: "official_default",
  riskLimits: DEFAULT_RISK_LIMITS,
  strategyParameters: DEFAULT_STRATEGY_PARAMETERS,
  cloud: {
    url: null,
    syncEnabled: false
  }
});

export async function ensureStateDirectory(env = process.env) {
  const directory = stateDirectory(env);
  await ensurePrivateDirectory(directory);
  return directory;
}

export async function ensurePrivateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
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
  await ensurePrivateDirectory(path.dirname(file));
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
    strategyParameters: mergeStrategyParameters(DEFAULT_STRATEGY_PARAMETERS, stored.strategyParameters),
    cloud: { url: null, syncEnabled: false }
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
    strategyParameters: mergeStrategyParameters(current.strategyParameters, patch.strategyParameters),
    cloud: { url: null, syncEnabled: false }
  };
  await writeJson(configPath(env), next);
  return next;
}

function keychainName(kind, prefix = VIGILALPHA_KEYCHAIN_SERVICE_PREFIX) {
  return `${prefix}.${kind}`;
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

export async function storeCredential(kind, value, env = process.env) {
  if (process.platform !== "darwin") {
    throw new Error("Keychain storage is currently implemented for macOS only.");
  }
  if (!value) throw new Error(`${kind} cannot be empty.`);
  const account = securityArgument(env.USER || os.userInfo().username);
  const service = securityArgument(keychainName(kind));
  const secretHex = Buffer.from(value, "utf8").toString("hex");
  await securityInteractive(`add-generic-password -U -a ${account} -s ${service} -X ${secretHex}`);
}

function securityInteractive(command) {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/security", ["-i"], { stdio: ["pipe", "ignore", "pipe"] });
    let errorText = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { errorText += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`macOS Keychain write failed (${code}): ${errorText.trim().slice(0, 200)}`));
    });
    child.stdin.end(`${command}\n`);
  });
}

function securityArgument(value) {
  const text = String(value);
  if (/[\r\n]/.test(text)) throw new Error("Invalid newline in macOS Keychain identifier.");
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

export async function deleteCredential(kind, env = process.env, { includeLegacy = true } = {}) {
  if (env.VESPER_DISABLE_KEYCHAIN === "1" || process.platform !== "darwin") return false;
  let deleted = false;
  const prefixes = includeLegacy
    ? [VIGILALPHA_KEYCHAIN_SERVICE_PREFIX, KEYCHAIN_SERVICE_PREFIX]
    : [VIGILALPHA_KEYCHAIN_SERVICE_PREFIX];
  for (const prefix of prefixes) {
    try {
      await execFileAsync("/usr/bin/security", [
        "delete-generic-password",
        "-a",
        env.USER || os.userInfo().username,
        "-s",
        keychainName(kind, prefix)
      ]);
      deleted = true;
    } catch {
      // Missing credentials are already deleted.
    }
  }
  return deleted;
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
  for (const prefix of [VIGILALPHA_KEYCHAIN_SERVICE_PREFIX, KEYCHAIN_SERVICE_PREFIX]) {
    try {
      const { stdout } = await execFileAsync("/usr/bin/security", [
        "find-generic-password",
        "-a",
        env.USER || os.userInfo().username,
        "-s",
        keychainName(kind, prefix),
        "-w"
      ]);
      if (stdout.trim()) return stdout.trim();
    } catch {
      // Try the legacy Vesper service before reporting a missing credential.
    }
  }
  return null;
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
    configVersion: config.configVersion,
    parameterVersion: config.parameterVersion,
    riskProfile: config.riskProfile,
    parameterValidation: config.parameterValidation,
    mode: "read-only",
    readOnly: true,
    riskLimits: config.riskLimits,
    strategyParameters: config.strategyParameters,
    cloud: {
      url: null,
      syncEnabled: false
    }
  };
}

function mergeStrategyParameters(base, patch = {}) {
  return {
    trend: { ...base.trend, ...(patch?.trend || {}) },
    momentum: { ...base.momentum, ...(patch?.momentum || {}) },
    meanReversion: { ...base.meanReversion, ...(patch?.meanReversion || {}) },
    volatilityDrawdown: { ...base.volatilityDrawdown, ...(patch?.volatilityDrawdown || {}) }
  };
}
