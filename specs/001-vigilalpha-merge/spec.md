# VigilAlpha merge specification

**Status:** Approved for implementation  
**Date:** 2026-10-06  
**Product owner:** Howard  

## Problem

Trading 212 presents account and instrument facts but does not turn them into an evidence-bounded,
repeatable risk review. Vesper already provides the local read-only account connection and market
data path. Adstevern already defines abstention, evidence quality and review conditions. Maintaining
them as separate customer products duplicates setup and leaves neither product with a complete
decision-quality workflow.

## Product outcome

VigilAlpha is a macOS-first, local, read-only Codex plugin for Trading 212 Invest and Stocks ISA.
The formal user surface is Codex conversation plus inline UI. It helps a user understand current
portfolio risk, inspect one holding, compare saved derived snapshots and review strategy evidence.
It does not place, modify or cancel orders and does not promise profit.

## Public model-facing tools

- `setup_status`
- `portfolio_review`
- `holding_review`
- `strategy_review`
- `portfolio_changes`
- `monitor_review`
- `local_data`

An app-only `configure_credentials` tool may accept secrets from the setup card. It must never make
credentials visible to the model, tool output, logs, configuration files or audit files.

## Functional requirements

1. Preserve a GET-only Trading 212 boundary and expose no order mutation tool.
2. Store Trading 212 credentials only in macOS Keychain and validate them before saving.
3. Return only normalized, task-relevant account facts; never return account IDs or raw responses.
4. Save append-only derived portfolio snapshots with mode `0600`, prune after 12 months, and support
   explicit export and deletion.
5. Report six named strategy modules using one versioned result contract. Experimental strategies
   have zero consensus weight.
6. Keep risk vetoes separate from research consensus. Missing or stale data cannot be hidden.
7. Use five research states: `CONSIDER_ENTRY`, `WATCH`, `HOLD`, `REDUCE_RISK`, `REVIEW_EXIT`.
8. Provide a setup inline UI resource and text/table fallback. Additional chart resources are staged
   work and must not be represented as complete until host rendering is exercised.
9. Keep `start_vesper` and existing Vesper tools for one compatibility release with deprecation
   labels. New documentation and examples use VigilAlpha only.
10. Preserve deterministic output for the same normalized input, configuration version and data
    cutoff.

## Privacy and safety

- No telemetry or cloud sync in the VigilAlpha default path.
- No chat text or full holdings in audit records.
- Local deletion requires the exact confirmation phrase `DELETE_LOCAL_DATA`.
- Account review must remain useful without a separate market-data key; unavailable market evidence
  is explicitly degraded rather than silently substituted.
- Signals are research labels, not executable orders or individualized guarantees.

## Acceptance criteria for the first implementation slice

- Existing 25 Vesper tests remain green.
- New tool contracts, strategy maturity rules, derived snapshot storage, change detection, deletion
  confirmation, credential-output redaction and inline resource metadata have automated tests.
- MCP initialization advertises VigilAlpha and the seven stable model-facing tools.
- Source scan finds no POST/PUT/PATCH/DELETE request path in the Trading 212 client.
- The old tools continue to resolve and are explicitly marked deprecated.
- Live account, Keychain round-trip, Codex inline rendering and clean-machine installation are reported
  as unverified unless actually exercised.

## Non-goals for this slice

- Publishing a GitHub release or applying to the public OpenAI plugin directory.
- Claiming long-term profitability or upgrading strategy maturity without evidence.
- Deleting the old dashboard or Adstevern repository.
- Supporting CFD, options, crypto derivatives, multi-account or non-macOS credential storage.
