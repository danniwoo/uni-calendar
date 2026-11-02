import { addDays, monday } from "./experience";
import { dateKey } from "./model";
import { nextFocusDeadline } from "./deadline-focus";
import { needsDate, type ImportedAssessments } from "./imported-work";

type WorkRow = ImportedAssessments["rows"][number];

function compareWork(a: WorkRow, b: WorkRow) {
  return a.date!.localeCompare(b.date!) || (a.time || "24:00").localeCompare(b.time || "24:00")
    || a.unit.localeCompare(b.unit) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

export function homeSummary(board: ImportedAssessments, now: number) {
  const today = dateKey(now);
  const start = monday(today);
  const periods = [...board.weeks].sort((a,b) => a.start.localeCompare(b.start));
  const periodAt = (day:string) => periods.find(w => w.start <= day && w.end >= day)?.label;
  const currentPeriod = periodAt(today) ?? (
    !periods.length ? "Your semester" : today < periods[0].start ? "Before semester" :
    today > periods[periods.length - 1].end ? "Semester finished" : "Between semester periods"
  );
  const open = board.rows.filter(row => !row.done && row.date && (row.deadlineMode || row.scheduledActivity)).sort(compareWork);
  function window(startDay:string, endDay:string) {
    const rows = open.filter(row => row.date! >= startDay && row.date! <= endDay);
    return {start:startDay, end:endDay, rows, deadlines:rows.filter(row=>row.deadlineMode).length,
      activities:rows.filter(row=>row.scheduledActivity).length};
  }
  const nextStart = addDays(start,7);
  return {today, currentPeriod, nextPeriod:periodAt(nextStart),
    day:window(today,today), week:window(start,addDays(start,6)), nextWeek:window(nextStart,addDays(start,13)),
    nextDeadline:nextFocusDeadline(board.rows,now),
    undated:board.rows.filter(needsDate).length};
}
