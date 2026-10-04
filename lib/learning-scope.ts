import type { Semester, Task } from "./semester";

export function learningScope(task: Task, semester: Semester) {
  const weeks = [...new Set(task.coverage || [])].filter(w => Number.isInteger(w) && w >= 1 && w <= 13).sort((a,b)=>a-b);
  const lectures = semester.classes.filter(c => c.unit === task.unit && /lecture/i.test(c.activity) && weeks.includes(c.week || 0));
  const unchecked = lectures.filter(c => !semester.completed[c.id]);
  const missing = weeks.filter(w => !lectures.some(c => c.week === w));
  const pendingWeeks = [...new Set(unchecked.map(c => c.week!))].sort((a,b)=>a-b);
  const label = weeks.map(w=>`W${w}`).join(", ");
  const status = !weeks.length ? "Set covered weeks" : [
    pendingWeeks.length ? `${pendingWeeks.map(w=>`W${w}`).join(", ")} lecture${unchecked.length === 1 ? "" : "s"} unchecked` : lectures.length ? "Related lectures checked" : "",
    missing.length ? `${missing.map(w=>`W${w}`).join(", ")} class data missing` : "",
  ].filter(Boolean).join(" · ");
  return {weeks,lectures,unchecked,missing,label,status};
}

export function withCoverage(task: Task, weeks: number[]): Task {
  return {...task, coverage:[...new Set(weeks)].filter(w=>Number.isInteger(w) && w>=1 && w<=13).sort((a,b)=>a-b), manual:true,
    overrides:[...new Set([...(task.overrides || (task.manual ? ["title","unit","weight","week","date","time","startWeek","description","timeBasis","timing","endTime"] : [])),"coverage"])]};
}
