const DAY_MS = 86_400_000;
const CHECKED_AT = "2026-10-24";
const CHECKED_AT_MS = Date.parse(`${CHECKED_AT}T00:00:00Z`);
const FED_SOURCE = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
const BLS_SOURCE = "https://www.bls.gov/schedule/2026/11_sched.htm";

// This is a bounded official-schedule snapshot, never a live economic feed.
const SCHEDULE = [
  meeting("fomc-2026-10", "2026-10-27", "2026-10-28", "2026-10-27T04:00:00Z", "2026-10-29T04:00:00Z"),
  release("employment-2026-11", "Employment Situation", "2026-11-06", "employment"),
  release("cpi-2026-11", "Consumer Price Index", "2026-11-10", "inflation"),
  release("ppi-2026-11", "Producer Price Index", "2026-11-13", "producer-prices"),
  meeting("fomc-2026-12", "2026-12-08", "2026-12-09", "2026-12-08T05:00:00Z", "2026-12-10T05:00:00Z")
];

export function eventReview({ asOf = new Date().toISOString(), days = 30 } = {}) {
  const asOfMs = parseAsOf(asOf);
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error("days must be an integer from 1 through 90.");
  }
  const ageDays = (asOfMs - CHECKED_AT_MS) / DAY_MS;
  const unavailable = ageDays < 0;
  const stale = ageDays > 7;
  const endMs = asOfMs + days * DAY_MS;
  const events = unavailable ? [] : SCHEDULE
    .filter((event) => {
      const startMs = Date.parse(event.windowStartUtc);
      return event.endExclusiveUtc
        ? Date.parse(event.endExclusiveUtc) > asOfMs && startMs <= endMs
        : startMs >= asOfMs && startMs <= endMs;
    })
    .map((event) => ({
      ...event,
      source: { ...event.source },
      localSchedule: { ...event.localSchedule },
      observationConditions: [...event.observationConditions],
      transmissionScenarios: event.transmissionScenarios.map((scenario) => ({ ...scenario })),
      daysUntil: Math.max(0, Math.ceil((Date.parse(event.windowStartUtc) - asOfMs) / DAY_MS)),
      timingStatus: Date.parse(event.windowStartUtc) < asOfMs ? "MEETING_WINDOW_IN_PROGRESS" : "UPCOMING"
    }));
  return {
    contractVersion: "vigilalpha.event-review.v1",
    asOf: new Date(asOfMs).toISOString(),
    days,
    horizonEnd: new Date(endMs).toISOString(),
    checkedAt: CHECKED_AT,
    status: unavailable ? "SNAPSHOT_NOT_AVAILABLE_AS_OF" : stale ? "STALE" : "SCHEDULE_SNAPSHOT",
    stale,
    requiresRefresh: stale || unavailable,
    snapshotAgeDays: Math.max(0, ageDays),
    isLive: false,
    changesStrategyAutomatically: false,
    predictsResults: false,
    events,
    coverage: {
      complete: false,
      scope: "Only the listed October/December 2026 FOMC meetings and November 2026 BLS releases.",
      novemberFomc: { scheduledRegularMeeting: false, source: FED_SOURCE, checkedAt: CHECKED_AT },
      emptyMeansNoRisk: false,
      limitations: [
        "No scheduled event in this snapshot does not mean no risk; unscheduled events and other calendars are not covered.",
        "Schedules may change. A snapshot older than seven days requires an official-source refresh before reliance.",
        "FOMC dates are meeting windows; an announcement time has not been verified.",
        ...(unavailable ? ["The snapshot was checked after asOf and is withheld to avoid historical look-ahead."] : [])
      ]
    }
  };
}

function meeting(id, startDate, endDate, windowStartUtc, endExclusiveUtc) {
  return {
    id, title: "FOMC meeting", eventType: "FOMC", windowStartUtc, endExclusiveUtc,
    scheduledAtUtc: null,
    localSchedule: { startDate, endDate, time: null, timeZone: "America/New_York", precision: "MEETING_DATE_RANGE" },
    source: { url: FED_SOURCE, publisher: "Federal Reserve", checkedAt: CHECKED_AT },
    observationConditions: ["Read the official statement and any published projections after release.", "Compare policy guidance with prior guidance and independently sourced expectations; this snapshot contains neither expectations nor outcomes."],
    transmissionScenarios: [
      { condition: "Policy guidance implies tighter financing conditions", channel: "Rates, discount rates and credit costs", exposedAreas: "Long-duration growth equities, property and leveraged businesses may face valuation or financing pressure; direction is not assured." },
      { condition: "Policy guidance implies easier financing conditions", channel: "Rates, credit availability and demand", exposedAreas: "Growth equities and rate-sensitive sectors may respond, while a weaker economic outlook can offset that response." }
    ]
  };
}

function release(id, title, date, topic) {
  // November dates below are after the US daylight-saving transition: 08:30 EST = 13:30 UTC.
  const inflation = topic !== "employment";
  return {
    id, title, eventType: topic === "employment" ? "EMPLOYMENT" : topic === "inflation" ? "CPI" : "PPI",
    windowStartUtc: `${date}T13:30:00Z`, scheduledAtUtc: `${date}T13:30:00Z`, endExclusiveUtc: null,
    localSchedule: { date, time: "08:30", timeZone: "America/New_York", abbreviation: "EST", utcOffset: "-05:00", precision: "RELEASE_TIME" },
    source: { url: BLS_SOURCE, publisher: "Bureau of Labor Statistics", checkedAt: CHECKED_AT },
    observationConditions: inflation
      ? ["Read headline, core and component details plus revisions from the official release.", "Compare with independently sourced expectations and prior readings; no surprise or outcome is known here."]
      : ["Read payrolls, unemployment, wages and revisions together from the official release.", "Compare with independently sourced expectations; one release alone does not establish a trend."],
    transmissionScenarios: inflation
      ? [
          { condition: "Price pressure broadens or persists", channel: "Input costs, margins and rate expectations", exposedAreas: "Consumer, industrial and long-duration growth sectors may be affected; pricing power and demand can change the response." },
          { condition: "Price pressure eases", channel: "Margins, purchasing power and rate expectations", exposedAreas: "Consumer and rate-sensitive sectors may benefit, but weak demand can offset cost relief." }
        ]
      : [
          { condition: "Employment and wage growth remain strong", channel: "Consumer demand, labor costs and rate expectations", exposedAreas: "Consumer businesses, labor-intensive sectors and rate-sensitive growth firms can respond differently." },
          { condition: "Employment weakens materially", channel: "Demand, credit losses and easing expectations", exposedAreas: "Cyclicals and lenders may face demand or credit pressure; lower-rate expectations can partly offset it." }
        ]
  };
}

function parseAsOf(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
    throw new Error("asOf must be an ISO date or a timestamp with an explicit time zone.");
  }
  const date = value.slice(0, 10);
  const calendarDate = new Date(`${date}T00:00:00Z`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || !Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== date || /T24:/.test(value)) {
    throw new Error("asOf must contain a valid calendar date and time.");
  }
  return parsed;
}
