import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { patternRegistry } from "./research.mjs";

// This notebook exports research evidence only. Nothing imports it as strategy configuration.
export function researchNotebook() {
  const registry = patternRegistry();
  return {
    contractVersion: "vigilalpha.research-notebook.v1",
    product: "VigilAlpha",
    mode: "RESEARCH_ONLY",
    automaticLearning: "PAUSED",
    runtimeImport: false,
    stages: ["SOURCE", "CANDIDATE", "REPRODUCE", "OUT_OF_SAMPLE", "SHADOW", "HUMAN_REVIEW"],
    exportCommand: "node scripts/research-notebook.mjs export /absolute/path/to/new-notebook",
    candidates: registry.patterns.map((pattern) => ({
      ...structuredClone(pattern),
      validationStatus: "PENDING_VERIFICATION",
      sources: structuredClone(registry.sources.filter((source) => pattern.sources.includes(source.id))),
      missingEvidence: ["point-in-time dataset and hash", "frozen universe and trial log", "fees/slippage/FX", "benchmark", "untouched out-of-sample results", "prospective outcomes", "human approval"]
    })),
    boundary: "Sources motivate hypotheses; they do not validate these parameters or guarantee profit. Notebook edits never change runtime strategies."
  };
}

export async function exportResearchNotebook(destination) {
  if (typeof destination !== "string" || !path.isAbsolute(destination)) {
    throw new Error("Choose an absolute path to a new notebook directory.");
  }
  const notebook = researchNotebook();
  // Refuse existing directories, including symlinks, instead of overwriting user notes.
  await mkdir(destination, { mode: 0o700 });
  await writeFile(path.join(destination, "registry.json"), `${JSON.stringify(notebook, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  const links = [];
  for (const candidate of notebook.candidates) {
    const filename = `${candidate.id}.md`;
    const sources = candidate.sources.map((source) => `- [${source.title}](${source.url}) — publication date: ${source.publishedAt ?? "unverified"}; supports: ${source.use}`).join("\n");
    const text = `# ${candidate.name}\n\nStatus: PENDING_VERIFICATION · runtime import: disabled\n\n## 可计算假设 / Calculable hypothesis\n\n${candidate.formation}\n\nTrigger: ${candidate.trigger}\n\nConfirmation: ${candidate.confirmation}\n\nExit: ${candidate.exit}\n\nInvalidation: ${candidate.invalidation}\n\nFailure cases: ${candidate.failures.join("; ")}\n\n## 来源 / Sources\n\n${sources}\n\nSource references motivate research; reading dates, conflicts and applicability require review. They do not establish these parameter values as optimal.\n\n## 冻结实验 / Frozen experiment\n\n- Question and counter-hypothesis: NOT_RECORDED\n- Dataset, available_at, universe/industry coverage, interval, currency, adjustment and hash: NOT_RECORDED\n- All attempted parameters and train/validation/untouched test dates: NOT_RECORDED\n- Next-bar execution, gaps, fees, spread, slippage, tax and FX: NOT_RECORDED\n- Same-period/currency benchmark and abstentions: NOT_RECORDED\n\n## 结果与反证 / Results and counterevidence\n\nNOT_RUN. Record gross/net returns, benchmark difference, drawdown, turnover, missing coverage and failures. Do not invent results.\n\n## 决定 / Decision\n\nPENDING_VERIFICATION. Human review required; no runtime or order authority.\n`;
    await writeFile(path.join(destination, filename), text, { mode: 0o600, flag: "wx" });
    links.push(`- [${candidate.name}](${filename}) — PENDING_VERIFICATION`);
  }
  await writeFile(path.join(destination, "INDEX.md"), `# VigilAlpha 研究笔记本 / Research notebook\n\nAutomatic learning: PAUSED. Manual, local evidence channel; no account access, network calls or runtime import.\n\n${links.join("\n")}\n\n流程：来源 → 候选 → 复现 → 样本外 → 影子观察 → 人工审核。\n\nEdit these evidence sheets locally or open the folder in Obsidian. This is a plain Markdown folder, not an initialized Vault. For an existing governed Vault, ingest through its normal rules; do not bulk-copy templates into governed knowledge folders.\n\nRe-export requires a NEW directory, preserving all prior work. registry.json is an export snapshot, not a strategy configuration.\n`, { mode: 0o600, flag: "wx" });
  return { directory: destination, files: notebook.candidates.length + 2, status: "EXPORTED_RESEARCH_ONLY", runtimeImport: false };
}
