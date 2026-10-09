import { DEFAULT_COST_ASSUMPTIONS } from "./validation.mjs";

export const DECISION_VERSION = "vigilalpha.shadow-decision.v1";

export function buildShadowDecision({ symbol, position, totalValue, riskVeto, consensus, historyCompleteness, parametersVersion, sourceCutoff, costs = DEFAULT_COST_ASSUMPTIONS, now = new Date().toISOString() }) {
  const base = {
    contractVersion: DECISION_VERSION,
    mode: "SHADOW",
    symbol,
    generatedAt: now,
    sourceCutoff: sourceCutoff || null,
    parametersVersion: parametersVersion || null,
    action: "WAIT",
    quantity: 0,
    timing: "Do not act; re-evaluate when the named conditions are met.",
    triggerConditions: [],
    invalidationConditions: [],
    rationale: [],
    executionAuthority: "NONE",
    disclaimer: "Conditional research plan only. VigilAlpha cannot place, modify or cancel orders."
  };
  const quantity = finite(position?.quantity);
  const tradable = finite(position?.quantityAvailableForTrading) ?? quantity;
  const marketValue = finite(position?.marketValue);
  const accountTotal = finite(totalValue);
  const currentWeight = accountTotal && marketValue !== null ? marketValue / accountTotal * 100 : null;
  const currentPrice = quantity && marketValue !== null ? marketValue / quantity : finite(position?.currentPrice);
  if (!quantity || !tradable || !accountTotal || marketValue === null || !currentPrice) {
    return { ...base, dataGate: "FAILED", rationale: ["Current quantity, tradable quantity, account total and account-currency market value are required."] };
  }
  base.reference = { price: currentPrice, portfolioWeightPercent: currentWeight };
  const currencyStatus = currencyRelation(position?.instrumentCurrency, position?.accountCurrency);
  const effectiveCosts = {
    ...costs,
    fxApplied: currencyStatus === "CROSS"
  };

  const severeConcentration = (riskVeto?.reasons || []).find((reason) => reason.code === "SEVERE_CONCENTRATION");
  if (severeConcentration) {
    const configuredLimit = finite(severeConcentration.limitPercent) ?? inferLimit(severeConcentration.message) ?? 20;
    const targetWeight = configuredLimit * 0.8;
    const targetValue = accountTotal * targetWeight / 100;
    const grossReduction = Math.max(0, marketValue - targetValue);
    const reductionQuantity = round(Math.min(tradable, quantity, grossReduction / currentPrice), 8);
    if (reductionQuantity <= 0) return { ...base, dataGate: "PASSED", rationale: ["The calculated risk-target reduction is zero."] };
    const economics = estimatedEconomics(reductionQuantity, currentPrice, effectiveCosts);
    const riskCalculation = {
      sizing: { method: "risk_target_first", currentWeightPercent: currentWeight, configuredMaximumPercent: configuredLimit, targetWeightPercent: targetWeight, targetValue, quantityAvailableForTrading: tradable },
      estimatedEconomics: economics
    };
    if (historyCompleteness?.complete !== true || currencyStatus === "UNKNOWN") {
      return {
        ...base,
        dataGate: "FAILED",
        triggerConditions: [`Current weight ${currentWeight.toFixed(2)}% is above ${configuredLimit.toFixed(2)}%.`],
        rationale: [
          historyCompleteness?.complete !== true ? "Complete Trading 212 execution history is not verified; no action is issued." : "Instrument/account currency relation is unknown, so FX cost coverage is incomplete; no action is issued.",
          severeConcentration.message
        ],
        riskOnlyCalculation: riskCalculation,
        historyCompleteness
      };
    }
    return {
      ...base,
      action: "REDUCE",
      quantity: reductionQuantity,
      timing: `Only while portfolio weight remains above ${configuredLimit.toFixed(2)}%; review before execution.`,
      triggerConditions: [`Current weight ${currentWeight.toFixed(2)}% remains above ${configuredLimit.toFixed(2)}%.`],
      invalidationConditions: ["Account value, market value or tradable quantity changes materially.", "Order-history completeness or broker data becomes degraded."],
      rationale: [severeConcentration.message, `Risk target is ${targetWeight.toFixed(2)}%, equal to 80% of the configured maximum.`],
      ...riskCalculation,
      dataGate: "PASSED"
    };
  }

  if (historyCompleteness?.complete !== true) {
    return { ...base, dataGate: "FAILED", rationale: ["Complete Trading 212 execution history is not verified."], historyCompleteness };
  }
  if (!consensus || consensus.eligibleStrategies < 1 || consensus.direction === "NO_CONSENSUS") {
    return { ...base, dataGate: "FAILED", rationale: ["No human-approved historically validated strategy is eligible for a directional decision."] };
  }
  return { ...base, dataGate: "BLOCKED", rationale: ["Directional production sizing remains blocked until shadow and human-promotion gates pass."], consensus };
}

function estimatedEconomics(quantity, price, costs) {
  const grossProceeds = quantity * price;
  const bps = Number(costs.commissionBps || 0) + Number(costs.spreadAndSlippageBps || 0) + Number(costs.taxesBps || 0) + (costs.fxApplied ? Number(costs.fxFeeBps || 0) : 0);
  const estimatedCosts = grossProceeds * Math.max(0, bps) / 10_000;
  return { grossProceeds, estimatedCosts, estimatedNetProceeds: grossProceeds - estimatedCosts, assumptions: costs, actualCharge: false };
}

function inferLimit(message) {
  const match = String(message || "").match(/(?:above the|threshold)\s+(\d+(?:\.\d+)?)%/i);
  return match ? Number(match[1]) : null;
}

function currencyRelation(instrumentCurrency, accountCurrency) {
  const normalize = (value) => String(value || "").toUpperCase().replace("GBX", "GBP");
  const instrument = normalize(instrumentCurrency);
  const account = normalize(accountCurrency);
  if (!instrument || !account) return "UNKNOWN";
  return instrument === account ? "SAME" : "CROSS";
}

function finite(value) {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed) ? parsed : null;
}

function round(value, places) {
  return Number(value.toFixed(places));
}
