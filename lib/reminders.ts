import type {Task,Semester} from "./semester";
import {sydneyInstant} from "./sydney-time";
export {sydneyInstant} from "./sydney-time";

/** User choices only. Delivery receipts and permissions do not belong in backups. */
export type Reminder = {id:string;kind:"before";minutes:number} | {id:string;kind:"day";days:number;time:string};
export const MAX_REMINDERS = 5;
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
const day = (value:string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+"T12:00:00Z")) && new Date(value+"T12:00:00Z").toISOString().slice(0,10)===value;
export function reminderKey(r:Reminder) {return r.kind==="before"?`before:${r.minutes}`:`day:${r.days}:${r.time}`;}
export function reminderError(value:unknown):string|undefined {
  if(value===undefined)return;
  if(!Array.isArray(value)||value.length>MAX_REMINDERS)return `Use up to ${MAX_REMINDERS} reminders.`;
  const ids=new Set<string>(),settings=new Set<string>();
  for(const r of value){
    if(!r||typeof r!=="object"||typeof r.id!=="string"||!/^[-\w]{1,80}$/.test(r.id)||ids.has(r.id))return "Invalid reminder ID.";
    if(r.kind==="before"?(!Number.isInteger(r.minutes)||r.minutes<0||r.minutes>40320):r.kind==="day"?(!Number.isInteger(r.days)||r.days<0||r.days>28||typeof r.time!=="string"||!clock.test(r.time)):true)return "Choose a valid reminder time, up to 28 days before.";
    const key=reminderKey(r);if(settings.has(key))return "This reminder is already added.";
    ids.add(r.id);settings.add(key);
  }
}
export function reminderTime(t:Pick<Task,"date"|"time"|"allDay">,r:Reminder):number|undefined {
  if(!t.date||!day(t.date))return;
  if(r.kind==="before") {
    if(!t.time||t.allDay)return;
    const target=sydneyInstant(t.date,t.time);
    return target===undefined?undefined:target-r.minutes*60000;
  }
  const date=new Date(Date.parse(t.date+"T12:00:00Z")-r.days*86400000).toISOString().slice(0,10);
  return sydneyInstant(date,r.time);
}
export function reminderLabel(r:Reminder) {
  if(r.kind==="day")return `${r.days===0?"On the day":`${r.days} day${r.days===1?"":"s"} before`} at ${r.time}`;
  if(r.minutes===0)return "At the scheduled time";
  const n=r.minutes%1440===0?r.minutes/1440:r.minutes%60===0?r.minutes/60:r.minutes;
  const unit=r.minutes%1440===0?"day":r.minutes%60===0?"hour":"minute";
  return `${n} ${unit}${n===1?"":"s"} before`;
}
export function reminderPreview(t:Task,r:Reminder,now=Date.now()) {
  if(reminderError([r]))return "Choose a valid reminder time";
  if(t.done)return "Paused · completed";
  if(!t.date)return "Needs an exact date";
  if(r.kind==="before"&&(!t.time||t.allDay))return "Needs a time · or choose a day and clock time";
  const at=reminderTime(t,r);
  if(at===undefined)return "Choose a different time · daylight-saving change";
  if(at<=now)return "In the past · will not send";
  return new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Sydney",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(at)+" Sydney";
}
export type ReminderJob={key:string;taskId:string;title:string;unit:string;when:number;label:string};
export function reminderJobs(s:Semester|null,now=Date.now()):ReminderJob[] {
  if(!s)return [];
  const units=new Set(s.units.map(u=>u.code));
  return s.tasks.filter(t=>!t.done&&!t.splitCount&&(units.has(t.unit)||(!t.unit&&(t.kind==="task"||t.kind==="event")))).flatMap(t=>{
    if(reminderError(t.reminders))return [];
    return (t.reminders||[]).flatMap(r=>{const when=reminderTime(t,r);return when!==undefined&&when>now?[{
      key:JSON.stringify([s.boardGeneration||`${s.year}:${s.session}`,t.id,r.id,when]),taskId:t.id,title:t.title.slice(0,180),unit:t.unit,when,
      label:`${t.date}${t.time&&!t.allDay?` · ${t.time}`:""} Sydney`,
    }]:[];});
  });
}
