import test from "node:test";
import assert from "node:assert/strict";
import { eventReview } from "../src/vigilalpha/events.mjs";

test("snapshot lists known events in order with bounded official provenance", () => {
  const review = eventReview({ asOf: "2026-10-24", days: 30 });
  assert.equal(review.status, "SCHEDULE_SNAPSHOT");
  assert.equal(review.checkedAt, "2026-10-24");
  assert.equal(review.isLive, false);
  assert.equal(review.predictsResults, false);
  assert.equal(review.changesStrategyAutomatically, false);
  assert.deepEqual(review.events.map((event) => event.eventType), ["FOMC", "EMPLOYMENT", "CPI", "PPI"]);
  for (const event of review.events) {
    assert.match(event.source.url, /^https:\/\/(www\.federalreserve\.gov|www\.bls\.gov)\//);
    assert.equal(event.source.checkedAt, "2026-10-24");
    assert.ok(event.observationConditions.length > 0);
    assert.ok(event.transmissionScenarios.every((scenario) => scenario.condition && scenario.channel && scenario.exposedAreas));
  }
});

test("instant boundaries include the scheduled instant and exclude it immediately afterward", () => {
  const at = eventReview({ asOf: "2026-11-06T13:30:00Z", days: 1 });
  assert.equal(at.events[0].eventType, "EMPLOYMENT");
  assert.equal(at.events[0].daysUntil, 0);
  assert.equal(eventReview({ asOf: "2026-11-06T13:30:00.001Z", days: 1 }).events.length, 0);
  assert.equal(eventReview({ asOf: "2026-11-05T13:30:00Z", days: 1 }).events[0].daysUntil, 1);
  assert.equal(eventReview({ asOf: "2026-11-05T13:29:59Z", days: 1 }).events.length, 0);
});

test("meeting windows retain dates, include ongoing meetings and never invent announcement times", () => {
  const ongoing = eventReview({ asOf: "2026-10-28T18:00:00Z", days: 1 }).events[0];
  assert.equal(ongoing.eventType, "FOMC");
  assert.equal(ongoing.scheduledAtUtc, null);
  assert.equal(ongoing.localSchedule.startDate, "2026-10-27");
  assert.equal(ongoing.localSchedule.endDate, "2026-10-28");
  assert.equal(ongoing.localSchedule.time, null);
  assert.equal(ongoing.timingStatus, "MEETING_WINDOW_IN_PROGRESS");
  assert.equal(ongoing.daysUntil, 0);
  assert.equal(eventReview({ asOf: "2026-10-29T04:00:00Z", days: 1 }).events.length, 0);
});

test("November has no regular FOMC and December meeting is included when within horizon", () => {
  const november = eventReview({ asOf: "2026-11-01", days: 30 });
  assert.ok(november.events.every((event) => event.eventType !== "FOMC"));
  assert.equal(november.coverage.novemberFomc.scheduledRegularMeeting, false);
  assert.equal(eventReview({ asOf: "2026-10-24", days: 90 }).events.at(-1).localSchedule.startDate, "2026-12-08");
});

test("November BLS release times preserve EST and convert to UTC", () => {
  const bls = eventReview({ asOf: "2026-11-01", days: 15 }).events;
  assert.equal(bls.length, 3);
  for (const event of bls) {
    assert.equal(event.localSchedule.time, "08:30");
    assert.equal(event.localSchedule.timeZone, "America/New_York");
    assert.equal(event.localSchedule.utcOffset, "-05:00");
    assert.equal(event.localSchedule.abbreviation, "EST");
    assert.equal(event.scheduledAtUtc, `${event.localSchedule.date}T13:30:00Z`);
  }
  assert.deepEqual(eventReview({ asOf: "2026-11-06T08:30:00-05:00", days: 1 }), eventReview({ asOf: "2026-11-06T13:30:00Z", days: 1 }));
});

test("seven-day freshness boundary and empty calendars cannot imply no risk", () => {
  assert.equal(eventReview({ asOf: "2026-10-31T00:00:00Z" }).stale, false);
  const stale = eventReview({ asOf: "2026-10-31T00:00:00.001Z" });
  assert.equal(stale.status, "STALE");
  assert.equal(stale.requiresRefresh, true);
  const empty = eventReview({ asOf: "2026-12-20", days: 1 });
  assert.deepEqual(empty.events, []);
  assert.equal(empty.coverage.complete, false);
  assert.equal(empty.coverage.emptyMeansNoRisk, false);
  assert.ok(empty.coverage.limitations.some((text) => text.includes("does not mean no risk")));
});

test("snapshot is withheld before its verification date and results are independent copies", () => {
  assert.equal(eventReview({ asOf: "2026-10-23" }).status, "SNAPSHOT_NOT_AVAILABLE_AS_OF");
  assert.deepEqual(eventReview({ asOf: "2026-10-23" }).events, []);
  const first = eventReview({ asOf: "2026-10-24" });
  first.events[0].source.url = "changed";
  first.events[0].transmissionScenarios[0].channel = "changed";
  const second = eventReview({ asOf: "2026-10-24" });
  assert.notEqual(second.events[0].source.url, "changed");
  assert.notEqual(second.events[0].transmissionScenarios[0].channel, "changed");
});

test("parameters reject ambiguous dates, impossible dates and invalid horizons", () => {
  for (const asOf of [null, 0, "", "yesterday", "2026-02-30", "2026-11-06T08:30:00", "2026-11-06T24:00:00Z", "2026-13-01", "2026-11-06T08:60:00Z"]) {
    assert.throws(() => eventReview({ asOf }), /asOf/);
  }
  for (const days of [null, "30", 0, -1, 91, 1.5, NaN, Infinity]) {
    assert.throws(() => eventReview({ asOf: "2026-10-24", days }), /days/);
  }
  assert.doesNotThrow(() => eventReview({ asOf: "2026-10-24", days: 1 }));
  assert.doesNotThrow(() => eventReview({ asOf: "2026-10-24", days: 90 }));
});
