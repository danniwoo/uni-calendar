import assert from "node:assert/strict";
import test from "node:test";
import { makeSampleBoard, dateKey } from "./model";
import {
  dueLabel,
  experienceBoard,
  monday,
  monthCells,
  sampleWeek,
  shiftMonth,
  workload,
  workWidgetProps,
  workWidgetTimeline,
} from "./experience";
const now = Date.parse("2026-11-02T02:00:00Z");
test("Monday-based workload separates next week, unknown dates and past dates", () => {
  const board = experienceBoard(makeSampleBoard(now)),
    work = workload(board, now);
  assert.equal(monday("2026-11-01"), "2026-10-26");
  assert.equal(monday("2026-11-02"), "2026-11-02");
  assert.equal(sampleWeek(board, now), 10);
  assert.equal(sampleWeek(board, now + 7 * 86400000), 11);
  assert.equal(work.thisWeek.length, 2);
  assert.deepEqual(
    work.nextWeek.map((a) => a.id),
    ["design-critique"],
  );
  assert.deepEqual(
    work.unknown.map((a) => a.id),
    ["database-quiz"],
  );
  assert.equal(workload(board, board.assessments[0].due!).past.length, 1);
});
test("widget advances at deadline without implying submission and retains unknown date warning", () => {
  const board = experienceBoard(makeSampleBoard(now));
  const due = board.assessments[0].due!;
  assert.equal(workWidgetProps(board, now).title, "Project report");
  assert.match(workWidgetProps(board, now).context, /1 date to confirm/);
  assert.equal(workWidgetProps(board, due).title, "Design portfolio");
  assert.match(workWidgetProps(board, due).context, /1 past date/);
  assert.equal(dueLabel(board.assessments[0], due), "Past date · check");
  const last = Math.max(...board.assessments.map((a) => a.due ?? 0));
  assert.equal(workWidgetProps(board, last).title, "No upcoming dated work");
  assert.match(workWidgetProps(board, last).context, /3 past date/);
});
test("widget dates roll at Sydney midnight including DST and remain strictly ordered", () => {
  const time = Date.parse("2026-10-03T03:00:00Z");
  const timeline = workWidgetTimeline(
    experienceBoard(makeSampleBoard(time)),
    time,
  );
  assert.ok(timeline.every((x, i) => !i || x.date > timeline[i - 1].date));
  const midnights = timeline.filter(
    (x) =>
      x.date.getTime() === Date.parse("2026-10-03T14:00:00Z") ||
      x.date.getTime() === Date.parse("2026-10-04T13:00:00Z"),
  );
  assert.equal(midnights.length, 2);
  assert.equal(
    midnights[1].date.getTime() - midnights[0].date.getTime(),
    23 * 3600000,
  );
  assert.equal(dateKey(midnights[1].date.getTime()), "2026-10-05");
});
test("month layout handles leap years, Monday alignment and year rollover", () => {
  const cells = monthCells("2028-02");
  assert.equal(cells[0], null);
  assert.equal(cells[1], "2028-02-01");
  assert.ok(cells.includes("2028-02-29"));
  assert.equal(cells.length % 7, 0);
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
