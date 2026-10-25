#!/usr/bin/env node
import { exportResearchNotebook, researchNotebook } from "../src/vigilalpha/research-notebook.mjs";

try {
  const [action, destination, ...extra] = process.argv.slice(2);
  if (extra.length || !["list", "export"].includes(action) || (action === "list" && destination)) {
    throw new Error("Usage: research-notebook.mjs list | export /absolute/path/to/new-notebook");
  }
  const result = action === "export" ? await exportResearchNotebook(destination) : researchNotebook();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
