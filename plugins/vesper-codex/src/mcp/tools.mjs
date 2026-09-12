import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { appendAudit, readAudit } from "../core/audit.mjs";
import { publicConfig, readConfig, stateDirectory, updateConfig } from "../core/config.mjs";
import { DashboardManager } from "../dashboard/server.mjs";
import { buildPortfolioBrief } from "../analysis/portfolio-brief.mjs";
import { calculateTradeReview, createRuntime, tradeMarkers } from "../runtime.mjs";

export function createToolRuntime({ env = process.env } = {}) {
  let runtimePromise = null;
  let dashboard = null;

  async function runtime() {
    runtimePromise ||= createRuntime(env);
    return runtimePromise;
  }

  async function dashboardManager() {
    if (!dashboard) dashboard = new DashboardManager(await runtime(), env);
    return dashboard;
  }

  return {
    definitions: TOOL_DEFINITIONS,
    async call(name, args = {}) {
      const service = await runtime();
      switch (name) {
        case "setup":
          return setupTool(service, args, env);
        case "start_vesper":
          return startVesperTool(service, args, env, dashboardManager);
        case "holdings":
          return holdingsTool(service, args);
        case "pies":
          return piesTool(service, args);
        case "trades":
          return tradesTool(service, args);
        case "quote":
          return quoteTool(service, args);
        case "history":
          return historyTool(service, args);
        case "dashboard":
          return dashboardTool(service, args, env, dashboardManager);
        case "news":
          return newsTool(service, args);
        case "analysis":
          return analysisTool(service, args);
        case "backtest":
          return backtestTool(service, args);
        case "report":
          return reportTool(service, args, env);
        case "daily_brief":
          return dailyBriefTool(service);
        case "order_history":
          return orderHistoryTool(service, args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    }
  };
}

export const TOOL_DEFINITIONS = [
  tool("setup", "Check or update Vesper setup", "Use this first to verify Trading 212 credentials, account environment and cloud dashboard configuration. Vesper is always read-only.", {
    type: "object",
    properties: {
      cloudUrl: { type: ["string", "null"] },
      cloudSyncEnabled: { type: "boolean" }
    },
    additionalProperties: false
  }, true),
  tool("start_vesper", "Start Vesper", "Use this as the single startup command. It verifies configuration, refreshes the Trading 212 account and order history, starts the local dashboard and returns the URL to open in Codex.", {
    type: "object",
    properties: {
      port: { type: "integer", minimum: 1024, maximum: 65535 }
    },
    additionalProperties: false
  }, true),
  tool("holdings", "Get holdings and reconciliation", "Use this to read account totals, positions, allocation and positions-versus-Pies verification.", {
    type: "object",
    properties: { refresh: { type: "boolean" }, full: { type: "boolean" } },
    additionalProperties: false
  }, true),
  tool("pies", "Get Pies", "Use this to inspect Pie composition and compare each Pie instrument with the brokerage position.", {
    type: "object",
    properties: { refresh: { type: "boolean" } },
    additionalProperties: false
  }, true),
  tool("trades", "Review trades", "Use this to calculate invested capital, recovered capital, realized and unrealized profit or loss, and execution markers.", {
    type: "object",
    properties: { symbol: { type: "string" }, refresh: { type: "boolean" } },
    additionalProperties: false
  }, true),
  tool("quote", "Get market quote", "Use this for a current quote with provider, update time and delay label. Trading 212 is not used as a quote source.", {
    type: "object",
    properties: { symbol: { type: "string" } },
    required: ["symbol"],
    additionalProperties: false
  }, true),
  tool("history", "Get market history", "Use this for OHLCV bars and real Trading 212 buy and sell markers over 1D, 1W, 1M, 6M, 1Y or MAX.", {
    type: "object",
    properties: {
      symbol: { type: "string" },
      range: { type: "string", enum: ["1D", "1W", "1M", "6M", "1Y", "MAX"] },
      interval: { type: "string", enum: ["auto", "10m", "15m", "30m", "1h", "1D", "1W"] },
      includeMarkers: { type: "boolean" }
    },
    required: ["symbol"],
    additionalProperties: false
  }, true),
  tool("dashboard", "Open the Vesper dashboard", "Use this to start or locate the Apple Stocks-style dashboard. Local mode binds only to 127.0.0.1 and never exposes credentials.", {
    type: "object",
    properties: {
      action: { type: "string", enum: ["open", "url", "status"] },
      port: { type: "integer", minimum: 1024, maximum: 65535 }
    },
    additionalProperties: false
  }, true),
  tool("news", "Get market news", "Use this for recent Yahoo News RSS headlines and a coarse headline sentiment label.", {
    type: "object",
    properties: { symbol: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 } },
    additionalProperties: false
  }, true),
  tool("analysis", "Analyze a symbol", "Use this to calculate trend, RSI, moving averages, volatility, drawdown and a confidence score without promising returns.", {
    type: "object",
    properties: {
      symbol: { type: "string" },
      range: { type: "string", enum: ["1D", "1W", "1M", "6M", "1Y", "MAX"] }
    },
    required: ["symbol"],
    additionalProperties: false
  }, true),
  tool("backtest", "Backtest a strategy", "Use this to run a long-only SMA crossover backtest with hypothetical return, drawdown and trade count.", {
    type: "object",
    properties: {
      symbol: { type: "string" },
      range: { type: "string", enum: ["1M", "6M", "1Y", "MAX"] },
      fast: { type: "integer", minimum: 2, maximum: 100 },
      slow: { type: "integer", minimum: 3, maximum: 250 },
      initialCapital: { type: "number", minimum: 1 }
    },
    required: ["symbol"],
    additionalProperties: false
  }, true),
  tool("report", "Generate a research report", "Use this to combine quote, history, technical analysis, backtest and headlines into a Markdown report and optionally save it locally.", {
    type: "object",
    properties: {
      symbol: { type: "string" },
      range: { type: "string", enum: ["1M", "6M", "1Y", "MAX"] },
      save: { type: "boolean" }
    },
    required: ["symbol"],
    additionalProperties: false
  }, true),
  tool("daily_brief", "Generate the read-only daily portfolio brief", "Use this for a daily portfolio review covering value, concentration, contribution, recent orders, data quality and threshold-based risks. It never places or changes orders.", {
    type: "object",
    properties: {},
    additionalProperties: false
  }, true),
  tool("order_history", "Get read-only order history", "Use this to review Trading 212 order history and local setup/audit events. Vesper does not place or cancel orders.", {
    type: "object",
    properties: { limit: { type: "integer", minimum: 1, maximum: 500 } },
    additionalProperties: false
  }, true)
];

function tool(name, title, description, inputSchema, readOnlyHint, destructiveHint = false) {
  return {
    name,
    title,
    description,
    inputSchema,
    annotations: {
      readOnlyHint,
      destructiveHint,
      idempotentHint: readOnlyHint,
      openWorldHint: name !== "setup"
    }
  };
}

async function setupTool(service, args, env) {
  const patch = {};
  if (args.cloudUrl !== undefined || args.cloudSyncEnabled !== undefined) {
    patch.cloud = {};
    if (args.cloudUrl !== undefined) patch.cloud.url = args.cloudUrl;
    if (args.cloudSyncEnabled !== undefined) patch.cloud.syncEnabled = args.cloudSyncEnabled;
  }
  const config = Object.keys(patch).length ? await updateConfig(patch, env) : await readConfig(env);
  if (Object.keys(patch).length) {
    await appendAudit({ type: "setup_updated", patch: { ...patch, cloud: patch.cloud } }, env);
  }
  const status = await service.status();
  return {
    ...status,
    config: publicConfig(config),
    instructions: service.credentials.configured
      ? "Credentials are configured. Ask for holdings, a chart, analysis, a report or the daily brief."
      : `Credentials are missing. In Terminal run: node "${path.join(pluginRoot(env), "scripts", "setup.mjs")}"`
  };
}

async function startVesperTool(service, args, env, dashboardManager) {
  if (!service.credentials.configured) {
    return {
      ready: false,
      credentialSource: "missing",
      instructions: `Run "${path.join(pluginRoot(env), "scripts", "setup.mjs")}" once to save the Trading 212 API key in macOS Keychain, then run start_vesper again.`
    };
  }
  const manager = await dashboardManager();
  const info = await manager.start({ port: args.port || 8788 });
  const snapshot = await service.snapshot({ force: true });
  const brief = buildPortfolioBrief({ snapshot });
  const orderError = snapshot.errors?.find((error) => error.section === "orders");
  return {
    ready: service.credentials.configured,
    credentialSource: service.credentials.source,
    localUrl: info.localUrl,
    url: info.url,
    status: snapshot.status,
    syncedAt: snapshot.syncedAt,
    positionCount: snapshot.positions?.length || 0,
    orderCount: snapshot.orders?.length || 0,
    orderHistoryStatus: orderError ? "ERROR" : "READY",
    orderHistoryMessage: orderError?.userAction || orderError?.message || null,
    dataQualityErrors: snapshot.errors || [],
    summary: snapshot.summary,
    brief
  };
}

async function holdingsTool(service, args) {
  const snapshot = await service.snapshot({ force: Boolean(args.refresh), full: Boolean(args.full) });
  return {
    status: snapshot.status,
    syncedAt: snapshot.syncedAt,
    summary: snapshot.summary,
    positions: snapshot.positions,
    allocation: snapshot.allocation,
    reconciliation: snapshot.reconciliation,
    errors: snapshot.errors
  };
}

async function piesTool(service, args) {
  const snapshot = await service.snapshot({ force: Boolean(args.refresh) });
  return {
    status: snapshot.reconciliation?.status,
    pies: snapshot.pies,
    reconciliation: snapshot.reconciliation
  };
}

async function tradesTool(service, args) {
  const snapshot = await service.snapshot({ force: Boolean(args.refresh) });
  return calculateTradeReview(snapshot.orders, snapshot.positions, args.symbol || null);
}

async function quoteTool(service, args) {
  return service.quote(args.symbol);
}

async function historyTool(service, args) {
  const history = await service.history(args.symbol, args.range || "1Y", args.interval || "auto");
  let markers = [];
  if (args.includeMarkers !== false) {
    try {
      const snapshot = await service.snapshot();
      markers = tradeMarkers(snapshot.orders, args.symbol);
    } catch {
      markers = [];
    }
  }
  return { ...history, markers };
}

async function dashboardTool(service, args, env, dashboardManager) {
  const manager = await dashboardManager();
  const info = await manager.start({ port: args.port || 8788 });
  return {
    action: args.action || "open",
    ...info,
    note: info.cloudConfigured
      ? "The cloud URL is configured. Run `npm run sync` continuously on this Mac to push snapshots without uploading credentials."
      : "Local mode is active. The dashboard binds to 127.0.0.1 only."
  };
}

async function newsTool(service, args) {
  return { headlines: await service.news.search({ symbol: args.symbol || null, limit: args.limit || 8 }) };
}

async function analysisTool(service, args) {
  return service.analysis(args.symbol, args.range || "1Y");
}

async function backtestTool(service, args) {
  return service.backtest(args.symbol, args.range || "MAX", {
    fast: args.fast || 20,
    slow: args.slow || 50,
    initialCapital: args.initialCapital || 10_000
  });
}

async function reportTool(service, args, env) {
  const markdown = await service.report(args.symbol, args.range || "1Y");
  let file = null;
  if (args.save) {
    const directory = path.join(stateDirectory(env), "reports");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    file = path.join(directory, `${safeFilename(args.symbol)}-${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
    await writeFile(file, markdown, { mode: 0o600 });
  }
  return { symbol: args.symbol, markdown, file };
}

async function dailyBriefTool(service) {
  return service.dailyBrief();
}

async function orderHistoryTool(service, args) {
  const orders = await service.orderHistory();
  const audit = await readAudit(process.env, args.limit || 100);
  return { orders: orders.slice(0, args.limit || 500), audit };
}

function pluginRoot() {
  return path.resolve(new URL("../../", import.meta.url).pathname);
}

function safeFilename(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
}
