# VigilAlpha decision and learning implementation plan

## Architecture

```text
Trading 212 GET history -> normalized execution ledger -> completeness contract
market OHLCV + PatternSpec registry -> chronological cost-aware validation
current holding + risk veto + validated evidence -> SHADOW conditional decision
shadow JSONL -> 20/60-session outcome evaluation -> pending promotion proposal
sanitized summary -> Blackstone human decision -> versioned code/config change
```

## Modules

- `core/portfolio.mjs`: broker fill and wallet-impact normalization.
- `core/sync-service.mjs`: exhaustive guarded pagination and completeness.
- `vigilalpha/research.mjs`: source evidence and PatternSpec registry.
- `vigilalpha/validation.mjs`: next-bar, cost-aware chronological validation.
- `vigilalpha/decision.mjs`: conditional risk-target sizing and WAIT gates.
- `vigilalpha/learning-store.mjs`: sanitized shadow decisions and outcomes.
- `vigilalpha/reviews.mjs`: strategy, decision and learning orchestration.
- `mcp/tools.mjs`: stable public tools.

## Safety

The new layer consumes normalized facts and emits plans only. It has no dependency on a write-capable
broker client. Every strategy promotion remains a code/config review outside runtime execution.

## Rollback

Remove the two new tools and new VigilAlpha modules; keep the improved normalized ledger and
completeness metadata because they are backward-compatible read-only facts.
