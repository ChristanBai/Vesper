const DISCLAIMER = "This brief is for information and risk awareness only. It is not investment advice and does not guarantee returns.";

export function buildPortfolioBrief({
  snapshot,
  generatedAt = new Date().toISOString()
}) {
  const summary = snapshot?.summary || {};
  const positions = Array.isArray(snapshot?.positions) ? snapshot.positions : [];
  const orders = Array.isArray(snapshot?.orders) ? snapshot.orders : [];
  const totalValue = finite(summary.totalValue) || positions.reduce((total, item) => total + finite(item.marketValue), 0);

  const enriched = positions
    .map((position) => {
      const marketValue = finite(position.marketValue);
      const costBasis = finite(position.costBasis);
      const unrealizedPnL = finite(position.unrealizedPnL);
      const weightPercent = totalValue ? marketValue / totalValue * 100 : 0;
      return {
        ...position,
        marketValue,
        costBasis,
        unrealizedPnL,
        unrealizedPnLPercent: costBasis ? unrealizedPnL / costBasis * 100 : 0,
        weightPercent,
        contributionToPortfolioPercent: totalValue ? unrealizedPnL / totalValue * 100 : 0
      };
    })
    .sort((left, right) => right.marketValue - left.marketValue);

  const contributions = [...enriched].sort((left, right) => right.unrealizedPnL - left.unrealizedPnL);
  const concentration = concentrationMetrics(enriched, totalValue);
  const recentOrders = orders
    .filter((order) => isRecent(order.filledAt || order.orderedAt))
    .sort((left, right) => dateValue(right.filledAt || right.orderedAt) - dateValue(left.filledAt || left.orderedAt))
    .slice(0, 10);
  const riskSignals = buildRiskSignals({
    summary,
    positions: enriched,
    concentration,
    reconciliation: snapshot?.reconciliation,
    errors: snapshot?.errors
  });
  const brief = {
    generatedAt,
    status: snapshot?.status || "UNKNOWN",
    syncedAt: snapshot?.syncedAt || null,
    summary: {
      currency: summary.currency || "GBP",
      totalValue,
      availableCash: finite(summary.availableCash),
      investedValue: finite(summary.investedValue),
      unrealizedPnL: finite(summary.unrealizedPnL),
      realizedPnL: finite(summary.realizedPnL)
    },
    concentration,
    topPositions: enriched.slice(0, 5),
    topContributors: contributions.slice(0, 3),
    topDetractors: contributions.slice(-3).reverse(),
    recentOrders,
    riskSignals,
    dataQuality: {
      reconciliationStatus: snapshot?.reconciliation?.status || "UNKNOWN",
      errors: Array.isArray(snapshot?.errors) ? snapshot.errors : []
    },
    disclaimer: DISCLAIMER
  };
  return {
    ...brief,
    markdown: renderMarkdown(brief)
  };
}

function concentrationMetrics(positions, totalValue) {
  const weights = positions.map((position) => totalValue ? position.marketValue / totalValue : 0);
  const hhi = weights.reduce((sum, weight) => sum + weight ** 2, 0) * 10_000;
  return {
    positionCount: positions.length,
    topOneWeightPercent: weights[0] ? weights[0] * 100 : 0,
    topFiveWeightPercent: weights.slice(0, 5).reduce((sum, weight) => sum + weight, 0) * 100,
    hhi,
    effectivePositionCount: hhi > 0 ? 10_000 / hhi : 0,
    cashWeightPercent: totalValue ? finiteFromSummary(totalValue, positions) : 0
  };
}

function finiteFromSummary(totalValue, positions) {
  const invested = positions.reduce((total, position) => total + position.marketValue, 0);
  return Math.max(0, (totalValue - invested) / totalValue * 100);
}

function buildRiskSignals({ summary, positions, concentration, reconciliation, errors }) {
  const signals = [];
  for (const position of positions) {
    if (position.weightPercent > 20) {
      signals.push({
        severity: "high",
        code: "POSITION_WEIGHT",
        message: `${position.symbol} weight is ${formatPercent(position.weightPercent)}, above the 20% review threshold.`
      });
    }
  }
  if (concentration.topOneWeightPercent > 35) {
    signals.push({
      severity: "high",
      code: "TOP_ONE_CONCENTRATION",
      message: `The largest position is ${formatPercent(concentration.topOneWeightPercent)} of the portfolio.`
    });
  }
  if (concentration.topFiveWeightPercent > 75 && positions.length > 5) {
    signals.push({
      severity: "medium",
      code: "TOP_FIVE_CONCENTRATION",
      message: `The top five positions represent ${formatPercent(concentration.topFiveWeightPercent)} of the portfolio.`
    });
  }
  if (finite(summary.availableCash) > 0 && concentration.cashWeightPercent > 25) {
    signals.push({
      severity: "low",
      code: "CASH_DRAG",
      message: `Cash is ${formatPercent(concentration.cashWeightPercent)} of the portfolio and may create performance drag.`
    });
  }
  if (reconciliation?.status && reconciliation.status !== "VERIFIED") {
    signals.push({
      severity: "medium",
      code: "PIE_RECONCILIATION",
      message: "Pie quantities do not fully reconcile with brokerage positions."
    });
  }
  for (const error of Array.isArray(errors) ? errors : []) {
    signals.push({
      severity: "medium",
      code: "DATA_QUALITY",
      message: `${error.section || "data"}: ${error.message || "sync warning"}`
    });
  }
  return signals;
}

function renderMarkdown(brief) {
  const currency = brief.summary.currency;
  const lines = [
    `# Vesper Daily Brief`,
    "",
    `Generated: ${brief.generatedAt}`,
    `Account snapshot: ${brief.syncedAt || "unavailable"} (${brief.status})`,
    "",
    "## Portfolio",
    "",
    `- Total value: ${money(brief.summary.totalValue, currency)}`,
    `- Available cash: ${money(brief.summary.availableCash, currency)}`,
    `- Unrealized P/L: ${money(brief.summary.unrealizedPnL, currency)}`,
    `- Realized P/L: ${money(brief.summary.realizedPnL, currency)}`,
    `- Positions: ${brief.concentration.positionCount}`,
    "",
    "## Concentration",
    "",
    `- Largest position: ${formatPercent(brief.concentration.topOneWeightPercent)}`,
    `- Top five positions: ${formatPercent(brief.concentration.topFiveWeightPercent)}`,
    `- Effective position count: ${formatNumber(brief.concentration.effectivePositionCount, 2)}`,
    `- Cash weight: ${formatPercent(brief.concentration.cashWeightPercent)}`,
    ""
  ];

  lines.push("## Top Positions", "");
  if (!brief.topPositions.length) lines.push("- No positions returned.", "");
  for (const position of brief.topPositions) {
    lines.push(
      `- ${position.symbol}: ${formatPercent(position.weightPercent)} weight, ` +
      `${money(position.unrealizedPnL, currency)} unrealized (${formatPercent(position.unrealizedPnLPercent)})`
    );
  }
  lines.push("");

  lines.push("## Contribution", "");
  lines.push("Top contribution:");
  if (!brief.topContributors.length) lines.push("- None available.");
  for (const position of brief.topContributors) {
    lines.push(`- ${position.symbol}: ${money(position.unrealizedPnL, currency)}`);
  }
  lines.push("", "Largest drag:");
  if (!brief.topDetractors.length) lines.push("- None available.");
  for (const position of brief.topDetractors) {
    lines.push(`- ${position.symbol}: ${money(position.unrealizedPnL, currency)}`);
  }
  lines.push("");

  lines.push("## Risk Review", "");
  if (!brief.riskSignals.length) {
    lines.push("- No threshold-based risks detected.", "");
  } else {
    for (const signal of brief.riskSignals) {
      lines.push(`- ${signal.severity.toUpperCase()}: ${signal.message}`);
    }
    lines.push("");
  }

  lines.push("## Recent Orders", "");
  if (!brief.recentOrders.length) {
    lines.push("- No orders in the last 14 days.", "");
  } else {
    for (const order of brief.recentOrders) {
      lines.push(
        `- ${formatDate(order.filledAt || order.orderedAt)} ${order.side} ${formatNumber(order.filledQuantity, 4)} ` +
        `${order.symbol} at ${formatNumber(order.price, 2)} ${order.currency || currency}`
      );
    }
    lines.push("");
  }

  lines.push("## Disclaimer", "", brief.disclaimer);
  return lines.join("\n");
}

function isRecent(value) {
  const timestamp = dateValue(value);
  return timestamp > 0 && Date.now() - timestamp <= 14 * 24 * 60 * 60 * 1_000;
}

function dateValue(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value, currency) {
  return money(value, currency);
}

function money(value, currency) {
  const amount = finite(value);
  return `${amount.toFixed(2)} ${currency}`;
}

function formatNumber(value, digits = 2) {
  return finite(value).toFixed(digits);
}

function formatPercent(value) {
  return `${finite(value).toFixed(2)}%`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "Unknown date") : date.toISOString().slice(0, 10);
}
