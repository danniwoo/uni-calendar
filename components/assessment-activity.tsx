"use client";
import {type Semester,type Task,type AssessmentActivity} from "@/lib/semester";
import {activityLabel,activityHint} from "@/lib/assessment-activity";

export function ActivitySummary({task}:{task:Task}){
  if(!task.activity)return null;
  return <p className="activity-summary"><strong>{activityLabel(task)}</strong>{activityHint(task)&&<small>{activityHint(task)}</small>}</p>;
}
export function ActivityEditor({task,semester,onChange}:{task:Task;semester:Semester;onChange:(t:Task)=>void}){
  const a=task.activity;
  const set=(next:AssessmentActivity|null)=>onChange({...task,activity:next});
  return <details className="optional-task-fields" open={a?true:undefined}>
    <summary>Activity timing · optional</summary>
    <p className="hint">For a demo, presentation or other activity with its own timing. Keep the submission deadline above. No extra steps or grades are created.</p>
    {!a?<button type="button" onClick={()=>set({label:"",week:undefined})}>+ Add activity timing</button>:<>
      <div className="field-pair"><label>Activity name<input maxLength={80} placeholder="e.g. Client demo" value={a.label} onChange={e=>set({...a,label:e.target.value})}/></label>
      <label>Activity timing<select value={a.startDate!==undefined?"dates":"week"} onChange={e=>set(e.target.value==="week"?{label:a.label,week:undefined}:{label:a.label,startDate:""})}><option value="week">Teaching week</option><option value="dates">Date / date range</option></select></label></div>
      {a.startDate===undefined?<label>Activity week<select value={a.week||""} onChange={e=>set({...a,week:e.target.value?Number(e.target.value):undefined})}><option value="">Choose week</option>{semester.weeks.filter(w=>w.kind==="teaching").map(w=><option key={w.id} value={w.number}>{w.label}</option>)}</select></label>:<>
        <div className="field-pair"><label>Activity date / from<input type="date" value={a.startDate} onChange={e=>set({...a,startDate:e.target.value})}/></label><label>Through · optional<input type="date" value={a.endDate||""} onChange={e=>set({...a,endDate:e.target.value||undefined,time:e.target.value&&e.target.value!==a.startDate?undefined:a.time})}/></label></div>
        {(!a.endDate||a.startDate===a.endDate)&&<label>Activity time · optional · Sydney<input type="time" value={a.time||""} onChange={e=>set({...a,time:e.target.value||undefined})}/></label>}
      </>}
      <p className="hint">A week or range is enough. Add a single date later if you arrange one. This does not change the due date or mark anything complete.</p>
      <button type="button" onClick={()=>set(null)}>Remove activity timing</button>
    </>}
  </details>;
}
export function ActivityReminders({tasks,onOpen}:{tasks:Task[];onOpen:(t:Task)=>void}){
  if(!tasks.length)return null;
  return <div className="activity-reminders" aria-label="Activities in this week"><span className="activity-reminders-label">Activities</span>{tasks.map(t=><button key={t.id} className={t.done?"activity-recorded":""} onClick={()=>onOpen(t)} title={t.title}><b>{t.unit} · {activityLabel(t)}</b><span>{t.title}{activityHint(t)?` · ${activityHint(t)}`:""}</span></button>)}</div>;
}
