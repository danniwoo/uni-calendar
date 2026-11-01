import assert from "node:assert/strict";
import test from "node:test";
import {
  makeSampleBoard,
  nextClass,
  readStoredSample,
  resolveLink,
  widgetTimeline,
  widgetProps,
} from "./model";
import { sydneyInstant } from "../../lib/sydney-time";
const now = Date.parse("2026-11-01T02:00:00Z");
test("widget moves through classes and ends in an empty state", () => {
  const board = makeSampleBoard(now),
    first = board.classes[0];
  assert.equal(nextClass(board, now)?.id, first.id);
  assert.match(widgetProps(board, first.start).label, /IN CLASS/);
  assert.notEqual(nextClass(board, first.end)?.id, first.id);
  const timeline = widgetTimeline(board, now);
  assert.equal(timeline[0].date.getTime(), now);
  assert.ok(timeline.every((e, i) => i === 0 || e.date > timeline[i - 1].date));
  assert.equal(timeline.at(-1)?.props.unit, "All clear");
});
test("week-only assessment remains undated", () => {
  const board = makeSampleBoard(now);
  assert.equal(
    board.assessments.find((a) => a.id === "database-quiz")?.due,
    undefined,
  );
  assert.ok(
    widgetTimeline(board, now).every(
      (e) => !e.props.url.includes("database-quiz"),
    ),
  );
});
test("widget links only open known sample items", () => {
  const board = makeSampleBoard(now);
  assert.deepEqual(
    resolveLink("semester-preview://class/database-tutorial", board),
    { kind: "class", id: "database-tutorial" },
  );
  for (const url of [
    "https://class/database-tutorial",
    "semester-preview://class/deleted",
    "semester-preview://class/%ZZ",
    "semester-preview://class/database-tutorial?x=1",
  ])
    assert.equal(resolveLink(url, board), undefined);
});
test("saved seed resumes the same board and only known progress", () => {
  const restored = readStoredSample(
    JSON.stringify({
      version: 1,
      createdAt: now,
      progress: {
        "project-report": true,
        "database-quiz": "yes",
        unexpected: true,
      },
    }),
  );
  assert.deepEqual(restored?.board, makeSampleBoard(now));
  assert.equal(restored?.progress["project-report"], true);
  assert.equal(restored?.progress["database-quiz"], false);
  assert.equal(restored?.progress.unexpected, undefined);
  assert.equal(readStoredSample("{"), undefined);
  assert.equal(readStoredSample('{"version":2,"createdAt":0}'), undefined);
});
test("shared Sydney conversion rejects daylight saving gaps and ambiguity", () => {
  assert.equal(
    sydneyInstant("2026-11-01", "14:00"),
    Date.parse("2026-11-01T03:00:00Z"),
  );
  assert.equal(
    sydneyInstant("2026-06-01", "14:00"),
    Date.parse("2026-06-01T04:00:00Z"),
  );
  assert.equal(sydneyInstant("2026-10-04", "02:30"), undefined);
  assert.equal(sydneyInstant("2026-04-05", "02:30"), undefined);
  assert.equal(sydneyInstant("2026-02-30", "14:00"), undefined);
});
