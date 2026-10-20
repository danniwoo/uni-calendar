import {shortDate,type Semester,type Task,type AssessmentActivity} from "./semester";
import {validDate} from "./assessment-schedule";

export function activityError(value:unknown,s?:Semester):string {
  if(value==null)return "";
  if(typeof value!=="object"||Array.isArray(value))return "Check the activity timing.";
  const a=value as AssessmentActivity;
  if(typeof a.label!=="string"||a.label.length>80)return "Activity name must be at most 80 characters.";
  if(a.week!==undefined){
    if(!Number.isInteger(a.week)||a.week<1||a.week>13)return "Choose an activity teaching week.";
    if(a.startDate!==undefined||a.endDate!==undefined||a.time!==undefined)return "Choose a week or dates for the activity, not both.";
    if(s&&!s.weeks.some(w=>w.kind==="teaching"&&w.number===a.week))return "Choose a teaching week in this semester.";
  }else{
    if(typeof a.startDate!=="string"||!validDate(a.startDate))return "Choose an activity week or start date.";
    if(a.endDate!==undefined&&(typeof a.endDate!=="string"||!validDate(a.endDate)||a.endDate<a.startDate))return "Activity end date must be on or after its start date.";
    if(a.time!==undefined&&(typeof a.time!=="string"||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(a.time)))return "Enter a valid activity time, or leave it blank.";
    if(a.time&&a.endDate&&a.endDate!==a.startDate)return "A time is only used for a single activity date, not a date range.";
    if(s&&[a.startDate,a.endDate||a.startDate].some(d=>!s.weeks.some(w=>d>=w.start&&d<=w.end)))return "Choose activity dates within this semester.";
  }
  return "";
}

export function activityRange(t:Task,s:Semester){
  const a=t.activity;
  if(!a||activityError(a,s))return undefined;
  if(a.week){const w=s.weeks.find(w=>w.kind==="teaching"&&w.number===a.week)!;return {start:w.start,end:w.end};}
  return {start:a.startDate!,end:a.endDate||a.startDate!};
}
export function activityLabel(t:Task){
  const a=t.activity;if(!a)return "";
  const when=a.week?`W${a.week}`:a.startDate?`${shortDate(a.startDate)}${a.endDate&&a.endDate!==a.startDate?` – ${shortDate(a.endDate)}`:""}${a.time?` · ${a.time}`:""}`:"Timing to confirm";
  return `${a.label.trim()||"Activity"} · ${when}`;
}
export function activityHint(t:Task){
  const a=t.activity;
  return a?.week||a?.endDate&&a.endDate!==a.startDate?"Exact date to arrange":"";
}
// One reminder per visible week, never duplicate daily deadlines or grade rows.
export function activitiesInRange(s:Semester,tasks:Task[],start:string,end:string){
  return tasks.filter(t=>{const r=activityRange(t,s);return r&&r.start<=end&&r.end>=start;});
}
