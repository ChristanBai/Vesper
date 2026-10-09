# VigilAlpha

![VigilAlpha logo](plugins/vesper-codex/assets/app-icon.svg)

VigilAlpha is a local-first, strictly read-only Trading 212 risk-review plugin for Codex. It brings
account facts, transaction markers, data-quality checks, strategy evidence and conditional risk
decisions into one conversation. It cannot place, change or cancel an order.

Current development version: `0.1.0-dev.10` · License: MIT · Platform: macOS first

> Development release candidate. GitHub `v1.0` and the public Codex plugin directory are not
> released yet. VigilAlpha does not guarantee profit and is not a substitute for regulated advice.

## What it does

- Verifies Trading 212 credentials locally before saving them to macOS Keychain.
- Reviews concentration, account reconciliation, missing data and independent risk vetoes.
- Reconstructs owned-position transactions and chart markers from read-only account history.
- Explains six strategy modules without presenting an experimental rule as validated.
- Saves owner-only derived snapshots for genuine “what changed?” comparisons.
- Produces conditional `ADD`, `HOLD`, `REDUCE`, `EXIT` or `WAIT` research states; users execute
  any action themselves in Trading 212.

The formal interface is the Codex conversation and its inline cards. The former Vesper browser
dashboard remains available for one compatibility release but is not the product's default path.

## Requirements

- macOS 14 or later
- Node.js 22 or later
- Codex desktop or Codex CLI with plugin support
- Trading 212 Invest or Stocks ISA read-only API credentials

## Install from source

```bash
git clone https://github.com/ChristanBai/Vesper.git VigilAlpha
cd VigilAlpha
codex plugin marketplace add "$PWD"
codex plugin add vigilalpha-codex@vigilalpha
```

Restart Codex and open a new conversation. Select `VigilAlpha` under `+` → More/Plugins, mention
`@VigilAlpha`, or use `/plugins` in Codex CLI. Ask “检查设置和当前运行版本” to open the secure
setup card. Never paste an API key or secret into chat.

The future downloadable package and checksum will be published on the
[GitHub Releases page](https://github.com/ChristanBai/Vesper/releases) after the release gates pass.
See [the installation guide](docs/INSTALL.md) for permissions, setup and verification.

## Public tools

| Tool | Purpose |
| --- | --- |
| `setup_status` | Keychain, account-verification, market-source and local-data status |
| `portfolio_review` | Portfolio risk, risk vetoes, data quality and review queue |
| `holding_review` | Account facts, evidence, strategy modules and research signal |
| `strategy_review` | Strategy source, maturity, validation and cost disclosure |
| `decision_review` | Conditional shadow action, quantity and estimated economics |
| `learning_review` | Shadow outcomes, failures and human promotion gate |
| `portfolio_changes` | Compare actual saved derived snapshots |
| `monitor_review` | Quiet material-change check for scheduled reviews |
| `local_data` | Local status, export and explicitly confirmed deletion |

`configure_credentials` is app-only. The model cannot call it and credential values are not
returned to the conversation.

## Trading 212 permissions

Enable only the read permissions needed for account data, portfolio, Pies, order/transaction/
dividend history and metadata. Do **not** enable `Orders - Execute` or `Pies - Write`. The client
rejects every non-GET Trading 212 request in code.

## Local data and privacy

- API credentials are stored in macOS Keychain, not project files or chat.
- Normalized cache, configuration and derived history remain local with owner-only permissions.
- Cloud sync and telemetry are disabled.
- API response bodies are excluded from failure messages.
- `local_data` provides export and deletion; deletion requires the explicit confirmation phrase.

See [SECURITY.md](SECURITY.md) before reporting a vulnerability. Never include credentials,
account identifiers, holdings or transaction details in a public issue.

## Development

```bash
cd plugins/vesper-codex
npm run check
npm test
```

Build the same installable archive used by CI:

```bash
./scripts/build-release.sh
(cd dist && shasum -a 256 -c vigilalpha-codex-0.1.0-dev.10.zip.sha256)
```

Read [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md) and the current
[release checklist](RELEASE_CHECKLIST.md) before proposing a release.

## Status boundary

Passing unit tests proves deterministic code paths, not investment performance. A strategy remains
experimental until its historical, out-of-sample, cost and shadow-observation gates are recorded
and a human approves promotion. Missing evidence produces `WAIT`, not a fabricated direction.
