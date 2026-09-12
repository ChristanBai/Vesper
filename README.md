# Vesper

Local-first, read-only Trading 212 intelligence for Codex.

Version: `2.0.0` · Author: ChristanBai

[English](#english) | [中文](#中文)

[Latest Release](https://github.com/ChristanBai/Vesper/releases/latest) | [Installation Guide](docs/INSTALL.md)

---

## English

Vesper is a read-only MCP server and local web dashboard for Trading 212. It reads a user's real account, positions, Pies, order history, cash movements, market data and news, then produces portfolio analysis inside Codex.

Vesper cannot place, modify or cancel orders. All investment decisions remain with the user.

### How it runs in Codex

```text
Trading 212 API
        |
        v
Vesper MCP (Node.js, local)
        |
        +-- Codex tools
        +-- Local web dashboard
        +-- Local cache and reports
```

The MCP server runs over stdio. Codex launches it automatically after the plugin is installed. Credentials are read from macOS Keychain or environment variables and are never sent to GitHub.

### Strategy

- Read-only by design: no order placement, cancellation or account writes.
- Real account first: account value, positions, Pies, orders and cash movements come from Trading 212.
- Evidence second: market quotes, K-lines, news and fundamentals are labeled with their source and delay.
- Portfolio-level analysis: concentration, contribution, drawdown, trade review and daily brief.
- Human decision last: Vesper provides research and risk awareness, not executable trade instructions.

### Features

- Real holdings and Pie reconciliation.
- Buy and sell markers on candlestick charts.
- Per-position P&L, return and latest execution time.
- Daily portfolio brief with concentration and risk review.
- Technical analysis, backtests, news and Markdown reports.
- Local web dashboard opened inside Codex.
- Chinese and English dashboard.

### Requirements

- macOS 14 or later.
- Node.js 22 or later.
- Codex desktop or Codex CLI with plugin support.
- A Trading 212 Invest or Stocks ISA account and API key.
- Optional Twelve Data key for broader intraday coverage.

### Install

1. Clone this repository.
2. From the repository root:

```bash
codex plugin marketplace add /absolute/path/to/Vesper
codex plugin add vesper-codex@vesper
```

3. Start a new Codex task. Newly installed MCP tools do not appear in an already running task.

See [docs/INSTALL.md](docs/INSTALL.md) for a clean-machine installation walkthrough.
4. Configure credentials from Terminal, not through chat:

```bash
cd /absolute/path/to/Vesper/plugins/vesper-codex
npm run setup
```

The setup command:

1. Reads the Trading 212 API Key.
2. Reads the API Secret with hidden input.
3. Verifies the credentials with Trading 212 before saving.
4. Stores them in macOS Keychain.
5. Optionally stores a Twelve Data key in macOS Keychain.

Never send an API key or secret directly in a Codex prompt, GitHub issue, screenshot or public log.

### Trading 212 permissions

In Trading 212, open `Settings > API (Beta) > Permissions`.

Enable:

- Account data
- Portfolio
- Pies - Read
- History - Orders
- History - Transactions
- History - Dividends
- Orders - Read
- Metadata

Do not enable:

- Orders - Execute
- Pies - Write

Vesper rejects all non-GET Trading 212 requests in code.

### Use in Codex

Say:

```text
启动 Vesper
```

This calls `start_vesper`, which checks configuration, refreshes account and order data, generates a daily brief and starts the local dashboard.

Useful requests:

```text
我的真实持仓成本是多少？
哪些股票对收益贡献最大？
显示我每只股票的买卖时间点。
打开 Vesper 看板。
生成我的每日组合简报。
```

### MCP tools

| Tool | Purpose |
| --- | --- |
| `setup` | Check local configuration and data-source status |
| `start_vesper` | One-command startup and initial refresh |
| `holdings` | Account, positions, allocation and Pies reconciliation |
| `pies` | Pie composition versus brokerage positions |
| `trades` | Realized and unrealized P&L, executions and markers |
| `quote` | Current quote with source and delay |
| `history` | OHLCV bars and buy/sell markers |
| `news` | Recent headlines and coarse sentiment |
| `analysis` | Technical indicators and confidence |
| `backtest` | Hypothetical strategy backtest |
| `daily_brief` | Daily portfolio review |
| `report` | Markdown research report |
| `dashboard` | Local dashboard URL |
| `order_history` | Read-only order and audit history |

### Data sources

| Source | Purpose |
| --- | --- |
| Trading 212 | Account, positions, Pies, orders and cash movements |
| TradingView public quote | Quote fallback with delay labels |
| Yahoo Finance | Historical bars and quote fallback |
| Nasdaq | US daily-bar fallback |
| Twelve Data | Optional global intraday and historical bars |
| Longbridge MCP | Optional separate read-only market/news integration |

Available chart intervals: `Auto`, `10m`, `15m`, `30m`, `1h`, `1D`, `1W`.

### Privacy and security

- Credentials are stored in macOS Keychain or environment variables.
- Account data and caches remain local by default.
- Cloud sync is disabled by default and never uploads API secrets.
- Repository releases contain no accounts, holdings, caches or API credentials.
- The published source contains synthetic tests only.

### Disclaimer

Vesper is an information and risk-review tool. It is not investment advice, does not guarantee returns and does not replace a licensed adviser or independent judgement.

---

## 中文

Vesper 是一个本地优先、严格只读的 Trading 212 MCP 服务和网页看板。它读取用户的真实账户、持仓、Pies、订单历史、现金流水、行情和新闻，并在 Codex 中完成组合分析。

Vesper 不能下单、改单或撤单。最终投资判断始终由用户自己完成。

### 它在 Codex 中如何运行

```text
Trading 212 API
        |
        v
Vesper MCP（Node.js，本地运行）
        |
        +-- Codex 工具
        +-- 本地网页看板
        +-- 本地缓存与报告
```

MCP 使用 stdio 运行。安装插件后，Codex 会自动启动它。凭证从 macOS Keychain 或环境变量读取，不会上传到 GitHub。

### 策略

- 只读：不提供下单、撤单或账户写入能力。
- 真实账户优先：账户价值、持仓、Pies、订单和现金流水来自 Trading 212。
- 证据第二：行情、K 线、新闻和基本面必须标注来源、时间和延迟。
- 组合分析：集中度、收益贡献、回撤、交易复盘和每日简报。
- 人做最后决定：Vesper 只提供研究和风险提示，不生成可执行订单。

### 主要能力

- 真实持仓和 Pie 核验。
- K 线买入、卖出标记。
- 每只股票的收益率、未实现盈亏和最近成交时间。
- 每日组合简报、集中度和风险审查。
- 技术分析、回测、新闻和 Markdown 报告。
- 在 Codex 内部打开本地网页看板。
- 看板支持中文和英文。

### 安装

1. 克隆仓库。
2. 在仓库根目录运行：

```bash
codex plugin marketplace add /absolute/path/to/Vesper
codex plugin add vesper-codex@vesper
```

3. 新开一个 Codex 任务。

完整步骤见 [docs/INSTALL.md](docs/INSTALL.md)。
4. 在 Terminal 中配置凭证，不要在聊天窗口发送 API Key：

```bash
cd /absolute/path/to/Vesper/plugins/vesper-codex
npm run setup
```

配置向导会：

1. 读取 Trading 212 API Key。
2. 隐藏输入 API Secret。
3. 保存前先向 Trading 212 验证凭证。
4. 将凭证保存到 macOS Keychain。
5. 可选保存 Twelve Data Key。

### Trading 212 权限

在 Trading 212 中打开 `Settings > API (Beta) > Permissions`。

开启：

- Account data
- Portfolio
- Pies - Read
- History - Orders
- History - Transactions
- History - Dividends
- Orders - Read
- Metadata

不要开启：

- Orders - Execute
- Pies - Write

Vesper 在代码层拒绝所有非 GET 的 Trading 212 请求。

### 在 Codex 中使用

直接说：

```text
启动 Vesper
```

它会调用 `start_vesper`，一次完成配置检查、账户和订单同步、每日简报及看板启动。

### 数据源

| 数据源 | 用途 |
| --- | --- |
| Trading 212 | 账户、持仓、Pies、订单和现金流水 |
| TradingView public quote | 带延迟标签的报价兜底 |
| Yahoo Finance | 历史 K 线和报价兜底 |
| Nasdaq | 美股日线兜底 |
| Twelve Data | 可选的全球分钟级和历史行情 |
| Longbridge MCP | 可选的外部只读行情和新闻接入 |

图表时间粒度：`Auto`、`10m`、`15m`、`30m`、`1h`、`1D`、`1W`。

### 隐私与安全

- 凭证保存在 macOS Keychain 或用户自己的环境变量中。
- 账户数据和缓存默认只保存在本机。
- 云端同步默认关闭，并且从不上传 API Secret。
- Release 不包含账户、持仓、缓存或 API 凭证。
- 仓库中的测试只使用虚拟数据。

### 免责声明

Vesper 是信息整理和风险提示工具，不构成投资建议，不保证收益，也不替代持牌顾问或用户自己的独立判断。
