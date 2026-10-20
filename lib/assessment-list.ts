import { type Semester, type Task, shortDate, weightLabel, addDays } from "./semester";
import { subjectAssessments } from "./subject-view";
import { isPersonal } from "./personal-items";
import { assessmentTiming } from "./assessment-schedule";
import {activityLabel} from "./assessment-activity";

export type AssessmentStatus = "all" | "open" | "done";
export type AssessmentDates = "all" | "upcoming" | "past" | "unknown" | "exams";
export type AssessmentSort = "date" | "title" | "unit" | "weight";
export type AssessmentDisplay = "overview" | "schedule";
export type AssessmentFilters = {
  query: string; unit: string; status: AssessmentStatus; dates: AssessmentDates;
  sort: AssessmentSort; descending: boolean; hideRecurring: boolean;
};
export const defaultAssessmentFilters: AssessmentFilters = {
  query: "", unit: "", status: "all", dates: "all", sort: "date", descending: false, hideRecurring: false,
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

function nextStep(s: Semester, children: Task[], today: string) {
  const pending=children.filter(t=>!t.done);
  return pending.find(t=>(dateRange(s,t)?.end || "")>=today) || pending[0] || children[0];
}

export function isRecurringAssessment(task: Task, children: Task[] = []) {
  return task.kind === "recurring" || !!task.routine || children.some(t=>t.series===task.id);
}

// Overview uses the full assessment's earliest recorded schedule, independent of
// completion and child filters. It must not move when a next step is completed.
function overviewAnchor(row: AssessmentRow) {
  return row.grouped ? row.children[0] : row.task;
}

export function assessmentOverviewSchedule(s: Semester, row: AssessmentRow) {
  const recurring=isRecurringAssessment(row.task,row.children);
  if (!row.grouped && !recurring) return {label:assessmentListDate(row.task),detail:activityLabel(row.task)};
  const label=recurring?"Recurring":row.total===1?"1 step":"Multiple dates";
  const dates=row.children.flatMap(t=>t.date?[t.date]:[]).sort();
  if (!dates.length) {
    const weeks=row.children.flatMap(t=>s.weeks.some(w=>w.kind==="teaching"&&w.number===t.week)?[t.week!]:[]).sort((a,b)=>a-b);
    return {label,detail:weeks.length?`W${weeks[0]}${weeks[0]===weeks.at(-1)?"":`–W${weeks.at(-1)}`} · dates TBC`:"Dates to confirm"};
  }
  const first=dates[0], last=dates.at(-1)!;
  const partial=row.children.length<row.total || row.children.some(t=>!t.date);
  return {label:!recurring&&!partial&&first===last?`${row.total} ${row.total===1?"step":"steps"}`:label,detail:`${shortDate(first)}${first===last?"":` – ${shortDate(last)}`}${partial?" · some dates TBC":""}`};
}

// A projection over the same records as the calendar, not a second task store.
export function assessmentRows(s: Semester, filters: AssessmentFilters, today: string, display: AssessmentDisplay = "schedule"): AssessmentRow[] {
  const query=filters.query.trim().toLocaleLowerCase();
  const textMatches=(t:Task)=>`${t.title} ${t.unit}`.toLocaleLowerCase().includes(query);
  const statusMatches=(done:boolean)=>filters.status === "all" || (filters.status === "done" ? done : !done);
  const roots=s.units.filter(u=>!filters.unit || u.code===filters.unit).flatMap(u=>subjectAssessments(s,u.code)).filter(t=>!isPersonal(t));
  const rows:AssessmentRow[]=[];
  for (const task of roots) {
    const children=s.tasks.filter(t=>!isPersonal(t) && t.unit===task.unit && (t.parentId===task.id || t.series===task.id)).sort((a,b)=>compareDate(s,a,b));
    if (filters.hideRecurring && isRecurringAssessment(task,children)) continue;
    const grouped=children.length>0 || !!task.splitCount;
    const total=grouped ? Math.max(children.length,task.splitCount || 0) : 1;
    const completed=grouped ? children.filter(t=>t.done).length : Number(!!task.done);
    const done=completed===total;
    if (display==="overview" && !statusMatches(done)) continue;
    const matchingChildren=children.filter(t=>(!query || textMatches(task) || textMatches(t)) && (display==="overview" || statusMatches(!!t.done)) && assessmentDateMatches(s,t,filters.dates,today));
    if (children.length) {
      if (!matchingChildren.length) continue;
    } else if ((query&&!textMatches(task)) || !statusMatches(done) || !assessmentDateMatches(s,task,filters.dates,today)) continue;
    const next=grouped ? nextStep(s,matchingChildren,today) : task;
    rows.push({task,children,matchingChildren,grouped,completed,total,done,next});
  }
  return rows.sort((a,b)=>{
    const direction=filters.descending?-1:1;
    if (filters.sort === "date") {
      const x=display==="overview"?overviewAnchor(a):a.next, y=display==="overview"?overviewAnchor(b):b.next;
      if (!x || !y) return x ? -1 : y ? 1 : a.task.id.localeCompare(b.task.id);
      return compareDate(s,x,y,filters.descending);
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

export type AssessmentDateSection = {
  key: string; label: string; detail: string; start?: string; end?: string;
  current: boolean; rows: AssessmentRow[];
};
function monday(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

// Group the displayed schedule, not a parent's original date or a stale week field.
// This is presentation only: it never creates deadlines for week-only work.
export function assessmentDateSections(s: Semester, rows: AssessmentRow[], today: string): AssessmentDateSection[] {
  const currentMonday = monday(today);
  const sections = new Map<string, AssessmentDateSection>();
  for (const row of rows) {
    const t = row.next;
    const range = t && dateRange(s, t);
    let section: Omit<AssessmentDateSection, "rows">;
    if (range) {
      const start = monday(range.start), end = addDays(start, 6);
      const week = s.weeks.find(w => w.start <= range.start && w.end >= range.start);
      const relative = start === currentMonday ? "This week" : start === addDays(currentMonday, 7) ? "Next week" : end < today ? "Past" : "";
      const label = [relative, week?.label || "Week of " + shortDate(start)].filter(Boolean).join(" · ");
      section = {key:start, label, detail:`${shortDate(start)} – ${shortDate(end)}`, start, end, current:start === currentMonday};
    } else {
      const exam = t?.kind === "exam" || (!t && row.task.kind === "exam");
      section = {key:exam?"exams":"unknown", label:exam?"Awaiting exam dates":"Dates to confirm", detail:exam?"Timetable not yet announced":"No confirmed calendar date", current:false};
    }
    const existing = sections.get(section.key);
    if (existing) existing.rows.push(row);
    else sections.set(section.key, {...section, rows:[row]});
  }
  return [...sections.values()];
}

export function assessmentStepLabel(s: Semester, row: AssessmentRow, today: string) {
  if (!row.next) return "Schedule to confirm";
  if (row.next.done) return "Recorded step";
  const range = dateRange(s, row.next);
  if (range && range.end < today) return "Past step · unrecorded";
  return nextStep(s,row.children,today)?.id === row.next.id ? "Next step" : "Matching step";
}
