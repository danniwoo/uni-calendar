import assert from "node:assert/strict";
import test from "node:test";
import { dateKey } from "./model";
import {
  addSuggestedTask,
  matchingSuggestion,
  normaliseTaskDraft,
  planGroups,
  readPersonalPlan,
  serialisePersonalPlan,
  type PersonalTask,
} from "./personal-plan";
const now = Date.parse("2026-11-02T02:00:00Z");
const task: PersonalTask = {
  id: "mine-1",
  title: "Read SQL notes",
  unit: "ISYS2120",
  plannedFor: "2026-11-02",
  createdAt: now,
};
test("personal tasks retain edits, completion and source identity through storage", () => {
  const tasks = [
    { ...task, title: "Review joins", completedAt: now + 60000 },
    {
      ...task,
      id: "suggested",
      sourceKey: "sample-seed:database-quiz",
      plannedFor: "2026-11-03",
    },
  ];
  assert.deepEqual(readPersonalPlan(serialisePersonalPlan(tasks)), tasks);
  assert.deepEqual(readPersonalPlan(null), []);
});
test("unreadable user tasks are rejected rather than silently dropped or reset", () => {
  for (const raw of [
    "{",
    "null",
    '{"version":2,"tasks":[]}',
    serialisePersonalPlan([task, task]),
    serialisePersonalPlan([{ ...task, title: "  " }]),
    serialisePersonalPlan([{ ...task, plannedFor: "2026-02-30" }]),
  ])
    assert.throws(() => readPersonalPlan(raw));
});
test("unfinished tasks carry across Sydney midnight without being moved or marked done", () => {
  const tasks = [
    task,
    { ...task, id: "tomorrow", plannedFor: "2026-11-03" },
    { ...task, id: "done", completedAt: now },
  ];
  assert.equal(planGroups(tasks, "2026-11-02").today.length, 1);
  const nextDay = dateKey(Date.parse("2026-11-02T13:00:00Z"));
  const groups = planGroups(tasks, nextDay);
  assert.deepEqual(
    groups.earlier.map((t) => t.id),
    ["mine-1"],
  );
  assert.deepEqual(
    groups.today.map((t) => t.id),
    ["tomorrow"],
  );
  assert.deepEqual(
    groups.completed.map((t) => t.id),
    ["done"],
  );
  assert.equal(task.plannedFor, "2026-11-02");
});
test("adding suggested preparation cannot duplicate active or already-completed-today plans", () => {
  const suggested = { ...task, sourceKey: "seed:quiz" };
  assert.equal(
    addSuggestedTask(
      [suggested],
      { ...suggested, id: "duplicate" },
      "2026-11-02",
    ).length,
    1,
  );
  assert.ok(
    matchingSuggestion(
      [{ ...suggested, plannedFor: "2026-11-03" }],
      suggested.sourceKey,
      "2026-11-02",
    ),
  );
  assert.ok(
    matchingSuggestion(
      [{ ...suggested, completedAt: now }],
      suggested.sourceKey,
      "2026-11-02",
    ),
  );
  assert.equal(
    matchingSuggestion(
      [{ ...suggested, completedAt: now }],
      suggested.sourceKey,
      "2026-11-03",
    ),
    undefined,
  );
  assert.equal(
    addSuggestedTask(
      [suggested],
      { ...suggested, id: "new-seed", sourceKey: "another-seed:quiz" },
      "2026-11-02",
    ).length,
    2,
  );
});
test("task names and planning dates are validated without creating assessment deadlines", () => {
  assert.deepEqual(
    normaliseTaskDraft({ title: "  Read notes  ", plannedFor: "2026-11-02" }),
    { title: "Read notes", plannedFor: "2026-11-02" },
  );
  assert.throws(() =>
    normaliseTaskDraft({ title: "\n ", plannedFor: "2026-11-02" }),
  );
  assert.throws(() =>
    normaliseTaskDraft({ title: "x".repeat(181), plannedFor: "2026-11-02" }),
  );
  assert.throws(() =>
    normaliseTaskDraft({ title: "Valid title", plannedFor: "2026-11-31" }),
  );
  assert.equal(
    "due" in
      normaliseTaskDraft({ title: "Read notes", plannedFor: "2026-11-02" }),
    false,
  );
});
