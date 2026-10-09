---
name: vigilalpha
description: Use VigilAlpha for local, read-only Trading 212 Invest or Stocks ISA portfolio risk reviews, holding analysis, strategy evidence, saved snapshot comparisons, and quiet monitoring. Trigger when the user mentions VigilAlpha, Trading 212 portfolio risk, concentration, holding review, buy/sell history, strategy maturity, or portfolio changes. Never place, modify or cancel orders.
---

# VigilAlpha

VigilAlpha turns local Trading 212 account facts and dated market evidence into an explicit risk
review. It is not a profit promise, price oracle or trading executor.

## Permanent safety boundary

- Never ask the user to enable order execution, Pie write or account write permissions.
- Never call a write-trading endpoint. No such tool should exist.
- Never request API keys in chat. Use the inline setup card surfaced by `setup_status`.
- Treat five-level signals as research states, never as orders.
- Keep risk vetoes, missing evidence and source failure visible even when the user changes parameters.

## Default flow

1. Call `setup_status`.
2. If configuration is missing, present the secure inline setup card or concise local fallback.
3. For portfolio questions call `portfolio_review` before drawing conclusions.
4. For one owned symbol call `holding_review`.
5. Use `strategy_review` only when the user asks about strategy evidence or backtesting.
6. Use `decision_review` for an explicit conditional plan for a current holding. Always call it a
   shadow, read-only plan; repeat its triggers, invalidations, cost assumptions and data gate. Never
   translate it into an order or imply that the user must act.
7. Use `learning_review` for observed shadow performance and promotion readiness. Blackstone notes
   and newly found webpages never change runtime behavior without a separately approved version.
8. Use `portfolio_changes` only for real saved VigilAlpha snapshots; never invent history.
9. For scheduled checks call `monitor_review`. Say nothing when `notify` is false unless the user
   explicitly asked for a status report.
10. Use `local_data` for status/export. Deletion requires the user's explicit confirmation and the
   tool's exact confirmation phrase.

## Presentation

- Lead with data cutoff, risk veto and what materially changed.
- Separate account facts, market evidence, strategy result, uncertainty and review condition.
- Explain `experimental` means zero consensus weight.
- Prefer plain Chinese when the user writes Chinese; retain exact enum names when they help audit.
- End with conditions to review, not an executable buy or sell command.

## Legacy compatibility

The old Vesper tool names remain for one compatibility release. Do not use them in new workflows
unless the user explicitly requests the old dashboard or a migration check. `start_vesper` and the
browser dashboard are deprecated and are not VigilAlpha's product surface.
