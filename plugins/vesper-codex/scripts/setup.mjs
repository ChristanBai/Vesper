#!/usr/bin/env node
import { createInterface } from "node:readline";
import { publicConfig, storeCredential, updateConfig } from "../src/core/config.mjs";
import { T212Client } from "../src/core/t212-client.mjs";
import { mapSummary } from "../src/core/portfolio.mjs";

const options = parseArgs(process.argv.slice(2));
const environment = options.environment || "live";
if (!["live", "demo"].includes(environment)) {
  fail("--environment must be live or demo.");
}

console.log("Vesper for Codex setup");
console.log("Credentials are verified first and stored in macOS Keychain.");
console.log("The secret is never written to the repository or Vesper config.\n");

const providedApiKey = process.env.T212_API_KEY;
const apiKey = providedApiKey || await promptVisible("Trading 212 API Key: ");
const providedSecret = process.env.T212_API_SECRET;
const apiSecret = providedSecret || await promptHidden("Trading 212 API Secret: ");
if (!apiKey || !apiSecret) fail("Both API Key and API Secret are required.");

const client = new T212Client({
  apiKey,
  apiSecret,
  environment,
  minimumIntervalMs: 0
});

console.log("\nVerifying credentials with Trading 212...");
let summary;
try {
  summary = mapSummary(await client.accountSummary());
} catch (error) {
  fail(`Trading 212 verification failed: ${error.message}`);
}

await storeCredential("apiKey", apiKey);
await storeCredential("apiSecret", apiSecret);

let twelveDataKey = process.env.TWELVE_DATA_API_KEY || "";
if (!twelveDataKey && process.stdin.isTTY && process.stdout.isTTY) {
  twelveDataKey = await promptVisible("Twelve Data API Key (optional, press Enter to skip): ");
}
if (twelveDataKey) {
  await storeCredential("twelveDataKey", twelveDataKey);
}

const now = new Date().toISOString();
const config = await updateConfig({
  environment,
  accountVerifiedAt: now,
  readOnly: true
});

console.log("\nConnection verified.");
console.log(`Account currency: ${summary.currency}`);
console.log(`Account value: ${summary.totalValue.toFixed(2)} ${summary.currency}`);
console.log(`Positions require synchronization through the MCP tools.`);
console.log("Mode: read-only; order placement and cancellation are not implemented.");
console.log(`Twelve Data configured: ${twelveDataKey ? "yes" : "no"}`);
console.log("\nSetup complete. Restart Codex or open a new task before using the Vesper MCP tools.");
console.log(`Config: ${JSON.stringify(publicConfig(config), null, 2)}`);

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--environment") parsed.environment = args[++index];
    else if (arg === "--help") {
      console.log("Usage: node scripts/setup.mjs [--environment live|demo]");
      process.exit(0);
    }
  }
  return parsed;
}

async function promptVisible(question) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => readline.question(question, resolve));
  readline.close();
  return answer.trim();
}

async function promptHidden(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    return promptVisible(question);
  }
  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  let value = "";
  return new Promise((resolve, reject) => {
    const onData = (character) => {
      if (character === "\u0003") {
        cleanup();
        reject(new Error("Setup cancelled."));
      } else if (character === "\r" || character === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(value.trim());
      } else if (character === "\u007f" || character === "\b") {
        value = value.slice(0, -1);
      } else {
        value += character;
      }
    };
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on("data", onData);
  });
}

function fail(message) {
  console.error(`\nError: ${message}`);
  process.exit(1);
}
