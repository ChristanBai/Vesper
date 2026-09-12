---
name: vesper
description: Use the Vesper MCP to review a Trading 212 portfolio, reconcile Pies, chart buy and sell markers, research symbols, run backtests, prepare reports, and generate a read-only daily brief. Use when the user refers to Vesper, Trading 212 holdings, portfolio risk, Pies, order history, or daily portfolio monitoring. Vesper cannot place, modify, or cancel orders.
---

# Vesper

Use the Vesper MCP for all Trading 212 account and market work. Keep account numbers, credentials, positions, and transaction details local. Never place secrets in tool arguments, files, logs, prompts, or tool output.

## Read-only boundary

- Vesper has no order placement, order cancellation, Pie modification, or account write capability.
- Do not suggest that the user enable Trading 212 `Orders - Execute` or `Pies - Write` permissions for Vesper.
- Treat `trades` and `order_history` as read-only historical reviews.
- All investment decisions remain with the user in the Trading 212 app.

## Required flow

0. When the user says "启动 Vesper", "Start Vesper" or "运行 Vesper", call `start_vesper` first. This is the one-command bootstrap: it verifies configuration, refreshes account and order history, starts the dashboard, and returns the browser URL.
1. Call `setup` when the user first connects an account or asks whether Vesper is ready.
2. Call `holdings` before portfolio risk or allocation conclusions.
3. Call `pies` when the user asks whether a Pie matches the brokerage account.
4. Call `daily_brief` for daily monitoring, portfolio risk or a concise account review.
5. Call `history` when the user asks for a chart or execution markers.
6. Call `dashboard` when the user wants the visual workspace. Return the local URL and open it in the Codex Browser when the host supports browser tabs.
7. Label every quote with its provider, update time, and delay. Never describe delayed data as real-time.

## Optional Longbridge MCP

If an authenticated Longbridge MCP is available, it may be used alongside Vesper for read-only quotes, candlesticks, fundamentals and Longbridge news. Keep Vesper as the source of the Trading 212 account. Never call Longbridge trading, order, DCA or portfolio-write tools in this workflow.

## Research rules

- Call `analysis` for technical observations and `backtest` for hypothetical strategy results.
- State that technical analysis, forecasts, and backtests are not investment advice and do not guarantee returns.
- Distinguish realized from unrealized profit or loss.
- Keep Pies manual: the Trading 212 API cannot modify Pies.
- Cite timestamps because quotes and account snapshots can change.
- Do not convert analysis into an unconditional buy or sell instruction. Express observations as evidence, risks, triggers, and invalidation conditions.

## Daily brief

For a scheduled or requested daily review:

1. Call `setup`.
2. Call `holdings` with `refresh: true`.
3. Call `daily_brief`.
4. If needed, investigate the largest risk or contribution positions with `quote`, `history`, `analysis`, and `news`; use Longbridge read-only tools when they provide better coverage.
5. Present a short brief with portfolio value, concentration, top contributors, largest drags, material risks, data quality, and recent orders.
6. Include the source timestamp and explicitly state that the brief is read-only research, not investment advice.

## User-facing outputs

Prefer concise tables or short summaries:

| Request | Tool sequence |
| --- | --- |
| "What do I own?" | `holdings` |
| "Are my Pies correct?" | `pies` |
| "Show my buys and sells" | `history` |
| "Run my daily brief" | `holdings`, `daily_brief`, optionally `analysis` and `news` |
| "Open my portfolio workspace" | `dashboard` |
| "Analyze AAPL" | `quote`, `history`, `analysis`, optionally `news` |
| "Generate a report" | `report` |

Never end a portfolio review with an executable order command. End with the evidence, uncertainty, and conditions the user should monitor.
