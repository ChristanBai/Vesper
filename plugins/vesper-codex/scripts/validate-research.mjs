#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { PATTERN_SPECS } from "../src/vigilalpha/research.mjs";
import { validatePattern, DEFAULT_COST_ASSUMPTIONS } from "../src/vigilalpha/validation.mjs";

try {
  const [input, destination, ...extra] = process.argv.slice(2);
  if (extra.length || !path.isAbsolute(input || "") || !path.isAbsolute(destination || "")) {
    throw new Error("Usage: validate-research.mjs /absolute/public-history.json /absolute/new-report-directory");
  }
  const bytes = await readFile(input);
  const data = JSON.parse(bytes);
  if (!data.symbol || !Array.isArray(data.bars) || !Number.isFinite(Date.parse(data.retrievedAt))) {
    throw new Error("A public dataset with symbol, bars and retrievedAt is required. Do not supply account data.");
  }
  const results = PATTERN_SPECS.filter((pattern) => pattern.id !== "volatility-drawdown-veto")
    .map((pattern) => validatePattern(pattern, data.bars, { interval: data.interval, asOf: data.retrievedAt, costs: DEFAULT_COST_ASSUMPTIONS }));
  const report = { contractVersion: "vigilalpha.research-evidence.v1", symbol: data.symbol,
    datasetSha256: createHash("sha256").update(bytes).digest("hex"), source: data.source || null,
    sourceUrls: data.requests || [], retrievedAt: data.retrievedAt, interval: data.interval,
    currency: data.currency || null, currencySource: data.currencySource || null,
    adjustmentAndDividends: "UNVERIFIED", costAssumptions: DEFAULT_COST_ASSUMPTIONS,
    parameterSearch: false, allCandidateResults: results,
    financialValidity: "NOT_ESTABLISHED", autoPromotion: false,
    limitations: ["Illustrative current-survivor instrument, not a representative historical universe", "One fixed historical holdout is not a forward test", "Source adjustment/dividend rights and point-in-time provenance require verification", "Costs are hypothetical; cash interest, market impact and tax lots absent", "Negative findings must remain; no winning-candidate selection or guaranteed profit"] };
  await mkdir(destination, { mode: 0o700 });
  await writeFile(path.join(destination, "report.json"), JSON.stringify(report, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  const rows = results.map((result) => `| ${result.patternId} | ${result.status} | ${result.outOfSample?.netReturn ?? "unavailable"} | ${result.baseline?.netReturn ?? "unavailable"} | ${result.comparison?.netExcessReturn ?? "unavailable"} | ${result.outOfSample?.maxDrawdown ?? "unavailable"} | ${result.reason || ""} |`).join("\n");
  const markdown = `# ${data.symbol} — 策略历史证据 / Historical evidence\n\nFinancial validity: NOT_ESTABLISHED. Automatic promotion: false. Returns below are fractions, not percentages.\n\nDataset SHA-256: ${report.datasetSha256}\n\nSource: ${report.source}; retrieved: ${report.retrievedAt}; interval: ${report.interval}; currency: ${report.currency} (${report.currencySource}). Adjustment/dividends UNVERIFIED.\n\n| Rule | Status | OOS net return | Same-cost baseline | Net excess | Continuous drawdown | Abstention |\n|---|---|---:|---:|---:|---:|---|\n${rows}\n\n## Limitations\n\n${report.limitations.map((item) => "- " + item).join("\n")}\n\nSee report.json for all cost assumptions, dates, fold diagnostics and failures. No live account data or orders were read.\n`;
  await writeFile(path.join(destination, "REPORT.md"), markdown, { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ destination, symbol: data.symbol, financialValidity: report.financialValidity,
    results: results.map((result) => ({ id: result.patternId, status: result.status, reason: result.reason, netExcess: result.comparison?.netExcessReturn })) }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
