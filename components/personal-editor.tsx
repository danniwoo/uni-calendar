"use client";
import {useState} from "react";
import type {Semester,Task} from "@/lib/semester";
import {preparePersonal,personalWhen} from "@/lib/personal-items";

export function PersonalEditor({item,semester,onSave,onDelete,onAssessment,onView}:{item:Task;semester:Semester;onSave:(t:Task)=>void;onDelete:(t:Task)=>void;onAssessment:()=>void;onView:(t:Task)=>void}) {
  const [draft,setDraft]=useState(item),[error,setError]=useState(""),[saved,setSaved]=useState(false),[deleted,setDeleted]=useState(false),[confirmDelete,setConfirmDelete]=useState(false);
  const exists=semester.tasks.some(t=>t.id===item.id),event=draft.kind==="event";
  const [removed,setRemoved]=useState<Task|null>(null);
  const update=(patch:Partial<Task>)=>{setDraft(d=>({...d,...patch}));setError("");setSaved(false);setConfirmDelete(false);};
  if(deleted)return <div className="personal-editor"><p role="status">Removed from Month and Week.</p><button onClick={()=>{const original=removed||item;onSave(original);setDraft(original);setDeleted(false);setSaved(true);}}>Undo delete</button></div>;
  return <form className="personal-editor" onSubmit={e=>{e.preventDefault();try{const next=preparePersonal(draft,semester);onSave(next);setDraft(next);setSaved(true);setError("");}catch(err){setError((err as Error).message);}}}>
    {!exists&&<div className="task-mode" role="group" aria-label="Item type"><button type="button" aria-pressed={!event} onClick={()=>update({kind:"task",time:undefined,endTime:undefined,allDay:undefined})}>Task</button><button type="button" aria-pressed={event} onClick={()=>update({kind:"event",time:undefined,endTime:undefined,allDay:false,done:undefined})}>Event</button><button type="button" onClick={onAssessment}>Assessment</button></div>}
    <p className="hint">{event?"A meeting, study session or other event. Not an assessment or completion record.":"Something to do. Add a deadline if you need one, or leave it unscheduled."} Only in Month & Week.</p>
    <label>Name<input autoFocus required maxLength={200} value={draft.title} placeholder={event?"e.g. Project meeting":"e.g. Review W3 lecture"} onChange={e=>update({title:e.target.value})}/></label>
    <label><span>Unit <small>optional</small></span><select value={draft.unit} onChange={e=>update({unit:e.target.value})}><option value="">No unit</option>{semester.units.map(u=><option key={u.code} value={u.code}>{u.code}</option>)}</select></label>
    <label>{event?"Date":"Due date · optional"}<input type="date" required={event} min={semester.weeks[0].start} max={semester.weeks.at(-1)?.end} value={draft.date||""} onInput={e=>update({date:e.currentTarget.value||undefined,...(!e.currentTarget.value?{time:undefined,endTime:undefined}:{})})}/></label>
    {event&&<label className="inline-label"><input type="checkbox" checked={!!draft.allDay} onChange={e=>update({allDay:e.target.checked,time:undefined,endTime:undefined})}/>All day</label>}
    {event&&!draft.allDay?<div className="field-pair"><label>Start · Sydney<input type="time" required value={draft.time||""} onInput={e=>update({time:e.currentTarget.value})}/></label><label>End · Sydney<input type="time" required value={draft.endTime||""} onInput={e=>update({endTime:e.currentTarget.value})}/></label></div>:!event&&draft.date?<label>Due time · optional · Sydney<input type="time" value={draft.time||""} onInput={e=>update({time:e.currentTarget.value||undefined})}/></label>:null}
    <details><summary>More options · {event?"location, link & notes":"notes"}</summary>
      {event&&<><label>Location<input value={draft.location||""} onChange={e=>update({location:e.target.value})}/></label><label>Meeting link<input type="url" value={draft.link||""} placeholder="https://…" onChange={e=>update({link:e.target.value.trim()})}/></label></>}
      <label>Notes<textarea rows={3} value={draft.description} onChange={e=>update({description:e.target.value})}/></label>
    </details>
    {!event&&exists&&<label className="inline-label"><input type="checkbox" checked={!!draft.done} onChange={e=>update({done:e.target.checked})}/>Completed</label>}
    {error&&<p className="error" role="alert">{error}</p>}
    {saved&&<div className="personal-saved" role="status"><p>Saved · {draft.date||""} {personalWhen(draft)}</p><button type="button" onClick={()=>onView(draft)}>{draft.date?"View in Week":"View unscheduled tasks"} →</button></div>}
    <button className="primary" type="submit">{exists?"Save changes":event?"Add event":"Add task"}</button>
    {exists&&<div className="personal-delete">{confirmDelete?<><p>Delete this {event?"event":"task"} from your calendar?</p><button type="button" onClick={()=>{setRemoved(semester.tasks.find(t=>t.id===item.id)||item);onDelete(draft);setDeleted(true);}}>Delete {event?"event":"task"}</button><button type="button" onClick={()=>setConfirmDelete(false)}>Cancel</button></>:<button type="button" onClick={()=>setConfirmDelete(true)}>Delete {event?"event":"task"}</button>}</div>}
  </form>;
}
