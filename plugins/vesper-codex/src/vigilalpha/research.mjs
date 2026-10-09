export const SOURCE_EVIDENCE_VERSION = "vigilalpha.source-evidence.v1";
export const PATTERN_SPEC_VERSION = "vigilalpha.pattern-spec.v1";

export const SOURCE_EVIDENCE = Object.freeze([
  source("fidelity-chart-patterns", "B", "Fidelity chart patterns", "https://www.fidelity.com/bin-public/060_www_fidelity_com/documents/learning-center/Deck_Chart%20patterns.pdf", "Chart definitions, confirmation and failed-breakout examples."),
  source("cfa-technical-analysis-review", "A", "CFA Institute technical analysis literature review", "https://rpc.cfainstitute.org/sites/default/files/-/media/documents/book/rf-lit-review/2016/rflrv11n11.pdf", "Method limits, subjectivity and need for algorithmic validation."),
  source("aqr-century-trend", "C", "AQR: A Century of Evidence on Trend-Following Investing", "https://www.aqr.com/insights/research/journal-article/a-century-of-evidence-on-trend-following-investing", "Long-horizon trend hypothesis; not direct evidence for a single holding."),
  source("nber-momentum-crashes", "A", "NBER: Momentum Crashes", "https://www.nber.org/papers/w20660", "Momentum tail-risk and regime failure evidence."),
  source("cfa-technical-rules-revisited", "A", "CFA Institute: Technical Trading Revisited", "https://rpc.cfainstitute.org/research/cfa-digest/2013/02/technical-trading-revisited-false-discoveries-persistence-tests-and-transaction-costs-digest", "False-discovery, persistence and transaction-cost gate." )
]);

export const PATTERN_SPECS = Object.freeze([
  pattern({
    id: "sma-trend-cross", name: "Moving-average trend and crossover", version: "1.0.0",
    sources: ["aqr-century-trend", "cfa-technical-rules-revisited"], requiredData: ["daily.close"], lookback: 51,
    formation: "Compute fast and slow simple moving averages from data available at each close.",
    trigger: "Fast SMA crosses above slow SMA; execution is evaluated no earlier than the next bar.",
    confirmation: "Latest close is above both averages.", buy: "Candidate only after bullish crossover and confirmation.",
    exit: "Candidate after bearish crossover.", protection: "Risk veto remains independent.",
    invalidation: "Insufficient history, stale data or non-finite prices.", failures: ["Range-bound whipsaw", "Gap risk"],
    evidenceGrade: "CANDIDATE", imageUse: "illustrative"
  }),
  pattern({
    id: "rsi-momentum", name: "RSI momentum regime", version: "1.0.0",
    sources: ["nber-momentum-crashes", "cfa-technical-analysis-review"], requiredData: ["daily.close"], lookback: 15,
    formation: "Calculate RSI from trailing close-to-close changes.", trigger: "RSI moves above 55 or below 45.",
    confirmation: "Threshold persists at the data cutoff.", buy: "Above 55 is a positive research candidate.",
    exit: "Below 45 is a negative research candidate.", protection: "No standalone sizing authority.",
    invalidation: "Short history or non-finite closes.", failures: ["Momentum crash", "Fast reversal"],
    evidenceGrade: "CANDIDATE", imageUse: "illustrative"
  }),
  pattern({
    id: "volume-breakout-20", name: "20-session breakout with volume confirmation", version: "1.0.0",
    sources: ["fidelity-chart-patterns", "cfa-technical-analysis-review"], requiredData: ["daily.high", "daily.close", "daily.volume"], lookback: 21,
    formation: "Use the prior 20 completed sessions as resistance and average-volume windows.",
    trigger: "Close exceeds prior 20-session high.", confirmation: "Volume exceeds 1.5 times prior 20-session average volume.",
    buy: "Candidate after close and volume confirmation.", exit: "Close falls below the 20-session average or breakout fails.",
    protection: "ATR and concentration vetoes are evaluated separately.", invalidation: "Volume missing, late or non-comparable.",
    failures: ["False breakout", "Selection bias in chart examples"], evidenceGrade: "CANDIDATE", imageUse: "illustrative"
  }),
  pattern({
    id: "volatility-drawdown-veto", name: "Volatility and drawdown risk veto", version: "1.0.0",
    sources: ["cfa-technical-analysis-review"], requiredData: ["daily.close"], lookback: 20,
    formation: "Calculate trailing annualized volatility and observed peak-to-trough drawdown.",
    trigger: "Configured volatility or drawdown threshold is breached.", confirmation: "Finite chronological price series.",
    buy: "Never creates a buy candidate.", exit: "Creates a risk review, not an automatic sale.",
    protection: "Cannot be hidden by directional consensus.", invalidation: "Discontinuous or short history.",
    failures: ["Historical risk can understate future loss"], evidenceGrade: "ACCOUNT_RISK_RULE", imageUse: "not_applicable"
  })
]);

export function patternRegistry() {
  return {
    contractVersion: PATTERN_SPEC_VERSION,
    sources: SOURCE_EVIDENCE,
    patterns: PATTERN_SPECS,
    runtimePolicy: "Research notes and images create candidates only; only versioned code is executable."
  };
}

function source(id, grade, title, url, use) {
  return { contractVersion: SOURCE_EVIDENCE_VERSION, id, grade, title, url, publishedAt: null, conflictOfInterest: grade === "B" || grade === "C" ? "Provider or investment-firm educational/research material" : null, use };
}

function pattern(value) {
  return {
    contractVersion: PATTERN_SPEC_VERSION,
    horizon: "daily-bars-weeks-to-months",
    assetScope: "current-equity-holdings",
    transactionCostPolicy: "versioned_cost_assumption_required",
    maturity: "experimental",
    productionWeight: 0,
    ...value
  };
}
