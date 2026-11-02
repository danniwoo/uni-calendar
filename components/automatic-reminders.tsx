"use client";
import {createContext,useContext,useState} from "react";
import type {Semester,Task} from "@/lib/semester";
import {allReminderJobs,automaticBatches,automaticSettingsDraft,automaticReminderError,automaticTaskStatus,type AutomaticReminders,type AutomaticBatch} from "@/lib/automatic-reminders";
import {ReminderDeliveryStatus} from "./reminder-delivery";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "./ui/sheet";

export const AutomaticReminderContext=createContext<{settings?:AutomaticReminders;open:()=>void}>({open:()=>{}});
const atLabel=(at:number)=>new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Sydney",weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(at);
export function AutomaticItemChoice({task,onChange}:{task:Task;onChange:(task:Task)=>void}){
  const context=useContext(AutomaticReminderContext);
  if(task.kind==="task"||task.kind==="event"||task.routine||task.kind==="recurring")return null;
  return <div className="automatic-item-choice">
    <label className="reminder-row"><span>Automatic</span><select aria-label="Automatic alerts for this item" value={task.automaticReminder||"inherit"} onChange={e=>onChange({...task,automaticReminder:e.target.value as Task["automaticReminder"]})}>
      <option value="inherit">Use semester settings</option><option value="off">Off for this item</option><option value="on">Include this item</option>
    </select></label>
    <small>{automaticTaskStatus(task,context.settings)}{task.automaticReminder==="on"&&!context.settings?.enabled?" · turn on in semester settings":""} <button type="button" className="reminder-settings-link" onClick={context.open}>Settings</button></small>
  </div>;
}
export function AutomaticRemindersSheet({semester,onClose,onSave}:{semester:Semester;onClose:()=>void;onSave:(p:AutomaticReminders,expected:Semester)=>void}){
  const [expected]=useState(semester),[now]=useState(()=>Date.now());
  const [p,setP]=useState(()=>automaticSettingsDraft(semester.automaticReminders)),[error,setError]=useState("");
  const preview={...semester,automaticReminders:{...p,enabledAt:p.enabled&&!expected.automaticReminders?.enabled?now:p.enabledAt}};
  const issue=automaticReminderError(preview.automaticReminders),jobs=issue?[]:allReminderJobs(preview,now),batches=issue?[]:automaticBatches(preview,now);
  return <Sheet open onOpenChange={o=>{if(!o)onClose();}}><SheetContent className="detail-panel automatic-reminders-panel"><SheetHeader><SheetTitle>Reminders</SheetTitle><SheetDescription>Helpful nudges for this semester. Custom alerts stay yours.</SheetDescription></SheetHeader>
    <form onSubmit={e=>{e.preventDefault();try{onSave(p,expected);onClose();}catch(err){setError(err instanceof Error?err.message:String(err));}}}>
      <label className="automatic-master"><span><strong>Automatic reminders</strong><small>{p.enabled?"For unfinished items · changes apply after Save":"Off until you turn them on and save"}</small></span><input type="checkbox" checked={p.enabled} onChange={e=>setP({...p,enabled:e.target.checked})}/></label>
      <fieldset disabled={!p.enabled} className="automatic-options"><legend>Remind me about</legend>
        <label><input type="checkbox" checked={p.deadlines} onChange={e=>setP({...p,deadlines:e.target.checked})}/><span><strong>Upcoming deadlines</strong><small>Time to prepare, then a final nudge.</small></span></label>
        <fieldset disabled={!p.deadlines} className="automatic-deadline-times"><legend className="sr-only">Deadline reminder times</legend>
          <label>Plan ahead<select value={p.deadlinePreparation} onChange={e=>setP({...p,deadlinePreparation:e.target.value as AutomaticReminders["deadlinePreparation"]})}><option value="previous-evening">Previous day · 6 pm</option><option value="same-morning">On the day · 9 am</option><option value="24h">24 hours before</option><option value="off">None</option></select></label>
          <label>Final reminder<select value={p.deadlineLeadHours} onChange={e=>setP({...p,deadlineLeadHours:Number(e.target.value)})}>{[1,2,3,6].map(n=><option key={n} value={n}>{n} hour{n===1?"":"s"} before</option>)}<option value={0}>None</option></select></label>
          <small>Due before 9 am? The morning reminder moves to the previous evening. Without a due time, the final reminder is at 9 am.</small>
        </fieldset>
        <label><input type="checkbox" checked={p.activities} onChange={e=>setP({...p,activities:e.target.checked})}/><span><strong>Scheduled quizzes &amp; activities</strong><small>1 day and 30 minutes before. Only scheduled attempts, not every possible retake.</small></span></label>
        <label><input type="checkbox" checked={p.missingDates} onChange={e=>setP({...p,missingDates:e.target.checked})}/><span><strong>Dates to confirm this week</strong><small>Monday at 9 am, or shortly after first enabling for this week. No guessed deadline.</small></span></label>
      </fieldset>
      <fieldset disabled={!p.enabled} className="automatic-quiet"><legend>Keep it quiet</legend><label><input type="checkbox" checked={p.quiet} onChange={e=>setP({...p,quiet:e.target.checked})}/> Quiet hours · Sydney</label>{p.quiet&&<div className="field-pair"><label>From<input type="time" value={p.quietStart} onChange={e=>setP({...p,quietStart:e.target.value})}/></label><label>Until<input type="time" value={p.quietEnd} onChange={e=>setP({...p,quietEnd:e.target.value})}/></label></div>}<small>Automatic deadline alerts move earlier, never past the deadline. Custom alerts keep their chosen times.</small></fieldset>
      <details className="automatic-preview"><summary>Upcoming notifications · {jobs.length} · preview</summary><p>Notification times below · Sydney. Changes apply after Save.</p>{jobs.length?jobs.slice(0,8).map(job=>{const batch=batches.find(b=>b.job.key===job.key);return <div key={job.key}><time>Notify {atLabel(job.when)}</time><strong>{job.title}</strong>{batch&&batch.items.length>1?batch.items.map(i=><small key={i.taskId}>{i.unit} · {i.title} — {i.reason}</small>):<small>{job.unit} · {job.label}</small>}{batch?.items.length===1&&batch.items[0].note&&<small>{batch.items[0].note}</small>}</div>;}):<p>No upcoming alerts with these settings.</p>}{jobs.length>8&&<small>{jobs.length-8} more scheduled</small>}<details className="automatic-timing-details"><summary>How timing works</summary><p>Reminders less than 2 hours apart combine. Same-time items share one notification. If you enable late, one reminder can still be scheduled before the deadline, outside quiet hours. Completed items stop; custom alerts replace automatic ones.</p></details></details>
      <ReminderDeliveryStatus compact/>
      {(error||issue)&&<p className="error" role="alert">{error||issue}</p>}
      <div className="automatic-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit" disabled={!!issue}>Save reminder settings</button></div>
    </form>
  </SheetContent></Sheet>;
}
export function ReminderDigest({batch,onClose,onOpen}:{batch:AutomaticBatch;onClose:()=>void;onOpen:(id:string)=>void}){
  return <Sheet open onOpenChange={o=>{if(!o)onClose();}}><SheetContent className="detail-panel automatic-reminders-panel"><SheetHeader><SheetTitle>Your reminders</SheetTitle><SheetDescription>{atLabel(batch.job.when)} · Sydney</SheetDescription></SheetHeader><div className="automatic-digest">{batch.items.map(i=><button key={i.taskId} onClick={()=>onOpen(i.taskId)}><span>{i.unit}</span><strong>{i.title}</strong><small>{i.reason}</small><span>Open item →</span></button>)}</div></SheetContent></Sheet>;
}
