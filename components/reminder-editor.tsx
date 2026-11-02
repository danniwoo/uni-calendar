"use client";
import type {Task} from "@/lib/semester";
import {MAX_REMINDERS,reminderError,reminderKey,reminderLabel,reminderPreview,type Reminder} from "@/lib/reminders";
import {ReminderDeliveryStatus} from "./reminder-delivery";
import {AutomaticItemChoice} from "./automatic-reminders";
const presets:Reminder[]=[...[0,5,10,15,30,60,120,1440].map(minutes=>({id:"",kind:"before" as const,minutes})),{id:"",kind:"day",days:0,time:"09:00"},{id:"",kind:"day",days:1,time:"09:00"},{id:"",kind:"day",days:2,time:"09:00"},{id:"",kind:"day",days:7,time:"09:00"}];
export function ReminderEditor({task,onChange}:{task:Task;onChange:(task:Task)=>void}) {
  const reminders=task.reminders||[],issue=reminderError(reminders);
  const change=(id:string,next:Reminder)=>onChange({...task,reminders:reminders.map(r=>r.id===id?next:r)});
  function add(){const used=new Set(reminders.map(reminderKey));const preset=[...presets.filter(r=>r.kind==="before"&&r.minutes>0),...presets].find(r=>!used.has(reminderKey(r))&&(r.kind==="day"||(task.time&&!task.allDay)))||{id:"",kind:"day" as const,days:3,time:"09:00"};onChange({...task,reminders:[...reminders,{...preset,id:crypto.randomUUID()}]});}
  return <section className="reminder-editor" aria-label="Reminders">
    <div className="reminder-heading"><strong>Reminders</strong><span>Sydney time</span></div>
    <AutomaticItemChoice task={task} onChange={onChange}/>
    {!reminders.length&&<label className="reminder-row"><span>Custom alert</span><select aria-label="First alert" value="none" onChange={e=>{const p=presets.find(p=>reminderKey(p)===e.target.value)||(e.target.value==="custom-day"?{id:"",kind:"day" as const,days:3,time:"09:00"}:e.target.value==="custom-before"?{id:"",kind:"before" as const,minutes:45}:undefined);if(p)onChange({...task,reminders:[{...p,id:crypto.randomUUID()}]});}}><option value="none">None added</option>{presets.map(p=><option key={reminderKey(p)} value={reminderKey(p)} disabled={p.kind==="before"&&(!task.time||!!task.allDay)}>{reminderLabel(p)}</option>)}<option value="custom-day">Custom days &amp; time…</option><option value="custom-before" disabled={!task.time||!!task.allDay}>Custom minutes before…</option></select></label>}
    {reminders.map((r,i)=>{const preset=presets.find(p=>reminderKey(p)===reminderKey(r));return <div className="reminder-choice" key={r.id}>
      <div className="reminder-row"><span>{i===0?"Custom alert":i===1?"Second alert":`Alert ${i+1}`}</span><select aria-label={`Reminder ${i+1}`} value={preset?reminderKey(preset):r.kind==="day"?"custom-day":"custom-before"} onChange={e=>{const choice=presets.find(p=>reminderKey(p)===e.target.value);change(r.id,choice?{...choice,id:r.id}:e.target.value==="custom-day"?{id:r.id,kind:"day",days:3,time:"09:00"}:{id:r.id,kind:"before",minutes:45});}}>
        {presets.map(p=><option key={reminderKey(p)} value={reminderKey(p)} disabled={(p.kind==="before"&&(!task.time||!!task.allDay))||reminders.some(x=>x.id!==r.id&&reminderKey(x)===reminderKey(p))}>{reminderLabel(p)}</option>)}<option value="custom-day">Custom days &amp; time…</option><option value="custom-before" disabled={!task.time||!!task.allDay}>Custom minutes before…</option>
      </select><button className="reminder-remove" type="button" aria-label={`Remove reminder ${i+1}`} title="Remove reminder" onClick={()=>onChange({...task,reminders:reminders.filter(x=>x.id!==r.id)})}>×</button></div>
      {!preset&&(r.kind==="day"?<div className="field-pair reminder-custom"><label>Days before<input type="number" min={0} max={28} value={Number.isFinite(r.days)?r.days:""} onChange={e=>change(r.id,{...r,days:e.target.valueAsNumber})}/></label><label>Time · Sydney<input type="time" value={r.time} onInput={e=>change(r.id,{...r,time:e.currentTarget.value})}/></label></div>:<label className="reminder-custom">Minutes before<input type="number" min={0} max={40320} value={Number.isFinite(r.minutes)?r.minutes:""} onChange={e=>change(r.id,{...r,minutes:e.target.valueAsNumber})}/></label>)}
      <small>{reminderPreview(task,r)}</small>
    </div>;})}
    {reminders.length>0&&<button className="reminder-add" type="button" disabled={reminders.length>=MAX_REMINDERS} onClick={add}>{reminders.length>=MAX_REMINDERS?`${MAX_REMINDERS} reminders added`:"+ Add reminder"}</button>}
    {issue&&<p role="alert" className="error">{issue}</p>}
    {!task.date&&<small>Custom alerts need an exact date. Automatic date-check prompts can use the teaching week.</small>}
    <ReminderDeliveryStatus compact/>
  </section>;
}
