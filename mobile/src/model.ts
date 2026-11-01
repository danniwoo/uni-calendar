import { sydneyInstant } from "../../lib/sydney-time";

// Small synthetic-data projection; not a second production schema.
export type SampleClass = {
  id: string;
  unit: string;
  title: string;
  start: number;
  end: number;
  location: string;
  note: string;
};
export type SampleAssessment = {
  id: string;
  unit: string;
  title: string;
  due?: number;
  timing: string;
  weight: string;
  description: string;
  preparation: string;
};
export type SampleBoard = {
  version: 1;
  createdAt: number;
  classes: SampleClass[];
  assessments: SampleAssessment[];
};
export type WidgetProps = {
  label: string;
  unit: string;
  title: string;
  when: string;
  location: string;
  url: string;
};
export const ZONE = "Australia/Sydney";
export const dateKey = (time: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(time);
export const clockTime = (time: number) =>
  new Intl.DateTimeFormat("en-AU", {
    timeZone: ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(time);
export const shortDate = (time: number) =>
  new Intl.DateTimeFormat("en-AU", {
    timeZone: ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(time);
export const longDate = (time: number) =>
  new Intl.DateTimeFormat("en-AU", {
    timeZone: ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(time);

export function makeSampleBoard(now: number): SampleBoard {
  const today = dateKey(now);
  const dayAt = (n: number, time: string) => {
    const date = new Date(Date.parse(`${today}T12:00:00Z`) + n * 86400000)
      .toISOString()
      .slice(0, 10);
    const instant = sydneyInstant(date, time);
    if (instant === undefined)
      throw new Error("Sample time is invalid in Sydney.");
    return instant;
  };
  const first = Math.ceil((now + 45 * 60000) / (15 * 60000)) * 15 * 60000;
  const classes: SampleClass[] = [
    {
      id: "database-tutorial",
      unit: "ISYS2120",
      title: "Database tutorial",
      start: first,
      end: first + 3600000,
      location: "Sample room · Carslaw 351",
      note: "Bring your practice queries. All class times and rooms in this preview are invented.",
    },
    {
      id: "software-workshop",
      unit: "SOFT2412",
      title: "Software workshop",
      start: dayAt(1, "14:00"),
      end: dayAt(1, "16:00"),
      location: "Sample room · PNR 310",
      note: "A sample workshop for reviewing a team project.",
    },
    {
      id: "database-lecture",
      unit: "ISYS2120",
      title: "Database lecture",
      start: dayAt(2, "10:00"),
      end: dayAt(2, "11:00"),
      location: "Sample room · Eastern Avenue",
      note: "A sample lecture on transactions and recovery.",
    },
    {
      id: "design-studio",
      unit: "DECO2017",
      title: "Design studio",
      start: dayAt(3, "13:00"),
      end: dayAt(3, "15:00"),
      location: "Sample room · Wilkinson 204",
      note: "Bring your draft prototype for a sample design review.",
    },
  ].sort((a, b) => a.start - b.start);
  return {
    version: 1,
    createdAt: now,
    classes,
    assessments: [
      {
        id: "project-report",
        unit: "SOFT2412",
        title: "Project report",
        due: dayAt(2, "23:59"),
        timing: "Submission deadline",
        weight: "30%",
        description:
          "Explain the implementation, testing and key decisions in your team project. This is an illustrative assessment, not a university requirement.",
        preparation: "Draft the testing section",
      },
      {
        id: "database-quiz",
        unit: "ISYS2120",
        title: "Database quiz",
        timing: "Teaching week 11 · exact date unconfirmed",
        weight: "5%",
        description:
          "Review joins and relational design. A week-only item stays undated until a real date is confirmed.",
        preparation: "Work through three practice queries",
      },
      {
        id: "design-portfolio",
        unit: "DECO2017",
        title: "Design portfolio",
        due: dayAt(5, "17:00"),
        timing: "Submission deadline",
        weight: "40%",
        description:
          "Bring your research, iterations and final design together. The content and weighting here are sample data.",
        preparation: "Choose the strongest three iterations",
      },
    ],
  };
}
export function nextClass(board: SampleBoard, now: number) {
  return [...board.classes]
    .sort((a, b) => a.start - b.start)
    .find((item) => item.end > now);
}
export function widgetProps(board: SampleBoard, now: number): WidgetProps {
  const item = nextClass(board, now);
  if (!item)
    return {
      label: "SAMPLE SCHEDULE",
      unit: "All clear",
      title: "No more sample classes",
      when: "Open Semester to refresh the sample",
      location: "",
      url: "semester-preview://schedule",
    };
  return {
    label: item.start <= now ? "IN CLASS · SAMPLE" : "NEXT CLASS · SAMPLE",
    unit: item.unit,
    title: item.title,
    when: `${shortDate(item.start)} · ${clockTime(item.start)}–${clockTime(item.end)}`,
    location: item.location,
    url: `semester-preview://class/${item.id}`,
  };
}
export function widgetTimeline(board: SampleBoard, now: number) {
  const times = [
    ...new Set([
      now,
      ...board.classes.flatMap((c) => [c.start, c.end]).filter((t) => t > now),
    ]),
  ].sort((a, b) => a - b);
  return times.map((time) => ({
    date: new Date(time),
    props: widgetProps(board, time),
  }));
}
export function resolveLink(
  url: string,
  board: SampleBoard,
): { kind: "class" | "assessment"; id: string } | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "semester-preview:" || parsed.search || parsed.hash)
      return;
    const id = decodeURIComponent(parsed.pathname.slice(1));
    if (parsed.hostname === "class" && board.classes.some((c) => c.id === id))
      return { kind: "class", id };
    if (
      parsed.hostname === "assessment" &&
      board.assessments.some((a) => a.id === id)
    )
      return { kind: "assessment", id };
  } catch {
    /* Invalid or stale links never open arbitrary content. */
  }
}
export function readStoredSample(
  raw: string | null,
): { board: SampleBoard; progress: Record<string, boolean> } | undefined {
  if (!raw) return;
  try {
    const value = JSON.parse(raw);
    if (
      value.version !== 1 ||
      !Number.isFinite(value.createdAt) ||
      value.createdAt < 0 ||
      value.createdAt > 8e15
    )
      return;
    const board = makeSampleBoard(value.createdAt);
    const progress = Object.fromEntries(
      board.assessments.map((a) => [a.id, value.progress?.[a.id] === true]),
    );
    return { board, progress };
  } catch {
    return;
  }
}
