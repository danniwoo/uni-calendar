"use client";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { learningScope } from "@/lib/learning-scope";
import type { Task, Semester, ClassEvent } from "@/lib/semester";

export function AssessmentScope({task,semester,onSave,onToggle}: {
  task:Task; semester:Semester; onSave:(task:Task,weeks:number[])=>void; onToggle:(event:ClassEvent)=>void;
}) {
  const [editing,setEditing] = useState(false);
  const [weeks,setWeeks] = useState<number[]>([]);
  const scope = learningScope(task,semester);
  return <section className="assessment-scope">
    <div className="scope-heading"><strong>Lecture preparation</strong><button onClick={()=>{setWeeks(scope.weeks);setEditing(true);}}>{scope.weeks.length ? "Edit scope" : "Set scope"}</button></div>
    {editing ? <div className="scope-editor">
      <p>Which teaching weeks does this assessment cover?</p>
      <div className="scope-week-picker">{Array.from({length:13},(_,i)=>i+1).map(w=><label key={w}><Checkbox aria-label={`Scope week ${w}`} checked={weeks.includes(w)} onCheckedChange={v=>setWeeks(prev=>v ? [...prev,w] : prev.filter(n=>n!==w))}/>W{w}</label>)}</div>
      <p className="hint">This assessment only. Select known weeks; leave empty if unknown.</p>
      <div className="scope-actions"><button className="primary" onClick={()=>{onSave(task,weeks);setEditing(false);}}>Save scope</button><button onClick={()=>setEditing(false)}>Cancel</button></div>
    </div> : <>
      {scope.weeks.length ? <>
        <p className="scope-status">Covers {scope.label} · {scope.status}</p>
        <p className="hint">{task.overrides?.includes("coverage") ? "Weeks set by you" : "Weeks from imported information"} · checked means worked through, not exam-ready.</p>
        <div className="scope-lectures">{scope.lectures.map(c=><label key={c.id} className={semester.completed[c.id] ? "scope-done" : ""}><Checkbox aria-label={`Preparation ${task.unit} week ${c.week} lecture ${c.date}`} checked={!!semester.completed[c.id]} onCheckedChange={()=>onToggle(c)}/><span><strong>W{c.week} Lecture</strong>{c.topic && <small>{c.topic}</small>}</span></label>)}</div>
      </> : <p className="hint">No confirmed week range yet. We won’t infer it from “the first part of the unit”.</p>}
      {task.rules?.coverageText && <details><summary>Scope wording from outline</summary><p>{task.rules.coverageText}</p></details>}
    </>}
  </section>;
}
