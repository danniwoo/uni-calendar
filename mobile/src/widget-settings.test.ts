import assert from "node:assert/strict";
import test from "node:test";
import { makeSampleBoard } from "./model";
import {
  experienceBoard,
  workWidgetProps,
  workWidgetTimeline,
} from "./experience";
import {
  DEFAULT_WIDGET_SETTINGS,
  readWidgetSettings,
  toggleWidgetUnit,
  widgetBoard,
} from "./widget-settings";
const now = Date.parse("2026-11-02T02:00:00Z");
const board = experienceBoard(makeSampleBoard(now));
test("saved widget settings restore only known units, deduplicate and retain title visibility", () => {
  assert.deepEqual(
    readWidgetSettings(
      JSON.stringify({
        version: 1,
        units: ["DECO2017", "bogus", "DECO2017"],
        showTitles: false,
      }),
      board,
    ),
    { version: 1, units: ["DECO2017"], showTitles: false },
  );
  for (const raw of [
    null,
    "{",
    "null",
    '{"version":2}',
    '{"version":1,"units":7,"showTitles":true}',
  ])
    assert.deepEqual(readWidgetSettings(raw, board), DEFAULT_WIDGET_SETTINGS);
  // A removed unit must not silently widen the filter to all units.
  assert.deepEqual(
    readWidgetSettings(
      '{"version":1,"units":["bogus"],"showTitles":false}',
      board,
    ).units,
    [],
  );
});
test("unit filter applies to every future entry without changing app assessments", () => {
  const settings = {
    version: 1 as const,
    units: ["DECO2017"],
    showTitles: true,
  };
  const first = workWidgetProps(board, now, settings);
  assert.equal(first.title, "Design portfolio");
  assert.equal(first.url, "semester-preview://assessment/design-portfolio");
  for (const entry of workWidgetTimeline(board, now, settings)) {
    assert.ok(!JSON.stringify(entry.props).includes("SOFT2412"));
    assert.ok(!JSON.stringify(entry.props).includes("ISYS2120"));
    assert.ok(!entry.props.context.includes("date to confirm"));
  }
  assert.equal(board.assessments.length, 4);
  assert.equal(widgetBoard(board, settings).assessments.length, 2);
});
test("hidden titles are absent from both rows across all future entries; useful times and links remain", () => {
  const settings = { ...DEFAULT_WIDGET_SETTINGS, showTitles: false };
  for (const { props } of workWidgetTimeline(board, now, settings))
    for (const a of board.assessments)
      assert.ok(!JSON.stringify(props).includes(a.title));
  const props = workWidgetProps(board, now, settings);
  assert.equal(props.title, "Assessment due");
  assert.equal(props.unit, "SOFT2412");
  assert.equal(props.url, "semester-preview://assessment/project-report");
  assert.match(props.when, /4 Nov/);
});
test("an undated-only unit explains missing dates, and selection can return to all units", () => {
  const settings = {
    version: 1 as const,
    units: ["ISYS2120"],
    showTitles: true,
  };
  const props = workWidgetProps(board, now, settings);
  assert.equal(props.when, "1 date to confirm");
  assert.equal(props.url, "semester-preview://assessments");
  const all = ["SOFT2412", "ISYS2120", "DECO2017"];
  let selected = toggleWidgetUnit(DEFAULT_WIDGET_SETTINGS, "SOFT2412", all);
  assert.deepEqual(selected.units, ["DECO2017", "ISYS2120"]);
  selected = toggleWidgetUnit(selected, "SOFT2412", all);
  assert.equal(selected.units, null);
});
