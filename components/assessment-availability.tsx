"use client";
import {type Task,shortDate} from "@/lib/semester";
import {dateInputPatch} from "@/lib/assessment-schedule";

export function AvailabilitySummary({task}:{task:Task}) {
  if(!task.availableFrom&&!task.availableUntil)return null;
  return <div className="availability-summary">{task.availableFrom&&<p>Available from {shortDate(task.availableFrom)}{task.availableFromTime?` · ${task.availableFromTime}`:" · time not specified"}</p>}{task.availableUntil&&<p>Available until {shortDate(task.availableUntil)}{task.availableUntilTime?` · ${task.availableUntilTime}`:" · time not specified"}</p>}</div>;
}
export function AssessmentAvailability({task,onChange}:{task:Task;onChange:(t:Task)=>void}) {
  return <details className="optional-task-fields" open={task.availableFrom||task.availableUntil?true:undefined}>
    <summary>Availability · opens & closes</summary>
    <p className="hint">Shown in assessment and daily details, not as extra deadlines. Opens suggests 00:00; closes suggests 23:59. Change or clear these times before saving. “Available until” does not extend the due date.</p>
    {([ ["Available from","availableFrom","availableFromTime"],["Available until","availableUntil","availableUntilTime"] ] as const).map(([label,date,time])=><div className="field-pair" key={date}><label>{label}<input type="date" value={task[date]||""} onInput={e=>onChange({...task,...dateInputPatch(task,date,e.currentTarget.value)})}/></label><label>{label} time · Sydney<input type="time" value={task[time]||""} disabled={!task[date]} onInput={e=>onChange({...task,[time]:e.currentTarget.value||undefined})}/></label></div>)}
  </details>;
}
