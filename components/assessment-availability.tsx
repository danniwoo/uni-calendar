"use client";
import {type Task,shortDate} from "@/lib/semester";

export function AvailabilitySummary({task}:{task:Task}) {
  if(!task.availableFrom&&!task.availableUntil)return null;
  return <div className="availability-summary">{task.availableFrom&&<p>Available from {shortDate(task.availableFrom)}{task.availableFromTime?` · ${task.availableFromTime}`:" · time not specified"}</p>}{task.availableUntil&&<p>Available until {shortDate(task.availableUntil)}{task.availableUntilTime?` · ${task.availableUntilTime}`:" · time not specified"}</p>}</div>;
}
export function AssessmentAvailability({task,onChange}:{task:Task;onChange:(t:Task)=>void}) {
  return <details className="optional-task-fields" open={task.availableFrom||task.availableUntil?true:undefined}>
    <summary>Availability · opens & closes</summary>
    <p className="hint">Separate from the due date and your planned start. Leave unknown times blank. “Available until” does not extend the deadline.</p>
    {([ ["Available from","availableFrom","availableFromTime"],["Available until","availableUntil","availableUntilTime"] ] as const).map(([label,date,time])=><div className="field-pair" key={date}><label>{label}<input type="date" value={task[date]||""} onInput={e=>onChange({...task,[date]:e.currentTarget.value||undefined,[time]:e.currentTarget.value?task[time]:undefined})}/></label><label>{label} time · Sydney<input type="time" value={task[time]||""} disabled={!task[date]} onInput={e=>onChange({...task,[time]:e.currentTarget.value||undefined})}/></label></div>)}
  </details>;
}
