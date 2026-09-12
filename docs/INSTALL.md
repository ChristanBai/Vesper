# Vesper Installation

## Requirements

- macOS 14 or later
- Node.js 22 or later
- Codex with plugin support
- Trading 212 Invest or Stocks ISA account

## Install the plugin

```bash
git clone https://github.com/ChristanBai/Vesper.git
cd Vesper
codex plugin marketplace add "$PWD"
codex plugin add vesper-codex@vesper
```

Open a new Codex task after installation.

## Configure Trading 212

In Trading 212, open `Settings > API (Beta) > Permissions`.

Enable read-only permissions:

- Account data
- Portfolio
- Pies - Read
- History - Orders
- History - Transactions
- History - Dividends
- Orders - Read
- Metadata

Do not enable `Orders - Execute` or `Pies - Write`.

## Store credentials securely

Run the setup command from Terminal:

```bash
cd /path/to/Vesper/plugins/vesper-codex
npm run setup
```

The API Secret input is hidden. Vesper validates the credentials before storing them in macOS Keychain. Do not paste credentials into a Codex prompt or issue.

## Start

In the new Codex task, say:

```text
启动 Vesper
```

The `start_vesper` tool checks configuration, refreshes account data, generates a brief and starts the local dashboard.

## Optional Twelve Data

For 10-minute charts and broader UK/EU intraday coverage, add a free Twelve Data key when prompted by `npm run setup`.
