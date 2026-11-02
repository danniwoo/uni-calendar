import { sydneyInstant } from "../../lib/sydney-time";
import { addDays } from "./experience";
import { dateKey } from "./model";
import { needsDate, type ImportedAssessments } from "./imported-work";
import { MAX_TASK_TITLE } from "./personal-plan";

export type PreparationSuggestion = {id:string; sourceKey:string; title:string; unit:string; context:string};
const sourceKey = (board:ImportedAssessments,id:string) => JSON.stringify([board.year,board.session,id]);

export function planSources(board:ImportedAssessments) {
  return new Map(board.rows.map(row => [sourceKey(board,row.id),row]));
}

export function todaySuggestions(board:ImportedAssessments, now:number):PreparationSuggestion[] {
  const today=dateKey(now), end=addDays(today,6);
  const rows=board.rows.filter(row=>{
    if(row.done || !row.date || row.date<today || row.date>end || !(row.deadlineMode || row.scheduledActivity))return false;
    const at=row.time ? sydneyInstant(row.date,row.time) : undefined;
    return at===undefined || at>now;
  }).sort((a,b)=>a.date!.localeCompare(b.date!) || (a.time || "24:00").localeCompare(b.time || "24:00") || a.id.localeCompare(b.id));
  const undated=board.rows.filter(row=>!row.done && needsDate(row));
  return (rows.length ? rows : undated).slice(0,3).map(row=>{
    const verb=!row.date ? "Check the date for" : /\bdemo\b|presentation/i.test(row.title) ? "Rehearse" :
      /quiz|exam/i.test(row.title) ? "Review topics for" : /prework/i.test(row.title) ? "Work through" :
      /report|essay/i.test(row.title) ? "Review the outline for" : "Review the requirements for";
    const context=row.date ? [row.date,row.time ? (row.deadlineMode==="before" ? "before " : "")+row.time : "time TBC",
      row.deadlineMode ? "Deadline" : "Scheduled activity"].join(" · ") : "Exact date unconfirmed";
    return {id:row.id,unit:row.unit,title:`${verb} ${row.title}`.slice(0,MAX_TASK_TITLE),
      sourceKey:sourceKey(board,row.id),context};
  });
}
