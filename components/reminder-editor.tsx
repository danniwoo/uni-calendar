"use client";
import type {Task} from "@/lib/semester";
import {MAX_REMINDERS,reminderError,reminderKey,reminderLabel,reminderPreview,type Reminder} from "@/lib/reminders";
import {ReminderDeliveryStatus} from "./reminder-delivery";
const presets:Reminder[]=[{id:"",kind:"day",days:1,time:"09:00"},{id:"",kind:"day",days:2,time:"09:00"},{id:"",kind:"day",days:7,time:"09:00"},{id:"",kind:"day",days:0,time:"09:00"},...[0,10,30,60,1440].map(minutes=>({id:"",kind:"before" as const,minutes}))];
export function ReminderEditor({task,onChange}:{task:Task;onChange:(task:Task)=>void}) {
  const reminders=task.reminders||[],issue=reminderError(reminders);
  const change=(id:string,next:Reminder)=>onChange({...task,reminders:reminders.map(r=>r.id===id?next:r)});
  function add(){const used=new Set(reminders.map(reminderKey));const preset=presets.find(r=>!used.has(reminderKey(r))&&(r.kind==="day"||(task.time&&!task.allDay)))||{id:"",kind:"day" as const,days:3,time:"09:00"};onChange({...task,reminders:[...reminders,{...preset,id:crypto.randomUUID()}]});}
  return <section className="reminder-editor" aria-label="Reminders">
    <div className="reminder-heading"><strong>Reminders</strong><span>{reminders.length?`${reminders.length} / ${MAX_REMINDERS}`:"None"}</span></div>
    {reminders.map((r,i)=>{const preset=presets.find(p=>reminderKey(p)===reminderKey(r));return <div className="reminder-choice" key={r.id}>
      <div className="reminder-row"><select aria-label={`Reminder ${i+1}`} value={preset?reminderKey(preset):r.kind==="day"?"custom-day":"custom-before"} onChange={e=>{const choice=presets.find(p=>reminderKey(p)===e.target.value);change(r.id,choice?{...choice,id:r.id}:e.target.value==="custom-day"?{id:r.id,kind:"day",days:3,time:"09:00"}:{id:r.id,kind:"before",minutes:45});}}>
        {presets.map(p=><option key={reminderKey(p)} value={reminderKey(p)} disabled={(p.kind==="before"&&(!task.time||!!task.allDay))||reminders.some(x=>x.id!==r.id&&reminderKey(x)===reminderKey(p))}>{reminderLabel(p)}</option>)}<option value="custom-day">Custom days &amp; time…</option><option value="custom-before" disabled={!task.time||!!task.allDay}>Custom minutes before…</option>
      </select><button type="button" aria-label={`Remove reminder ${i+1}`} onClick={()=>onChange({...task,reminders:reminders.filter(x=>x.id!==r.id)})}>Remove</button></div>
      {!preset&&(r.kind==="day"?<div className="field-pair reminder-custom"><label>Days before<input type="number" min={0} max={28} value={Number.isFinite(r.days)?r.days:""} onChange={e=>change(r.id,{...r,days:e.target.valueAsNumber})}/></label><label>Time · Sydney<input type="time" value={r.time} onChange={e=>change(r.id,{...r,time:e.target.value})}/></label></div>:<label className="reminder-custom">Minutes before<input type="number" min={0} max={40320} value={Number.isFinite(r.minutes)?r.minutes:""} onChange={e=>change(r.id,{...r,minutes:e.target.valueAsNumber})}/></label>)}
      <small>{reminderPreview(task,r)}</small>
    </div>;})}
    <button type="button" disabled={reminders.length>=MAX_REMINDERS} onClick={add}>+ Add reminder</button>
    {issue&&<p role="alert" className="error">{issue}</p>}
    {!task.date&&<small>Add an exact date to activate reminders. A teaching week alone is not enough.</small>}
    <small>Changes apply when you save this item.</small><ReminderDeliveryStatus/>
  </section>;
}
