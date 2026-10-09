# VigilAlpha decision and learning specification

**Status:** Approved for shadow implementation  
**Date:** 2026-10-08  
**Authority:** Adstevern CR-009

## Outcome

VigilAlpha can reconstruct execution facts, evaluate source-linked deterministic rules, and produce
a conditional shadow plan for an existing holding. It records the plan and later 20/60-session
outcomes without changing the account or silently changing production rules.

## Requirements

1. Follow Trading 212 order/transaction cursors until exhausted, with loop and safety guards.
2. Preserve fill type, fill identity, wallet currency, FX rate, net value, realised P&L, taxes and
   other explicit fees. Corporate actions are ledger events, not buy/sell markers.
3. Expose history completeness and never describe a capped or failed fetch as complete.
4. Define every research rule as a versioned `PatternSpec` linked to source evidence.
5. Use numerical OHLCV conditions. Image interpretation is illustrative until reconstructed.
6. Validate chronologically using next-bar execution and declared costs. Never random-shuffle time.
7. Keep experimental strategies at zero consensus weight.
8. `decision_review` supports current holdings only and returns `SHADOW`; incomplete evidence returns
   `WAIT` except for an explicitly labelled account-risk reduction plan.
9. Risk-target sizing reduces a breached holding toward 80% of its configured maximum weight,
   clamped to the broker-reported tradable quantity.
10. `learning_review` reports shadow counts, evaluable outcomes, failures and pending proposals. It
    never promotes a strategy.
11. Store shadow records as mode `0600`, append-only, sanitized JSONL. No secret, account ID, full
    portfolio or raw response is stored.
12. Maintain a GET-only Trading 212 client and expose no order-write tool.

## Release gate

Implementation and deterministic tests can complete now. Production action plans remain blocked
until 90 days, 30 evaluable shadow decisions, published failures and explicit human promotion.
