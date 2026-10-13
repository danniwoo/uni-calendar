import {addDays,type Semester,type Task,type ClassEvent} from "./semester";
export type MonthEntry = {id:string;date:string;unit:string;title:string;time?:string;done:boolean;task?:Task;event?:ClassEvent};
export function monthDays(month:string):string[] {
  const start=`${month}-01`,first=new Date(`${start}T12:00:00Z`);
  const offset=(first.getUTCDay()+6)%7;
  const days=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>addDays(start,i-offset));
}
export function shiftMonth(month:string,delta:number):string {
  const [y,m]=month.split("-").map(Number);
  return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);
}
export function monthEntries(s:Semester):MonthEntry[] {
  const active=new Set(s.units.map(u=>u.code));
  const tasks:MonthEntry[]=s.tasks.filter(t=>active.has(t.unit) && t.date && !t.splitCount).map(t=>({id:`task:${t.id}`,date:t.date!,unit:t.unit,title:t.title,time:t.time,done:!!t.done,task:t}));
  const classes:MonthEntry[]=s.classes.filter(c=>active.has(c.unit)).map(c=>({id:`class:${c.id}`,date:c.date,unit:c.unit,title:c.activity,time:c.time,done:!!s.completed[c.id],event:c}));
  return [...tasks,...classes].sort(compareMonthEntries);
}
function priority(e:MonthEntry){return e.task?(e.task.routine && !e.task.hurdle?1:0):2;}
export function compareMonthEntries(a:MonthEntry,b:MonthEntry){
  return a.date.localeCompare(b.date) || priority(a)-priority(b) || (a.time || "99:99").localeCompare(b.time || "99:99") || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}
export type CompletedMode="show"|"collapse"|"hide";
export function dayPreview(entries:MonthEntry[],limit=3,mode:CompletedMode="show"){
  const sorted=[...entries].sort(compareMonthEntries),active=sorted.filter(e=>!e.done);
  if(mode!=="show")return {visible:active.slice(0,limit),overflow:active.slice(limit),completed:mode==="collapse"?sorted.filter(e=>e.done):[]};
  // Completion never changes the ordinary order. Only crowded days give
  // unfinished work priority when choosing which entries fit in the preview.
  const candidates=sorted.length>limit?[...active,...sorted.filter(e=>e.done)]:sorted;
  const chosen=new Set(candidates.slice(0,limit).map(e=>e.id));
  return {visible:sorted.filter(e=>chosen.has(e.id)),overflow:sorted.filter(e=>!chosen.has(e.id)),completed:[]};
}
// Shorten display labels only; never change the stored title or detail view.
export function shortEntryTitle(e:MonthEntry,mobile=false){
  const title=e.title.replace(new RegExp(`^${e.unit}\\s*[-:·]?\\s*`,"i"),"").replace(/\bLecture\b/gi,"Lec").replace(/\bTutorial\b/gi,"Tut").replace(/\bPractical\b/gi,"Lab").replace(/\bAssignment\b/gi,"A").replace(/\bOnline\s+(?=Quiz\b)/gi,"");
  return mobile?title.replace(/\bWorkshop\b/gi,"W/shop").replace(/\bScientific\b/gi,"Sci.").replace(/\bComputational\b/gi,"Comp."):title;
}
export function entryBadge(e:MonthEntry){return e.task?.hurdle?"Hurdle":e.task?.kind==="quiz"?"Quiz":"";}
export type MonthPreferences={month:string;unit:string;classes:boolean;completedMode:CompletedMode};
export function restoreMonthPreferences(value:unknown,initial:string,first:string,last:string,units:string[]):MonthPreferences{
  const p=(value && typeof value==="object"?value:{}) as Partial<MonthPreferences>&{completed?:boolean};
  const completedMode=p.completedMode==="show"||p.completedMode==="collapse"||p.completedMode==="hide"?p.completedMode:p.completed===false?"hide":"show";
  return {month:typeof p.month==="string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.month) && p.month>=first && p.month<=last?p.month:initial,unit:typeof p.unit==="string" && units.includes(p.unit)?p.unit:"all",classes:typeof p.classes==="boolean"?p.classes:true,completedMode};
}
