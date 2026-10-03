export type Week = {
  id: string;
  number?: number;
  label: string;
  start: string;
  end: string;
  kind: "teaching" | "break" | "study" | "exam";
};
export type ClassEvent = {
  id: string;
  unit: string;
  activity: string;
  date: string;
  time: string;
  end: string;
  location: string;
  week?: number;
  topic?: string;
};
export type Task = {
  id: string;
  unit: string;
  title: string;
  weight: string;
  week?: number;
  date?: string;
  time?: string;
  startWeek?: number;
  timing: string;
  kind: "assessment" | "quiz" | "recurring" | "exam";
  description: string;
  source: string;
  sourceText: string;
  coverage?: number[];
  hurdle: boolean;
  group: boolean;
  series?: string;
  warning?: string;
  manual?: boolean;
  done?: boolean;
  rules?: AssessmentRules;
  routine?: boolean;
  parentId?: string;
  endTime?: string;
  timeBasis?: "class" | "deadline";
  passed?: boolean;
  overrides?: string[];
  sourceConflict?: string;
};
export type AssessmentRules = {
  text: string;
  perOccurrence?: number;
  total?: number;
  bestOf?: number;
  threshold?: number;
  attempts?: number;
  coverageText?: string;
  optional?: boolean;
};
export type Unit = {
  code: string;
  name: string;
  session: string;
  outline: string;
  status: string;
  summary: string;
  assessments: Task[];
  topics: { week: number; activity: string; topic: string }[];
};
export type Semester = {
  year: number;
  session: string;
  weeks: Week[];
  units: Unit[];
  classes: ClassEvent[];
  tasks: Task[];
  completed: Record<string, boolean>;
  feedUrl: string;
  importedAt: string;
  warnings: string[];
};
export const COLORS = [
  "#325ccd",
  "#996009",
  "#207565",
  "#8253a2",
  "#a74760",
  "#347183",
];
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const addDays = (s: string, n: number) =>
  new Date(Date.parse(s + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export function sydneyDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function calendar(year: number, session: string): Week[] {
  if (year !== 2026 || !["S1C", "S2C"].includes(session))
    throw new Error(
      "This first version supports standard USYD Semester 1 and 2, 2026. Intensive sessions need manual setup.",
    );
  const s2 = session === "S2C",
    start = s2 ? "2026-08-03" : "2026-02-23",
    after = s2 ? 8 : 6;
  const weeks: Week[] = Array.from({ length: 13 }, (_, i) => {
    const date = addDays(start, (i + (i >= after ? 1 : 0)) * 7);
    return {
      id: `w${i + 1}`,
      number: i + 1,
      label: `Week ${i + 1}`,
      start: date,
      end: addDays(date, 6),
      kind: "teaching",
    };
  });
  weeks.splice(after, 0, {
    id: "break",
    label: "Midsemester break",
    start: s2 ? "2026-09-28" : "2026-04-06",
    end: s2 ? "2026-10-04" : "2026-04-12",
    kind: "break",
  });
  weeks.push(
    {
      id: "study",
      label: "Study vacation",
      start: s2 ? "2026-11-09" : "2026-06-01",
      end: s2 ? "2026-11-15" : "2026-06-07",
      kind: "study",
    },
    {
      id: "exam",
      label: "Exam period",
      start: s2 ? "2026-11-16" : "2026-06-08",
      end: s2 ? "2026-11-28" : "2026-06-20",
      kind: "exam",
    },
  );
  return weeks;
}
export const weekFor = (date: string, weeks: Week[]) =>
  weeks.find((w) => w.start <= date && w.end >= date)?.number;
export function shortDate(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
export function timingLabel(t: Task) {
  if (t.date && t.timeBasis === "class")
    return `${shortDate(t.date)} · ${t.timing.startsWith("Before") ? "before" : "in"} ${/lecture/i.test(t.timing) ? "lecture" : /practical|lab/i.test(t.timing) ? "lab" : "tutorial"}${t.time ? ` ${t.time}${t.endTime ? `–${t.endTime}` : ""}` : ""}`;
  return t.date
    ? `${shortDate(t.date)}${t.time ? ` · ${t.time}` : " · time TBC"}`
    : t.kind === "exam"
      ? "Exam date TBC"
      : t.week
        ? "Day & time TBC"
        : "Timing not published";
}
export function mergeSemester(
  old: Semester | undefined,
  fresh: Semester,
): Semester {
  if (!old || old.year !== fresh.year || old.session !== fresh.session)
    return fresh;
  const map = new Map(old.tasks.map((t) => [t.id, t]));
  fresh.tasks = fresh.tasks.map((t) => {
    const prev = map.get(t.id);
    if (!prev) return t;
    if (prev.manual && !prev.overrides)
      return { ...t, ...prev, rules: t.rules, source: t.source, sourceText: t.sourceText,
        sourceConflict: t.sourceConflict,
        warning: [t.warning, "Previously edited: your dates are preserved. Compare with the current outline."].filter(Boolean).join(" ") };
    const next = { ...t, done: prev.done, passed: prev.passed, manual: prev.manual, overrides: prev.overrides };
    for (const key of prev.overrides || [])
      (next as unknown as Record<string, unknown>)[key] = (prev as unknown as Record<string, unknown>)[key];
    return next;
  });
  const ids = new Set(fresh.tasks.map((t) => t.id));
  const retained = old.tasks.filter((t) => !ids.has(t.id));
  fresh.tasks.push(
    ...retained.map((t) =>
      t.manual
        ? t
        : {
            ...t,
            warning:
              "Not found in the latest import. Kept so your progress is not lost; check the source.",
          },
    ),
  );
  fresh.completed = old.completed;
  return fresh;
}

export const needsPlacement = (t: Task) => !t.week && !t.date && t.kind !== "exam";
export const isRoutine = (t: Task) => !!t.routine || (!!t.series && !t.hurdle);
export function weightLabel(t: Task) {
  if (t.rules?.optional && /bonus/i.test(t.title)) return "Optional bonus";
  if (t.series || t.parentId) return t.rules?.perOccurrence !== undefined
    ? `${t.rules.perOccurrence}% each · ${t.rules.total ?? parseFloat(t.weight)}% cap`
    : `${t.weight.replace(/\s*total$/, "")} across semester`;
  return t.weight;
}
export function isPast(t: Task, s: Semester, now: Date) {
  const day = sydneyDate(now);
  if (!t.date) return !!t.week && (s.weeks.find(w=>w.number === t.week)?.end || "9999") < day;
  if (t.date !== day) return t.date < day;
  const time = t.timeBasis === "class" && !t.timing.startsWith("Before") ? t.endTime : t.time;
  if (!time) return false;
  const current = new Intl.DateTimeFormat("en-GB",{timeZone:"Australia/Sydney",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(now);
  return time < current;
}
