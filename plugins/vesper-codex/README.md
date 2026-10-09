# VigilAlpha MCP

This directory contains the VigilAlpha Codex plugin and MCP server. The directory name remains
`vesper-codex` during the one-release compatibility window so existing local work is not broken.

See the repository root [README](../../README.md) for installation, setup, permissions, privacy and usage instructions.

## Secure setup

Use `setup_status` in Codex and complete the inline setup card.

The app-only credential tool validates Trading 212 read access before saving secrets to macOS
Keychain. `npm run setup` is a temporary compatibility fallback.

## Development

```bash
npm run check
npm test
```

## Safety

VigilAlpha is read-only. It cannot place, modify or cancel orders. Research signals are not orders.
