import {type Task,type Semester,type ClassEvent,weekFor} from "./semester";

export const isPersonal = (t:Task) => t.kind === "task" || t.kind === "event";
export const calendarOwns = (s:Semester,t:Task) => (isPersonal(t) && !t.unit) || s.units.some(u=>u.code===t.unit);
export function personalWhen(t:Task) {
  if(!t.date)return "Unscheduled";
  if(t.kind==="event")return t.allDay?"All day":`${t.time}–${t.endTime}`;
  return t.time?`Due ${t.time}`:"Date only";
}
export function preparePersonal(t:Task,s:Semester):Task {
  if(!isPersonal(t))throw new Error("Choose Task or Event.");
  if(!t.title.trim())throw new Error("Give this item a name.");
  if(t.unit&&!s.units.some(u=>u.code===t.unit))throw new Error("Choose a current unit or No unit.");
  if(t.date && (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||new Date(t.date+"T12:00:00Z").toISOString().slice(0,10)!==t.date || !s.weeks.some(w=>t.date!>=w.start&&t.date!<=w.end)))throw new Error("Choose a date within this semester, including its exam period.");
  const time=(v?:string)=>!!v&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  if(t.kind==="event") {
    if(!t.date)throw new Error("Choose a date for this event.");
    if(!t.allDay&&(!time(t.time)||!time(t.endTime)||t.endTime!<=t.time!))throw new Error("Enter a start and a later end time on the same day.");
  } else if(t.time&&(!t.date||!time(t.time)))throw new Error("Choose a date and a valid time, or leave time blank.");
  if(t.link && !/^https?:\/\/\S+$/i.test(t.link))throw new Error("Use a full https:// or http:// link.");
  return {...t,title:t.title.trim(),manual:true,week:t.date?weekFor(t.date,s.weeks):undefined,
    timing:t.kind==="event"?"Personal event":"Personal task",weight:"",hurdle:false,group:false,
    time:t.kind==="event"&&t.allDay?undefined:t.time,
    endTime:t.kind==="event"&&!t.allDay?t.endTime:undefined,
    allDay:t.kind==="event"?!!t.allDay:undefined,done:t.kind==="event"?undefined:t.done};
}
// Timeline projection only. Never insert personal events into imported class data.
export function eventClass(t:Task):ClassEvent {
  return {id:`personal:${t.id}`,unit:t.unit,activity:t.title,date:t.date!,time:t.time!,end:t.endTime!,location:t.location||""};
}
