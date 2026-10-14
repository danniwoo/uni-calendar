"use client";
import {useState} from "react";
import {createAssessmentSteps,sprintSteps,stepTiming,tutorialChoices,type AssessmentStep} from "@/lib/assessment-schedule";
import {shortDate,timingLabel,type Semester,type Task} from "@/lib/semester";

export function AssessmentSteps({task,semester,onSave,onCancel}:{task:Task;semester:Semester;onSave:(s:Semester)=>void;onCancel:()=>void}) {
  const count=Math.min(30,Math.max(2,task.rules?.count||2));
  const verified=task.rules?.perOccurrence!==undefined && Math.abs(count*task.rules.perOccurrence-parseFloat(task.weight))<0.01;
  const [rows,setRows]=useState<AssessmentStep[]>(Array.from({length:count},(_,i)=>({title:`Part ${i+1}`,mode:"unknown",weight:verified?String(task.rules!.perOccurrence):""})));
  const [template,setTemplate]=useState(false),[sprints,setSprints]=useState("3"),[first,setFirst]=useState(""),[error,setError]=useState("");
  const [includeDemo,setIncludeDemo]=useState(true),[includeSubmission,setIncludeSubmission]=useState(true);
  const weeks=semester.weeks.filter(w=>w.kind==="teaching");
  const update=(i:number,value:Partial<AssessmentStep>)=>{setRows(old=>old.map((r,j)=>j===i?{...r,...value}:r));setError("");};
  const weekOptions=<><option value="">Choose week</option>{weeks.map(w=><option key={w.id} value={w.number}>W{w.number}</option>)}</>;
  let validation="";try{createAssessmentSteps(semester,task,rows);}catch(e){validation=(e as Error).message;}
  return <section className="assessment-steps schedule-editor">
    <div><strong>Plan assessment steps</strong><p className="hint">{task.weight?`${task.weight} assessment total. `:""}Track demos and submissions separately. Step weights can stay unknown.</p></div>
    <button aria-expanded={template} onClick={()=>setTemplate(!template)}>Sprint demos + submissions…</button>
    {template && <section className="batch-settings">
      <div className="field-pair"><label>Number of sprints<input type="number" min={1} max={15} value={sprints} onChange={e=>setSprints(e.target.value)}/></label><label>First sprint week<select value={first} onChange={e=>setFirst(e.target.value)}>{weekOptions}</select></label></div>
      <label className="inline-label"><input type="checkbox" checked={includeDemo} onChange={e=>setIncludeDemo(e.target.checked)}/>Demo in tutorial</label>
      <label className="inline-label"><input type="checkbox" checked={includeSubmission} onChange={e=>setIncludeSubmission(e.target.checked)}/>Report/code · Sunday 23:59</label>
      <p className="hint">Include only requirements belonging to this assessment. Review every step below; dates are editable and no marks are assumed.</p>
      <button disabled={!first||!includeDemo&&!includeSubmission} onClick={()=>{try{setRows(sprintSteps(semester,Number(sprints),Number(first)).filter(r=>r.mode==="tutorial"?includeDemo:includeSubmission));setError("");setTemplate(false);}catch(e){setError((e as Error).message);}}}>Replace draft with sprint steps</button>
    </section>}
    <div className="assessment-step-list">{rows.map((row,i)=>{
      let summary="";try{summary=timingLabel({...task,date:undefined,time:undefined,week:undefined,endTime:undefined,...stepTiming(semester,task.unit,row)});}catch{}
      const classes=tutorialChoices(semester,task.unit,row.week);
      return <details className="assessment-step" key={i}>
        <summary><strong>{row.title||`Step ${i+1}`}</strong><span>{row.mode==="unknown"?"Schedule not confirmed":row.mode==="tutorial"&&!classes.length?`W${row.week||"?"} · tutorial unconfirmed`:summary||"Choose schedule"}</span></summary>
        <div className="step-fields">
        <div className="step-title"><label>Step {i+1}<input aria-label={`Step ${i+1} name`} value={row.title} onChange={e=>update(i,{title:e.target.value})}/></label><button className="step-remove" aria-label={`Remove step ${i+1}`} disabled={rows.length<=2} onClick={()=>setRows(old=>old.filter((_,j)=>j!==i))}>Remove</button></div>
        <label>When<select aria-label={`Step ${i+1} schedule`} value={row.mode} onChange={e=>update(i,{mode:e.target.value as AssessmentStep["mode"],date:undefined,time:undefined,classId:undefined})}><option value="unknown">Not known yet</option><option value="week">Teaching week only</option><option value="tutorial">In my tutorial</option><option value="date">Exact deadline</option></select></label>
        {(row.mode==="week"||row.mode==="tutorial") && <label>Teaching week<select aria-label={`Step ${i+1} week`} value={row.week||""} onChange={e=>update(i,{week:Number(e.target.value)||undefined,classId:undefined})}>{weekOptions}</select></label>}
        {row.mode==="tutorial" && row.week && <>{classes.length>1 && <label>Tutorial<select aria-label={`Step ${i+1} tutorial`} value={row.classId||""} onChange={e=>update(i,{classId:e.target.value||undefined})}><option value="">Not confirmed yet</option>{classes.map(c=><option key={c.id} value={c.id}>{shortDate(c.date)} · {c.time}–{c.end}</option>)}</select></label>}<p className="hint">{classes.length===1||row.classId?`${summary} · from your imported timetable. Check again if your timetable changes.`:"No unique tutorial selected. This step stays in the week with its date/time unconfirmed."}</p></>}
        {row.mode==="date" && <div className="field-pair"><label>Due date<input aria-label={`Step ${i+1} due date`} type="date" value={row.date||""} onInput={e=>update(i,{date:e.currentTarget.value||undefined})}/></label><label>Time · Sydney<input aria-label={`Step ${i+1} time`} type="time" value={row.time||""} onInput={e=>update(i,{time:e.currentTarget.value||undefined})}/></label></div>}
        <details><summary>Weight · {row.weight?`${row.weight}%`:"not specified"}</summary><label>Course weight (%)<input aria-label={`Step ${i+1} weight`} type="number" min={0} max={100} step="any" value={row.weight||""} placeholder="Unknown" onChange={e=>update(i,{weight:e.target.value})}/></label><small>Optional. Canvas points are not course percentages.</small></details>
        </div>
      </details>;
    })}</div>
    <button disabled={rows.length>=30} onClick={()=>setRows(old=>[...old,{title:`Part ${old.length+1}`,mode:"unknown"}])}>+ Add step</button>
    <p className="hint">{rows.length} independent checkmarks · parent total stays {task.weight||"unchanged"}. Blank weights are unknown, not zero.</p>
    {(error||validation)&&<p className="error" role="alert">{error||validation}</p>}
    <div className="schedule-actions"><button onClick={onCancel}>Cancel</button><button className="primary" disabled={!!validation} onClick={()=>{try{onSave(createAssessmentSteps(semester,task,rows));}catch(e){setError((e as Error).message);}}}>Create {rows.length} steps</button></div>
  </section>;
}
