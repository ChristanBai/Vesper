#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = await collectJavaScript(root);
for (const file of files) {
  await execFileAsync(process.execPath, ["--check", file]);
}
console.log(`Syntax check passed for ${files.length} JavaScript files.`);

async function collectJavaScript(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectJavaScript(target));
    else if (/\.(mjs|js)$/.test(entry.name)) files.push(target);
  }
  return files;
}
