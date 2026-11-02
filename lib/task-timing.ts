import {weekFor, type Semester, type Task} from "./semester";
import {validDate} from "./assessment-schedule";

export const classKinds = ["Tutorial", "Lecture", "Lab", "Workshop", "Seminar"] as const;
export function classKind(activity: string): string {
  return /tut/i.test(activity) ? "Tutorial" : /lec/i.test(activity) ? "Lecture" : /lab|practical/i.test(activity) ? "Lab" : /workshop/i.test(activity) ? "Workshop" : /seminar/i.test(activity) ? "Seminar" : activity;
}
export function taskClassChoices(s: Semester, unit: string, week: number | undefined, kind: string) {
  if (!week || !kind) return [];
  return s.classes.filter(c => c.unit === unit && c.week === week && weekFor(c.date, s.weeks) === week && classKind(c.activity) === kind)
    .sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}
// Copies the selected timetable occurrence into this draft. No auto-move on refresh.
// Missing/ambiguous classes keep the known week, never the old deadline or a guessed date.
export function classTimingPatch(s: Semester, unit: string, week: number | undefined, kind: string, id?: string): Partial<Task> {
  if (week && !s.weeks.some(w => w.kind === "teaching" && w.number === week)) throw new Error("Choose a teaching week in this semester.");
  const choices = taskClassChoices(s, unit, week, kind);
  const c = id ? choices.find(c => c.id === id) : choices.length === 1 ? choices[0] : undefined;
  if (id && !c) throw new Error("That class is no longer available. Choose it again.");
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (c && (!validDate(c.date) || !clock.test(c.time) || !clock.test(c.end) || c.end <= c.time)) throw new Error("Check this class's date and time before using it.");
  return {week, dueWeek: undefined, date: c?.date, time: c?.time, endTime: c?.end, timeBasis: "class", timing: `During ${kind.toLowerCase() || "class"}${c ? "" : " · date/time unconfirmed"}`};
}
export const taskTimingKeys = ["date", "time", "week", "dueWeek", "timeBasis", "timing", "endTime"] as const;
export function timingEdited(before: Task | undefined, after: Task) {
  return taskTimingKeys.some(k => before?.[k] !== after[k]);
}
export function deadlineTimingPatch(t: Task): Partial<Task> {
  return {timeBasis: "deadline", timing: "Date entered by you", endTime: undefined, dueWeek: undefined, date: t.date, time: t.time, week: t.week};
}
