import { createToolRuntime } from "./tools.mjs";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_VERSION = "2.0.0";

export async function runStdioServer({ env = process.env } = {}) {
  const toolRuntime = createToolRuntime({ env });
  let buffer = "";

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let boundary = buffer.indexOf("\n");
    while (boundary >= 0) {
      const line = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 1);
      if (line) handleMessage(line, toolRuntime).catch((error) => {
        send({ jsonrpc: "2.0", id: null, error: { code: -32603, message: error.message } });
      });
      boundary = buffer.indexOf("\n");
    }
  });

  await new Promise((resolve) => process.stdin.on("end", resolve));
}

async function handleMessage(raw, toolRuntime) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }

  const { id, method, params = {} } = message;
  if (id === undefined) return;

  try {
    let result;
    switch (method) {
      case "initialize":
        result = {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            logging: {}
          },
          serverInfo: {
            name: "vesper-codex",
            version: SERVER_VERSION
          },
          instructions: "Vesper is local-first and strictly read-only. It cannot place, modify or cancel orders. Read account data before analysis. Keep API secrets in Keychain or environment variables, never in prompts or tool results. Label quote providers and delays. State that analysis is not investment advice."
        };
        break;
      case "ping":
        result = {};
        break;
      case "tools/list":
        result = { tools: toolRuntime.definitions };
        break;
      case "tools/call": {
        const name = params.name;
        const definition = toolRuntime.definitions.find((item) => item.name === name);
        if (!definition) throw new RpcError(-32602, `Unknown tool: ${name}`);
        const data = await toolRuntime.call(name, params.arguments || {});
        result = {
          structuredContent: data,
          content: [{
            type: "text",
            text: summarize(name, data)
          }]
        };
        break;
      }
      case "resources/list":
        result = {
          resources: [{
            uri: "vesper://status",
            name: "Vesper status",
            description: "Local Vesper MCP status and setup instructions.",
            mimeType: "application/json"
          }]
        };
        break;
      case "resources/read":
        if (params.uri !== "vesper://status") throw new RpcError(-32602, "Unknown resource");
        result = {
          contents: [{
            uri: "vesper://status",
            mimeType: "application/json",
            text: JSON.stringify(await toolRuntime.call("setup", {}), null, 2)
          }]
        };
        break;
      case "logging/setLevel":
        result = {};
        break;
      default:
        throw new RpcError(-32601, `Method not found: ${method}`);
    }
    send({ jsonrpc: "2.0", id, result });
  } catch (error) {
    send({
      jsonrpc: "2.0",
      id,
      error: {
        code: error.rpcCode || -32000,
        message: error.message
      }
    });
  }
}

function summarize(name, data) {
  if (name === "report") return data.markdown;
  if (name === "daily_brief") return data.markdown;
  if (name === "start_vesper") return `Vesper ${data.ready ? "ready" : "needs setup"}: ${data.positionCount} positions, ${data.orderCount} orders, order history ${data.orderHistoryStatus}. Dashboard: ${data.localUrl || data.url || "unavailable"}.`;
  if (name === "history") return `${data.symbol || "Symbol"} ${data.range || ""}: ${data.bars?.length || 0} bars from ${data.source || "unknown source"}; ${data.markers?.length || 0} execution markers.`;
  if (name === "quote") return `${data.symbol}: ${data.price} ${data.currency || ""} from ${data.source}; delay ${data.delayedByMinutes ?? "unknown"} minutes.`;
  if (name === "holdings") return `${data.positions?.length || 0} positions; reconciliation ${data.reconciliation?.status || "unknown"}; sync ${data.status || "unknown"}.`;
  return JSON.stringify(data, null, 2).slice(0, 12_000);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

class RpcError extends Error {
  constructor(code, message) {
    super(message);
    this.rpcCode = code;
  }
}
