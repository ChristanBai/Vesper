# Vesper MCP

This directory contains the Vesper Codex plugin and MCP server.

See the repository root [README](../../README.md) for installation, setup, permissions, privacy and usage instructions.

## Local setup

```bash
npm run setup
```

The setup command validates Trading 212 credentials before saving them to macOS Keychain.

## Development

```bash
npm run check
npm test
```

## Safety

Vesper is read-only. It cannot place, modify or cancel orders.
