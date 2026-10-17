import { type Semester, type Task, shortDate, weightLabel } from "./semester";
import { subjectAssessments } from "./subject-view";
import { isPersonal } from "./personal-items";
import { assessmentTiming } from "./assessment-schedule";

export type AssessmentStatus = "all" | "open" | "done";
export type AssessmentDates = "all" | "upcoming" | "past" | "unknown" | "exams";
export type AssessmentSort = "date" | "title" | "unit" | "weight";
export type AssessmentFilters = {
  query: string; unit: string; status: AssessmentStatus; dates: AssessmentDates;
  sort: AssessmentSort; descending: boolean;
};
export const defaultAssessmentFilters: AssessmentFilters = {
  query: "", unit: "", status: "all", dates: "all", sort: "date", descending: false,
};
export type AssessmentRow = {
  task: Task; children: Task[]; matchingChildren: Task[]; grouped: boolean;
  completed: number; total: number; done: boolean; next?: Task;
};

function dateRange(s: Semester, t: Task) {
  if (t.kind === "exam" && !t.date) return undefined;
  if (t.date) return {start:t.date, end:t.date};
  return s.weeks.find(w => w.kind === "teaching" && w.number === t.week);
}
function dateKey(s: Semester, t: Task) {
  const range = dateRange(s,t);
  return range ? range.start + (t.time || "23:59") : undefined;
}
function compareDate(s: Semester, a: Task, b: Task, descending = false) {
  const x=dateKey(s,a), y=dateKey(s,b);
  // Unscheduled work stays visible at the end, in either sort direction.
  if (!x || !y) return x ? -1 : y ? 1 : a.id.localeCompare(b.id);
  return x.localeCompare(y)*(descending?-1:1) || a.id.localeCompare(b.id);
}
export function assessmentDateMatches(s: Semester, t: Task, filter: AssessmentDates, today: string) {
  const range=dateRange(s,t);
  switch(filter) {
    case "upcoming": return !!range && range.end >= today;
    case "past": return !!range && range.end < today;
    case "unknown": return !t.date && t.kind !== "exam";
    case "exams": return t.kind === "exam" && !t.date;
    default: return true;
  }
}
export function assessmentListDate(t: Task) {
  if (t.kind === "exam" && !t.date) return "Awaiting exam date";
  if (!t.date) return t.week ? `W${t.week} · day & time TBC` : t.kind === "recurring" ? "Schedule to confirm" : "Date not set";
  return assessmentTiming(t);
}
export function assessmentListWeight(t: Task, grouped = false) {
  if (!t.weight && t.rules?.perOccurrence === undefined) return "—";
  if (grouped) return t.weight ? `${t.weight.replace(/\s*total$/i, "")} total` : "—";
  return weightLabel(t) || "—";
}

// A projection over the same records as the calendar, not a second task store.
export function assessmentRows(s: Semester, filters: AssessmentFilters, today: string): AssessmentRow[] {
  const query=filters.query.trim().toLocaleLowerCase();
  const textMatches=(t:Task)=>`${t.title} ${t.unit}`.toLocaleLowerCase().includes(query);
  const statusMatches=(done:boolean)=>filters.status === "all" || (filters.status === "done" ? done : !done);
  const roots=s.units.filter(u=>!filters.unit || u.code===filters.unit).flatMap(u=>subjectAssessments(s,u.code)).filter(t=>!isPersonal(t));
  const rows:AssessmentRow[]=[];
  for (const task of roots) {
    const children=s.tasks.filter(t=>!isPersonal(t) && t.unit===task.unit && (t.parentId===task.id || t.series===task.id)).sort((a,b)=>compareDate(s,a,b));
    const grouped=children.length>0 || !!task.splitCount;
    const total=grouped ? Math.max(children.length,task.splitCount || 0) : 1;
    const completed=grouped ? children.filter(t=>t.done).length : Number(!!task.done);
    const done=completed===total;
    const matchingChildren=children.filter(t=>(!query || textMatches(task) || textMatches(t)) && statusMatches(!!t.done) && assessmentDateMatches(s,t,filters.dates,today));
    if (children.length) {
      if (!matchingChildren.length) continue;
    } else if ((query&&!textMatches(task)) || !statusMatches(done) || !assessmentDateMatches(s,task,filters.dates,today)) continue;
    const pending=matchingChildren.filter(t=>!t.done);
    const next=grouped ? (pending.find(t=>(dateRange(s,t)?.end || "")>=today) || pending[0] || matchingChildren[0]) : task;
    rows.push({task,children,matchingChildren,grouped,completed,total,done,next});
  }
  return rows.sort((a,b)=>{
    const direction=filters.descending?-1:1;
    if (filters.sort === "date") {
      if (!a.next || !b.next) return a.next ? -1 : b.next ? 1 : a.task.id.localeCompare(b.task.id);
      return compareDate(s,a.next,b.next,filters.descending);
    }
    if (filters.sort === "weight") {
      const x=parseFloat(a.task.weight), y=parseFloat(b.task.weight);
      if (!Number.isFinite(x)||!Number.isFinite(y)) return Number.isFinite(x)?-1:Number.isFinite(y)?1:a.task.id.localeCompare(b.task.id);
      return (x-y)*direction || a.task.title.localeCompare(b.task.title);
    }
    return a.task[filters.sort].localeCompare(b.task[filters.sort])*direction || a.task.id.localeCompare(b.task.id);
  });
}

export function assessmentDateContext(s: Semester, t: Task) {
  if (t.date) return t.week ? `W${t.week}` : "";
  const week=s.weeks.find(w=>w.kind==="teaching"&&w.number===t.week);
  return week && t.kind!=="exam" ? `${shortDate(week.start)} – ${shortDate(week.end)}` : "";
}
