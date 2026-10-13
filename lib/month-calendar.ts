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
  return [...tasks,...classes].sort((a,b)=>a.date.localeCompare(b.date) || Number(!a.task)-Number(!b.task) || (a.time || "99:99").localeCompare(b.time || "99:99") || a.title.localeCompare(b.title));
}
