import { relativeStrengthIndex, simpleMovingAverage } from "../analysis/technical.mjs";

export const VALIDATION_VERSION = "vigilalpha.walk-forward.v1";
export const DEFAULT_COST_ASSUMPTIONS = Object.freeze({
  version: "vigilalpha.costs.2026-10-08",
  commissionBps: 0,
  spreadAndSlippageBps: 10,
  fxFeeBps: 15,
  taxesBps: 0,
  fxApplied: true,
  note: "Conservative hypothetical estimate includes FX by default. Known same-currency holdings override it. Actual broker wallet impact is authoritative for completed fills."
});

export function validatePattern(pattern, bars, { costs = DEFAULT_COST_ASSUMPTIONS, interval = null } = {}) {
  const normalized = normalizeBars(bars);
  if (!["1D", "1d", "1day"].includes(interval)) {
    return unavailable(pattern, normalized.length, "DAILY_INTERVAL_REQUIRED", costs);
  }
  const lookback = Number(pattern?.lookback || 0);
  if (normalized.length < Math.max(lookback + 20, 60)) {
    return unavailable(pattern, normalized.length, "INSUFFICIENT_HISTORY", costs);
  }
  if (pattern.id === "volume-breakout-20" && normalized.some((bar) => bar.volume === null)) {
    return unavailable(pattern, normalized.length, "VOLUME_UNAVAILABLE", costs);
  }
  if (!["sma-trend-cross", "rsi-momentum", "volume-breakout-20"].includes(pattern.id)) {
    return unavailable(pattern, normalized.length, "NO_RETURN_RULE", costs);
  }

  const firstTest = Math.max(lookback + 1, Math.floor(normalized.length * 0.55));
  const boundaries = [firstTest, Math.floor(normalized.length * 0.7), Math.floor(normalized.length * 0.85), normalized.length - 1]
    .filter((value, index, values) => index === 0 || value > values[index - 1]);
  const inSample = simulate(pattern, normalized, lookback, firstTest, costs);
  const folds = boundaries.slice(0, -1).map((start, index) => ({
    fold: index + 1,
    trainStart: normalized[0]?.time || null,
    trainEnd: normalized[start]?.time || null,
    testEnd: normalized[boundaries[index + 1]]?.time || null,
    result: simulate(pattern, normalized, start, boundaries[index + 1], costs)
  }));
  const outOfSample = aggregateFolds(folds);
  return {
    contractVersion: VALIDATION_VERSION,
    patternId: pattern.id,
    patternVersion: pattern.version,
    interval: "1D",
    status: outOfSample.evaluatedBars >= 20 ? "EVALUATED" : "INSUFFICIENT_OUT_OF_SAMPLE",
    maturityEffect: "NONE_WITHOUT_SHADOW_AND_HUMAN_APPROVAL",
    split: { method: "expanding-window-walk-forward", initialTrainEnd: normalized[firstTest]?.time || null, randomShuffle: false, foldCount: folds.length },
    execution: { timing: "next_bar_open_or_close", futureDataUsed: false },
    costs,
    inSample,
    folds,
    outOfSample,
    baseline: buyAndHold(normalized, firstTest, normalized.length - 1),
    limitations: ["Single-instrument historical simulation", "No tax-lot or market-impact model", "Passing this result does not promote the strategy"]
  };
}

function aggregateFolds(folds) {
  const results = folds.map((fold) => fold.result);
  const evaluatedBars = results.reduce((sum, result) => sum + result.evaluatedBars, 0);
  const finalGrowth = results.reduce((growth, result) => growth * (1 + result.netReturn), 1);
  const positiveWeighted = results.reduce((sum, result) => sum + Number(result.positiveSessionRate || 0) * result.evaluatedBars, 0);
  return {
    evaluatedBars,
    netReturn: finalGrowth - 1,
    maxDrawdown: results.reduce((worst, result) => Math.min(worst, result.maxDrawdown), 0),
    tradeCount: results.reduce((sum, result) => sum + result.tradeCount, 0),
    positiveSessionRate: evaluatedBars ? positiveWeighted / evaluatedBars : null
  };
}

function simulate(pattern, bars, start, end, costs) {
  let cash = 1;
  let units = 0;
  let desired = 0;
  let peak = 1;
  let maxDrawdown = 0;
  let tradeCount = 0;
  const returns = [];
  for (let index = Math.max(start, pattern.lookback); index < end; index += 1) {
    desired = evaluatePatternSignal(pattern, bars, index, desired);
    const execution = finite(bars[index + 1].open) ?? bars[index + 1].close;
    if (desired === 1 && units === 0) {
      const rate = costRate(costs);
      units = cash * (1 - rate) / execution;
      cash = 0;
      tradeCount += 1;
    } else if (desired === 0 && units > 0) {
      cash = units * execution * (1 - costRate(costs));
      units = 0;
      tradeCount += 1;
    }
    const value = cash + units * bars[index + 1].close;
    const previous = returns.length ? returns.at(-1).value : 1;
    returns.push({ time: bars[index + 1].time, value, return: previous ? value / previous - 1 : 0 });
    peak = Math.max(peak, value);
    maxDrawdown = Math.min(maxDrawdown, peak ? value / peak - 1 : 0);
  }
  const finalValue = returns.at(-1)?.value ?? 1;
  const positives = returns.filter((point) => point.return > 0).length;
  return {
    evaluatedBars: returns.length,
    netReturn: finalValue - 1,
    maxDrawdown,
    tradeCount,
    positiveSessionRate: returns.length ? positives / returns.length : null
  };
}

export function evaluatePatternSignal(pattern, bars, index, previous) {
  const closes = bars.slice(0, index + 1).map((bar) => bar.close);
  if (pattern.id === "sma-trend-cross") {
    const fast = simpleMovingAverage(closes, 20);
    const slow = simpleMovingAverage(closes, 50);
    return fast !== null && slow !== null ? (fast > slow ? 1 : 0) : previous;
  }
  if (pattern.id === "rsi-momentum") {
    const rsi = relativeStrengthIndex(closes, 14);
    if (rsi === null) return previous;
    if (rsi > 55) return 1;
    if (rsi < 45) return 0;
    return previous;
  }
  const prior = bars.slice(index - 20, index);
  const resistance = Math.max(...prior.map((bar) => bar.high ?? bar.close));
  const averageVolume = prior.reduce((sum, bar) => sum + bar.volume, 0) / prior.length;
  if (bars[index].close > resistance && bars[index].volume > averageVolume * 1.5) return 1;
  const sma20 = simpleMovingAverage(closes, 20);
  if (sma20 !== null && bars[index].close < sma20) return 0;
  return previous;
}

function buyAndHold(bars, start, end) {
  const first = bars[Math.min(start + 1, bars.length - 1)]?.open ?? bars[Math.min(start + 1, bars.length - 1)]?.close;
  const last = bars[Math.min(end, bars.length - 1)]?.close;
  return Number.isFinite(first) && Number.isFinite(last) && first > 0 ? { name: "buy_and_hold", return: last / first - 1 } : { name: "buy_and_hold", return: null };
}

function unavailable(pattern, observations, reason, costs) {
  return { contractVersion: VALIDATION_VERSION, patternId: pattern?.id || null, patternVersion: pattern?.version || null, status: "NOT_EVALUATED", reason, observations, costs, maturityEffect: "NONE" };
}

function normalizeBars(bars) {
  return (Array.isArray(bars) ? bars : []).map((bar) => ({
    time: bar?.time || null,
    open: finite(bar?.open), high: finite(bar?.high), low: finite(bar?.low), close: finite(bar?.close), volume: finite(bar?.volume)
  })).filter((bar) => bar.time && bar.close !== null && bar.close > 0).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

function costRate(costs) {
  const bps = Number(costs.commissionBps || 0) + Number(costs.spreadAndSlippageBps || 0) + Number(costs.taxesBps || 0) + (costs.fxApplied ? Number(costs.fxFeeBps || 0) : 0);
  return Math.max(0, bps) / 10_000;
}

function finite(value) {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed) ? parsed : null;
}
