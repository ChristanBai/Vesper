import { PATTERN_SPECS } from "./research.mjs";
import { evaluatePatternSignal } from "./validation.mjs";

const RULES = {
  "sma-trend-cross": {
    formula: "SMA(n) = sum(last n closes) / n; positive regime = SMA20 > SMA50",
    enter: "The simulated state changes from flat to positive when SMA20 > SMA50.",
    exit: "The simulated state changes to flat when SMA20 <= SMA50.",
    failure: "Sideways markets can cause repeated losing switches."
  },
  "rsi-momentum": {
    formula: "RSI14 = 100 - 100 / (1 + mean(gains14) / mean(losses14)); trailing simple means, not Wilder smoothing",
    enter: "RSI14 > 55 changes the simulated state to positive; 45..55 retains its prior state.",
    exit: "RSI14 < 45 changes the simulated state to flat.",
    failure: "Fast reversals and momentum crashes can invalidate the observed regime."
  },
  "volume-breakout-20": {
    formula: "close > max(previous 20 highs) AND volume > 1.5 * mean(previous 20 volumes)",
    enter: "Both price breakout and volume confirmation must hold at the completed daily close.",
    exit: "Close falls below SMA20 when no new confirmed breakout is present.",
    failure: "False breakouts, price gaps and inconsistent volume can invalidate the pattern."
  }
};

export function conditionalPatterns(history, { asOf = new Date().toISOString() } = {}) {
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) throw new Error("A valid asOf timestamp is required.");
  const base = {
    contractVersion: "vigilalpha.conditional-patterns.v1", mode: "RESEARCH_ONLY",
    productionWeight: 0, executionAuthority: "NONE", evaluatedAt: asOf,
    formulaParameters: "Versioned research hypotheses; not learned optimal thresholds.",
    timing: "Observe completed prior UTC dates only; hypothetical execution is no earlier than the next bar.",
    rules: [], markers: []
  };
  if (!["1D", "1d", "1day"].includes(history?.interval)) {
    return { ...base, status: "UNAVAILABLE", reason: "DAILY_INTERVAL_REQUIRED" };
  }
  const today = new Date(now).toISOString().slice(0, 10);
  const bars = (history.bars || []).filter((bar) => Number.isFinite(Date.parse(bar?.time))
    && Date.parse(bar.time) <= now && new Date(bar.time).toISOString().slice(0, 10) < today);
  if (bars.some((bar, i) => !Number.isFinite(bar.close) || bar.close <= 0
    || (i > 0 && Date.parse(bar.time) <= Date.parse(bars[i - 1].time)))) {
    return { ...base, status: "UNAVAILABLE", reason: "INVALID_OR_DUPLICATE_PRICE_SERIES" };
  }
  const cutoff = bars.at(-1)?.time || null;
  if (cutoff && now - Date.parse(cutoff) > 7 * 86_400_000) {
    return { ...base, status: "STALE", reason: "HISTORY_STALE", sourceCutoff: cutoff,
      freshnessPolicy: "Seven calendar days is a conservative research-display limit, not a tested trading threshold." };
  }
  const rules = [];
  const markers = [];
  for (const pattern of PATTERN_SPECS.filter((item) => RULES[item.id])) {
    const definition = RULES[pattern.id];
    const volumeMissing = pattern.id === "volume-breakout-20" && bars.some((bar) =>
      !Number.isFinite(bar.high) || !Number.isFinite(bar.volume) || bar.volume < 0);
    if (bars.length <= pattern.lookback || volumeMissing) {
      rules.push({ patternId: pattern.id, ...definition, state: "UNAVAILABLE", reason: volumeMissing ? "OHLCV_INCOMPLETE" : "INSUFFICIENT_HISTORY", sourceIds: pattern.sources });
      continue;
    }
    let state = 0;
    let previous = 0;
    for (let index = pattern.lookback; index < bars.length; index += 1) {
      previous = state;
      state = evaluatePatternSignal(pattern, bars, index, previous);
      if (state !== previous) markers.push({
        patternId: pattern.id, time: bars[index].time, price: bars[index].close,
        state: state ? "ENTRY_CANDIDATE" : "EXIT_CANDIDATE", kind: "RESEARCH_CANDIDATE", isExecution: false
      });
    }
    rules.push({ patternId: pattern.id, patternVersion: pattern.version, ...definition,
      state: state !== previous ? (state ? "ENTRY_CANDIDATE" : "EXIT_CANDIDATE") : (state ? "POSITIVE_REGIME" : "WAIT"),
      sourceIds: pattern.sources, invalidation: "Missing/stale data, changed parameters or conflicting portfolio risk require review." });
  }
  return { ...base, status: rules.some((rule) => rule.state !== "UNAVAILABLE") ? "AVAILABLE" : "UNAVAILABLE", sourceCutoff: cutoff,
    currency: history.currency || null, rules, markers: markers.sort((a, b) => Date.parse(a.time) - Date.parse(b.time)).slice(-60),
    disclaimer: "Candidate observations are not broker fills, orders, calibrated predictions or evidence of profitability." };
}
