export function normalizeTicker(ticker) {
  return String(ticker || "")
    .replace(/_US_EQ$/i, "")
    .replace(/_L_EQ$/i, ".L")
    .replace(/l_EQ$/i, ".L")
    .replace(/_AS_EQ$/i, ".AS")
    .replace(/_DE_EQ$/i, ".DE")
    .replace(/_PA_EQ$/i, ".PA")
    .replace(/_EQ$/i, "")
    .trim()
    .toUpperCase();
}

export function mapSummary(payload) {
  const investments = payload?.investments || {};
  const cash = payload?.cash || {};
  return {
    currency: payload?.currency || "GBP",
    totalValue: number(payload?.totalValue),
    availableCash: number(cash.availableToTrade),
    reservedCash: number(cash.inPies) + number(cash.reservedForOrders),
    investedValue: number(investments.currentValue),
    unrealizedPnL: number(investments.unrealizedProfitLoss),
    realizedPnL: number(investments.realizedProfitLoss),
    rawUpdatedAt: payload?.timestamp || null
  };
}

export function mapPositions(payload) {
  return array(payload).map((position) => {
    const ticker = position?.instrument?.ticker || position?.ticker || "";
    const quantity = number(position?.quantity);
    const averagePricePaid = number(position?.averagePricePaid);
    const currentPrice = number(position?.currentPrice);
    const unrealizedPnL = number(position?.walletImpact?.unrealizedProfitLoss);
    const costBasis = numberOrNull(position?.walletImpact?.totalCost) ?? quantity * averagePricePaid;
    const marketValue = numberOrNull(position?.walletImpact?.currentValue) ?? quantity * currentPrice;
    return {
      ticker,
      symbol: normalizeTicker(ticker),
      name: position?.instrument?.name || null,
      instrumentCurrency: position?.instrument?.currency || null,
      accountCurrency: position?.walletImpact?.currency || null,
      quantity,
      averagePricePaid,
      currentPrice,
      costBasis,
      marketValue,
      unrealizedPnL,
      unrealizedPnLPercent: costBasis ? unrealizedPnL / costBasis : 0,
      quantityAvailableForTrading: number(position?.quantityAvailableForTrading),
      createdAt: position?.createdAt || null
    };
  });
}

export function mapPies(payload) {
  return array(payload).map((pie) => ({
    id: String(pie?.id ?? ""),
    name: pie?.name || pie?.settings?.name || "Unnamed Pie",
    status: pie?.status || "ACTIVE",
    cash: number(pie?.cash),
    result: typeof pie?.result === "object" ? pie.result : { priceAvgResult: number(pie?.result) },
    settings: pie?.settings || null,
    dividendDetails: pie?.dividendDetails || null,
    instruments: array(pie?.instruments).map((instrument) => {
      const ticker = instrument?.ticker || "";
      const ownedQuantity = number(instrument?.ownedQuantity);
      return {
        ticker,
        symbol: normalizeTicker(ticker),
        quantity: numberOrNull(instrument?.quantity) ?? ownedQuantity,
        ownedQuantity,
        currentShare: numberOrNull(instrument?.currentShare),
        result: typeof instrument?.result === "object" ? instrument.result : { priceAvgResult: number(instrument?.result) },
        expectedShare: number(instrument?.expectedShare)
      };
    })
  }));
}

export function mapOrders(payload) {
  return array(payload).map((order) => {
    const fill = order?.fill || {};
    const filledQuantity = Math.abs(number(order?.filledQuantity ?? fill?.quantity ?? order?.quantity));
    const filledValue = number(order?.filledValue);
    const price = number(order?.fillPrice ?? fill?.price ?? order?.price) || (filledQuantity ? filledValue / filledQuantity : 0);
    return {
      id: String(order?.id ?? order?.orderId ?? ""),
      ticker: order?.ticker || order?.instrument?.ticker || "",
      name: order?.instrument?.name || null,
      symbol: normalizeTicker(order?.ticker || order?.instrument?.ticker),
      side: String(order?.side || order?.type || "UNKNOWN").toUpperCase(),
      type: order?.type || null,
      status: String(order?.status || "UNKNOWN").toUpperCase(),
      quantity: number(order?.quantity),
      filledQuantity,
      price,
      filledValue: filledValue || filledQuantity * price,
      currency: order?.currency || fill?.walletImpact?.currency || null,
      orderedAt: order?.orderedAt || order?.createdAt || order?.dateCreated || null,
      filledAt: order?.filledAt || fill?.filledAt || order?.dateExecuted || null,
      realisedProfitLoss: numberOrNull(fill?.walletImpact?.realisedProfitLoss)
    };
  }).filter((order) => order.filledQuantity > 0 && order.price > 0);
}

export function mapTransactions(payload) {
  return array(payload).map((transaction) => ({
    id: String(transaction?.reference || transaction?.id || ""),
    type: transaction?.type || "UNKNOWN",
    amount: number(transaction?.amount),
    currency: transaction?.currency || null,
    date: transaction?.dateTime || transaction?.date || null,
    details: transaction?.details || null
  }));
}

export function reconcilePositionsAndPies(positions, pies) {
  const positionByTicker = new Map(positions.map((position) => [position.ticker, position]));
  const seen = new Set();
  const pieResults = pies.map((pie) => ({
    pieId: pie.id,
    pieName: pie.name,
    instruments: pie.instruments.map((instrument) => {
      seen.add(instrument.ticker);
      const position = positionByTicker.get(instrument.ticker);
      const difference = position ? round(position.quantity - instrument.quantity, 8) : null;
      return {
        ticker: instrument.ticker,
        symbol: instrument.symbol,
        pieQuantity: instrument.quantity,
        ownedQuantity: instrument.ownedQuantity,
        brokerageQuantity: position?.quantity ?? null,
        difference,
        status: !position ? "NOT_FOUND" : Math.abs(difference) < 0.000001 ? "VERIFIED" : "MISMATCH"
      };
    })
  }));

  return {
    status: pieResults.every((pie) => pie.instruments.every((item) => item.status === "VERIFIED"))
      ? "VERIFIED"
      : "ATTENTION",
    pies: pieResults,
    unassignedPositions: positions.filter((position) => !seen.has(position.ticker))
  };
}

export function allocationByPosition(positions, totalValue) {
  return positions
    .map((position) => ({
      ticker: position.ticker,
      symbol: position.symbol,
      marketValue: position.marketValue,
      weightPercent: totalValue ? (position.marketValue / totalValue) * 100 : 0
    }))
    .sort((a, b) => b.marketValue - a.marketValue);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, places) {
  return Number(value.toFixed(places));
}
