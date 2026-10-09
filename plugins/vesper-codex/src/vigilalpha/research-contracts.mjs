export const RESEARCH_CONTRACTS_VERSION = "vigilalpha.research-contracts.v1";

export function createChartAnnotation(input = {}) {
  const sourceId = requiredText(input.sourceId, "sourceId");
  const imageLocator = requiredText(input.imageLocator, "imageLocator");
  const labels = strings(input.ocrLabels);
  const timeframe = optionalText(input.timeframe);
  const triggerRules = strings(input.triggerRules);
  const numericReconstruction = Boolean(timeframe && triggerRules.length && input.axis?.time && input.axis?.price);
  return {
    contractVersion: "vigilalpha.chart-annotation.v1",
    sourceId,
    imageLocator,
    ocr: { labels, engine: optionalText(input.ocrEngine), reviewedByHuman: Boolean(input.reviewedByHuman) },
    axis: { time: optionalText(input.axis?.time), price: optionalText(input.axis?.price), volume: optionalText(input.axis?.volume) },
    timeframe,
    authorAnnotations: strings(input.authorAnnotations),
    triggerRules,
    states: strings(input.states),
    status: numericReconstruction ? "RECONSTRUCTABLE_CANDIDATE" : "ILLUSTRATIVE",
    canTriggerDecision: false,
    gaps: [
      ...(!timeframe ? ["TIMEFRAME_MISSING"] : []),
      ...(!input.axis?.time || !input.axis?.price ? ["AXIS_UNRESOLVED"] : []),
      ...(!triggerRules.length ? ["NUMERIC_TRIGGER_MISSING"] : [])
    ]
  };
}

export function createEventObservation(input = {}) {
  const knownAt = iso(input.knownAt, "knownAt");
  const observedAt = iso(input.observedAt, "observedAt");
  if (Date.parse(knownAt) > Date.parse(observedAt)) throw new Error("knownAt cannot be later than observedAt.");
  return {
    contractVersion: "vigilalpha.event-observation.v1",
    symbol: requiredText(input.symbol, "symbol").toUpperCase(),
    eventType: requiredText(input.eventType, "eventType"),
    knownAt,
    observedAt,
    sourceId: requiredText(input.sourceId, "sourceId"),
    summary: requiredText(input.summary, "summary"),
    causalClaim: false,
    interpretation: "Records what followed a known event; it does not assert the event caused the price move."
  };
}

export function createLearningCandidate(input = {}) {
  return {
    contractVersion: "vigilalpha.learning-candidate.v1",
    id: requiredText(input.id, "id"),
    patternId: requiredText(input.patternId, "patternId"),
    sourceIds: strings(input.sourceIds),
    evidenceStatus: input.evidenceStatus || "CANDIDATE",
    validationStatus: input.validationStatus || "NOT_RUN",
    shadowStatus: input.shadowStatus || "NOT_STARTED",
    proposedChange: optionalText(input.proposedChange),
    productionWeight: 0,
    approvalStatus: "PENDING_HUMAN_REVIEW"
  };
}

export function createStrategyPromotionDecision(input = {}) {
  const approved = input.approved === true;
  if (approved && input.humanApproval !== true) throw new Error("Financial strategy promotion requires explicit human approval.");
  return {
    contractVersion: "vigilalpha.strategy-promotion-decision.v1",
    candidateId: requiredText(input.candidateId, "candidateId"),
    decidedAt: iso(input.decidedAt, "decidedAt"),
    decision: approved ? "APPROVED_FOR_NEW_SHADOW_VERSION" : input.rejected ? "REJECTED" : "PENDING",
    reason: requiredText(input.reason, "reason"),
    humanApproval: input.humanApproval === true,
    changesRuntimeAutomatically: false,
    nextStep: approved ? "Create versioned code or configuration, test it, then restart shadow validation." : "No runtime change."
  };
}

function strings(value) { return (Array.isArray(value) ? value : []).map((item) => String(item).trim()).filter(Boolean); }
function optionalText(value) { const text = String(value ?? "").trim(); return text || null; }
function requiredText(value, name) { const text = optionalText(value); if (!text) throw new Error(`${name} is required.`); return text; }
function iso(value, name) { const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) throw new Error(`${name} must be an ISO timestamp.`); return parsed.toISOString(); }
