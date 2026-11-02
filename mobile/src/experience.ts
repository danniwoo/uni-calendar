import { sydneyInstant } from "../../lib/sydney-time";
import {
  clockTime,
  dateKey,
  shortDate,
  type SampleAssessment,
  type SampleBoard,
} from "./model";

export function addDays(key: string, days: number) {
  return new Date(Date.parse(`${key}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function monday(key: string) {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return addDays(key, -(day + 6) % 7);
}
export function sampleWeek(board: SampleBoard, now: number) {
  return (
    10 +
    Math.round(
      (Date.parse(monday(dateKey(now))) -
        Date.parse(monday(dateKey(board.createdAt)))) /
        604800000,
    )
  );
}
export function dueLabel(item: SampleAssessment, now: number) {
  if (item.due === undefined) return "Date to confirm";
  if (item.due <= now) return "Past date · check";
  const days = Math.round(
    (Date.parse(dateKey(item.due)) - Date.parse(dateKey(now))) / 86400000,
  );
  if (days === 0) return `Today · ${clockTime(item.due)}`;
  if (days === 1) return `Tomorrow · ${clockTime(item.due)}`;
  return `${shortDate(item.due)} · ${clockTime(item.due)}`;
}
// Additional invented work lets this prototype exercise next-week and month views.
// Existing fixture IDs and the v1 saved preparation are preserved.
export function experienceBoard(board: SampleBoard): SampleBoard {
  const due = sydneyInstant(
    addDays(monday(dateKey(board.createdAt)), 9),
    "16:00",
  );
  return {
    ...board,
    assessments: [
      ...board.assessments,
      {
        id: "design-critique",
        unit: "DECO2017",
        title: "Prototype critique",
        due,
        timing: "Submission deadline",
        weight: "10%",
        description:
          "Present one interaction and explain your design choices. Invented preview requirement.",
        preparation: "Choose one interaction to demonstrate",
      },
    ],
  };
}
export function workload(board: SampleBoard, now: number) {
  const start = monday(dateKey(now)),
    end = addDays(start, 7),
    after = addDays(start, 14);
  const dated = board.assessments
    .filter((a) => a.due !== undefined)
    .sort((a, b) => a.due! - b.due!);
  return {
    thisWeek: dated.filter(
      (a) => a.due! > now && dateKey(a.due!) >= start && dateKey(a.due!) < end,
    ),
    nextWeek: dated.filter(
      (a) => dateKey(a.due!) >= end && dateKey(a.due!) < after,
    ),
    past: dated.filter((a) => a.due! <= now),
    unknown: board.assessments.filter((a) => a.due === undefined),
    upcoming: dated.filter((a) => a.due! > now),
  };
}
export function monthCells(month: string): (string | null)[] {
  const first = `${month}-01`,
    offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const [year, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++)
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
export function shiftMonth(month: string, shift: number) {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1 + shift, 1)).toISOString().slice(0, 7);
}
export type WorkWidgetProps = {
  heading: string;
  unit: string;
  title: string;
  when: string;
  second: string;
  secondWhen: string;
  context: string;
  url: string;
};
export function workWidgetProps(
  board: SampleBoard,
  now: number,
): WorkWidgetProps {
  const work = workload(board, now),
    first = work.upcoming[0],
    second = work.upcoming[1];
  const context = [
    work.past.length ? `${work.past.length} past date · check` : "",
    work.unknown.length ? `${work.unknown.length} date to confirm` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    heading: "NEXT DEADLINE · SAMPLE",
    unit: first?.unit ?? "Check your work",
    title: first?.title ?? "No upcoming dated work",
    when: first ? dueLabel(first, now) : "Open assessments",
    second: second ? `${second.unit} · ${second.title}` : "No other dated work",
    secondWhen: second ? dueLabel(second, now) : "",
    context: context || "Sample data · Sydney time",
    url: first
      ? `semester-preview://assessment/${first.id}`
      : "semester-preview://assessments",
  };
}
export function workWidgetTimeline(board: SampleBoard, now: number) {
  const times = new Set([now]);
  // Date labels change at Sydney midnight, not after a fixed 24 hours (DST).
  for (let day = 1; day <= 21; day++) {
    const at = sydneyInstant(addDays(dateKey(now), day), "00:00");
    if (at !== undefined) times.add(at);
  }
  for (const a of board.assessments)
    if (a.due !== undefined && a.due > now) times.add(a.due);
  return [...times]
    .sort((a, b) => a - b)
    .map((time) => ({
      date: new Date(time),
      props: workWidgetProps(board, time),
    }));
}
export const sampleGrades = [
  {
    unit: "ISYS2120",
    title: "Practice quiz",
    score: "8 / 10",
    note: "Sample result · 5% of unit",
  },
  {
    unit: "SOFT2412",
    title: "Project proposal",
    score: "17 / 20",
    note: "Sample result · 10% of unit",
  },
  {
    unit: "DECO2017",
    title: "Research journal",
    score: "Not released",
    note: "Sample · no mark available",
  },
];
