import type { Semester, Task } from "./semester";

// Display projections only: no new completion state or inferred assessment dates.
export function subjectTasks(s: Semester, code: string, today: string) {
  if (!s.units.some(u => u.code === code)) return { upcoming: [], past: [], unknown: [], exams: [] };
  const tasks = s.tasks.filter(t => t.unit === code && !t.splitCount &&
    !s.tasks.some(child => child.series === t.id || child.parentId === t.id));
  const end = (t: Task) => t.date || s.weeks.find(w => w.number === t.week && w.kind === "teaching")?.end;
  const start = (t: Task) => t.date || s.weeks.find(w => w.number === t.week && w.kind === "teaching")?.start || "9999";
  const sorted = tasks.slice().sort((a,b) => (start(a)+(a.time || "23:59")).localeCompare(start(b)+(b.time || "23:59")) || a.id.localeCompare(b.id));
  return {
    upcoming: sorted.filter(t => !t.done && !(t.kind === "exam" && !t.date) && end(t) && end(t)! >= today),
    past: sorted.filter(t => !t.done && !(t.kind === "exam" && !t.date) && end(t) && end(t)! < today),
    unknown: sorted.filter(t => !t.done && !end(t) && t.kind !== "exam"),
    exams: sorted.filter(t => !t.done && !t.date && t.kind === "exam"),
  };
}

export function subjectAssessments(s: Semester, code: string) {
  const imported = s.units.find(u => u.code === code)?.assessments || [];
  const byId = new Map(imported.filter(t=>!s.tasks.some(current=>current.id===t.id && current.unit!==code)).map(t => [t.id,t]));
  s.tasks.filter(t => t.unit === code).forEach(t => byId.set(t.id,t));
  return [...byId.values()].filter(t => t.unit === code &&
    !(t.parentId && byId.has(t.parentId)) && !(t.series && byId.has(t.series)));
}
