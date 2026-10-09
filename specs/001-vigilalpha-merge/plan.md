# VigilAlpha implementation plan

## Architecture decision

Extend the existing Node.js MCP runtime. Add a VigilAlpha application layer above Vesper's normalized
account/market services and retain legacy tools as a one-release adapter. Do not embed the Adstevern
Python application.

```text
Codex Skill / inline UI
        |
VigilAlpha public tools
        |
reviews + strategy contracts + risk veto
        |
normalized Vesper account and market services
        |
Trading 212 GET-only client / optional market sources

derived snapshot store (local JSONL, 0600) <- portfolio_review / monitor_review
```

## Boundaries

- `src/vigilalpha/reviews.mjs`: product-facing orchestration and redacted result shapes.
- `src/vigilalpha/strategies.mjs`: deterministic six-strategy contract and zero-weight maturity gate.
- `src/vigilalpha/snapshot-store.mjs`: append, retention, comparison, export and deletion.
- `src/vigilalpha/inline-ui.mjs`: locally bundled MCP App HTML resources; no CDN.
- `src/mcp/tools.mjs`: stable tool surface and Vesper compatibility adapter.
- `src/mcp/server.mjs`: MCP resources, metadata and safe summaries.

## Migration and rollback

- Keep the physical `plugins/vesper-codex` path during the compatibility release so existing local
  installations and dirty work are not broken.
- Change the manifest identity and MCP server name to VigilAlpha; retain a `vesper` MCP alias in the
  local manifest for one release if required by the host.
- Do not move or delete state during the first slice. Read the existing Vesper state directory and
  write new derived snapshots in a dedicated child directory.
- Rollback removes the VigilAlpha modules and manifest aliases; the legacy tool/runtime remains.

## Verification

1. Unit tests for pure strategies and snapshot store.
2. MCP subprocess test for tool and resource advertisement.
3. Existing regression suite.
4. Static scan of Trading 212 request methods and secret-bearing output fields.
5. Later manual gates: Keychain, real account reconciliation, inline UI in Codex, clean macOS install.
