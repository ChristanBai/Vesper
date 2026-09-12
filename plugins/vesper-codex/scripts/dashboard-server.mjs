#!/usr/bin/env node
import { createRuntime } from "../src/runtime.mjs";
import { DashboardManager } from "../src/dashboard/server.mjs";

const port = Number(process.env.PORT || 8788);
const host = process.env.HOST || (process.env.VESPER_MODE === "cloud" ? "0.0.0.0" : "127.0.0.1");
const runtime = await createRuntime();
const manager = new DashboardManager(runtime);
const info = await manager.start({ host, port });

console.log(`Vesper dashboard: ${info.url}`);
console.log(`Mode: ${process.env.VESPER_MODE || "local"}`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await manager.close();
    process.exit(0);
  });
}
