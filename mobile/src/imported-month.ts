import { needsDate, type ImportedAssessments } from "./imported-work";

type Row = ImportedAssessments["rows"][number];
export type MonthCounts = {deadlines:number; activities:number; other:number};

function counts(rows:Row[]):MonthCounts {
  const deadlines=rows.filter(row=>row.deadlineMode!==null).length;
  const activities=rows.filter(row=>row.scheduledActivity).length;
  return {deadlines,activities,other:rows.length-deadlines-activities};
}

export function importedMonth(board:ImportedAssessments, month:string, unit:string|null) {
  const scoped = unit===null ? board.rows : board.rows.filter(row=>row.unit===unit);
  const rows = scoped.filter(row=>row.date?.startsWith(month+"-")).sort((a,b)=>
    a.date!.localeCompare(b.date!) || (a.time || "24:00").localeCompare(b.time || "24:00")
      || a.unit.localeCompare(b.unit) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const byDay = new Map<string,Row[]>();
  for(const row of rows) {
    const date=row.date!;
    const items=byDay.get(date);
    if(items)items.push(row);
    else byDay.set(date,[row]);
  }
  const days = new Map(Array.from(byDay,([date,items])=>[date,{items,...counts(items)}] as const));
  return {days, totals:counts(rows), undated:scoped.filter(needsDate).length};
}
