import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { auditPath, ensureStateDirectory } from "./config.mjs";

export async function appendAudit(event, env = process.env) {
  await ensureStateDirectory(env);
  const record = {
    id: randomUUID(),
    at: new Date().toISOString(),
    ...redact(event)
  };
  await appendFile(auditPath(env), `${JSON.stringify(record)}\n`, { mode: 0o600 });
  return record;
}

export async function readAudit(env = process.env, limit = 100) {
  try {
    const content = await readFile(auditPath(env), "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/secret|token|api.?key|password/i.test(key))
      .map(([key, item]) => [key, redact(item)])
  );
}
