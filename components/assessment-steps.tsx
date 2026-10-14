"use client";
import {useEffect,useState} from "react";
import {AssessmentConfirm} from "@/components/assessment-confirm";
import {updateAssessmentSteps,initialAssessmentSteps,submissionStep,repeatedAssessmentSteps,suggestFollowingSteps,stepTiming,tutorialChoices,type AssessmentStep} from "@/lib/assessment-schedule";
import {shortDate,timingLabel,weekFor,type Semester,type Task} from "@/lib/semester";

export function AssessmentSteps({task,semester,onSave,onCancel,onDirtyChange,addDeadline=false,focusStepId}:{task:Task;semester:Semester;onSave:(s:Semester)=>void;onCancel:()=>void;onDirtyChange?:(dirty:boolean)=>void;addDeadline?:boolean;focusStepId?:string}) {
  const existing=semester.tasks.filter(t=>t.parentId===task.id);
  const editing=existing.length>0;
  const [initial]=useState<AssessmentStep[]>(()=>initialAssessmentSteps(semester,task));
  const [rows,setRows]=useState<AssessmentStep[]>(()=>addDeadline&&initial.length<30?[...initial,submissionStep()]:initial);
  const [openRows,setOpenRows]=useState<number[]>(()=>addDeadline?[initial.length]:focusStepId?[initial.findIndex(r=>r.id===focusStepId)]:editing?[]:[0]);
  const dirty=JSON.stringify(rows)!==JSON.stringify(initial);
  useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
  const removed=existing.filter(t=>!rows.some(r=>r.id===t.id));
  const [confirmation,setConfirmation]=useState<{title:string;description:string;action:string;run:()=>void}|null>(null);
  function cancel(){if(!dirty)onCancel();else setConfirmation({title:"Discard step changes?",description:"Your saved steps will stay unchanged.",action:"Discard changes",run:onCancel});}
  function applySave(){try{onSave(updateAssessmentSteps(semester,task,rows));}catch(e){setError((e as Error).message);}}
  function save(){if(removed.length)setConfirmation({title:`Remove ${removed.length} saved step(s)?`,description:`${removed.map(t=>t.title).join(" · ")}. You can undo this change from the assessment summary.`,action:"Remove and save",run:applySave});else applySave();}
  const [template,setTemplate]=useState(false),[sprints,setSprints]=useState("3"),[first,setFirst]=useState(""),[error,setError]=useState("");
  const [includeDemo,setIncludeDemo]=useState(true),[includeSubmission,setIncludeSubmission]=useState(true);
  const [autoSequence,setAutoSequence]=useState(!editing),[roundLabel,setRoundLabel]=useState("Part"),[submissionDay,setSubmissionDay]=useState("6"),[submissionTime,setSubmissionTime]=useState("23:59");
  const weeks=semester.weeks.filter(w=>w.kind==="teaching");
  const update=(i:number,value:Partial<AssessmentStep>)=>{const schedule=["mode","week","date","time","classId"].some(k=>k in value);setRows(old=>{const next=old.map((r,j)=>j===i?{...r,...value,...(schedule?{scheduleEdited:true,autoFilled:false}:{})}:r);return i===0&&schedule&&autoSequence?suggestFollowingSteps(semester,next):next;});setError("");};
  function addStep(demo=false){setRows(old=>{const next:AssessmentStep[]=[...old,{title:demo?"Demo":`Part ${old.length+1}`,mode:"unknown"}];const filled=autoSequence?suggestFollowingSteps(semester,next):next;if(demo){const last=filled.length-1;filled[last]={...filled[last],mode:"tutorial",date:undefined,time:undefined,classId:undefined,scheduleEdited:true,autoFilled:false};}return filled;});setError("");}
  const weekOptions=<><option value="">Choose week</option>{weeks.map(w=><option key={w.id} value={w.number}>W{w.number}</option>)}</>;
  let validation="";try{updateAssessmentSteps(semester,task,rows);}catch(e){validation=(e as Error).message;}
  return <section className="assessment-steps schedule-editor">
    {confirmation&&<AssessmentConfirm {...confirmation} onCancel={()=>setConfirmation(null)} onConfirm={()=>{const run=confirmation.run;setConfirmation(null);run();}}/>}
    <div><strong>{editing?"Edit assessment steps":"Plan assessment steps"}</strong><p className="hint">{task.weight?`${task.weight} assessment total. `:""}{editing?"Existing completion, notes and preparation scope are kept.":"Track demos and submissions separately. Step weights can stay unknown."}</p><p className="hint">In tutorial is a class appointment, not a submission deadline. Add a submission separately if required.</p>{!editing&&task.date&&<p className="hint">Your existing deadline is kept in the first step. Review it before saving.</p>}</div>
    <label className="inline-label"><input type="checkbox" checked={autoSequence} onChange={e=>{setAutoSequence(e.target.checked);if(e.target.checked)setRows(old=>suggestFollowingSteps(semester,old));}}/>Use the first step’s schedule for later weeks</label>
    <p className="hint">Only untouched new steps are filled. Teaching breaks are skipped; check suggestions before saving.</p>
    {!editing&&<button aria-expanded={template} onClick={()=>{if(!first){const week=rows[0]?.week||(rows[0]?.date?weekFor(rows[0].date,semester.weeks):task.week);if(week)setFirst(String(week));}setTemplate(!template);}}>Repeat demos / submissions…</button>}
    {template && <section className="batch-settings">
      <div className="field-pair"><label>Number of rounds<input type="number" min={1} max={15} value={sprints} onChange={e=>setSprints(e.target.value)}/></label><label>First week<select value={first} onChange={e=>setFirst(e.target.value)}>{weekOptions}</select></label></div>
      <label>Name prefix<input value={roundLabel} placeholder="Part, Demo, Sprint…" onChange={e=>setRoundLabel(e.target.value)}/></label>
      <label className="inline-label"><input type="checkbox" checked={includeDemo} onChange={e=>setIncludeDemo(e.target.checked)}/>Demo in tutorial</label>
      <label className="inline-label"><input type="checkbox" checked={includeSubmission} onChange={e=>setIncludeSubmission(e.target.checked)}/>Submission</label>
      {includeSubmission&&<div className="field-pair"><label>Submission day<select value={submissionDay} onChange={e=>setSubmissionDay(e.target.value)}>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label><label>Time · Sydney<input type="time" value={submissionTime} onInput={e=>setSubmissionTime(e.currentTarget.value)}/></label></div>}
      <p className="hint">Include only requirements belonging to this assessment. Review every step below; dates are editable and no marks are assumed.</p>
      <p className="hint">Sunday 23:59 is a starting suggestion, not an official deadline.</p>
      <button disabled={!first||!includeDemo&&!includeSubmission} onClick={()=>{try{const next=repeatedAssessmentSteps(semester,Number(sprints),Number(first),{demo:includeDemo,submission:includeSubmission,label:roundLabel,day:Number(submissionDay),time:submissionTime});const apply=()=>{setRows(next);setError("");setTemplate(false);};if(dirty)setConfirmation({title:"Replace draft steps?",description:"This pattern will replace the step names and schedules in your current unsaved draft.",action:"Replace draft",run:apply});else apply();}catch(e){setError((e as Error).message);}}}>{dirty?"Replace draft with pattern":"Apply pattern"}</button>
    </section>}
    <div className="assessment-step-list">{rows.map((row,i)=>{
      let summary="";try{summary=timingLabel({...task,date:undefined,time:undefined,week:undefined,endTime:undefined,...stepTiming(semester,task.unit,row)});}catch{}
      const classes=tutorialChoices(semester,task.unit,row.week);
      return <details className="assessment-step" key={row.id||i} open={openRows.includes(i)} onToggle={e=>{const opened=e.currentTarget.open;setOpenRows(old=>old.includes(i)===opened?old:opened?[...old,i]:old.filter(n=>n!==i));}}>
        <summary><strong>{row.title||`Step ${i+1}`}{existing.find(t=>t.id===row.id)?.done?" · Completed":""}</strong><span>{row.mode==="unknown"?"Schedule not confirmed":row.mode==="week"?`W${row.week||"?"} · day & time unconfirmed`:row.mode==="tutorial"&&!row.date&&classes.length!==1&&!row.classId?`W${row.week||"?"} · tutorial unconfirmed`:row.mode==="date"&&!row.date?"Due date not set":summary||"Choose schedule"}{row.autoFilled&&row.mode!=="unknown"?" · Suggested":""}</span></summary>
        <div className="step-fields">
        <div className="step-title"><label>Step {i+1}<input aria-label={`Step ${i+1} name`} value={row.title} onChange={e=>update(i,{title:e.target.value})}/></label><button className="step-remove" aria-label={`Remove step ${i+1}`} disabled={rows.length<=1} onClick={()=>{setRows(old=>old.filter((_,j)=>j!==i));setOpenRows(old=>old.filter(n=>n!==i).map(n=>n>i?n-1:n));}}>Remove</button></div>
        <label>When<select aria-label={`Step ${i+1} schedule`} value={row.mode} onChange={e=>update(i,{mode:e.target.value as AssessmentStep["mode"],date:undefined,time:undefined,classId:undefined})}><option value="unknown">Not known yet</option><option value="week">Teaching week only</option><option value="tutorial">In my tutorial</option><option value="date">Exact deadline</option></select></label>
        {(row.mode==="week"||row.mode==="tutorial") && <label>Teaching week<select aria-label={`Step ${i+1} week`} value={row.week||""} onChange={e=>update(i,{week:Number(e.target.value)||undefined,classId:undefined})}>{weekOptions}</select></label>}
        {row.mode==="tutorial" && row.week && <>{classes.length>1 && <label>Tutorial<select aria-label={`Step ${i+1} tutorial`} value={row.classId||""} onChange={e=>update(i,{classId:e.target.value||undefined})}><option value="">Not confirmed yet</option>{classes.map(c=><option key={c.id} value={c.id}>{shortDate(c.date)} · {c.time}–{c.end}</option>)}</select></label>}<p className="hint">{classes.length===1||row.classId?`${summary} · from your imported timetable. Check again if your timetable changes.`:"No unique tutorial selected. This step stays in the week with its date/time unconfirmed."}</p></>}
        {row.mode==="date" && <><div className="field-pair"><label>Due date<input aria-label={`Step ${i+1} due date`} type="date" value={row.date||""} onInput={e=>update(i,{date:e.currentTarget.value||undefined,week:undefined,time:e.currentTarget.value?row.time||"23:59":undefined})}/></label><label>Time · Sydney<input aria-label={`Step ${i+1} time`} type="time" value={row.time||""} onInput={e=>update(i,{time:e.currentTarget.value||undefined})}/></label></div><small>23:59 is suggested for a new date. Change or clear it if needed.</small></>}
        <details><summary>Weight · {row.weight?`${row.weight}%`:"not specified"}</summary><label>Course weight (%)<input aria-label={`Step ${i+1} weight`} type="number" min={0} max={100} step="any" value={row.weight||""} placeholder="Unknown" onChange={e=>update(i,{weight:e.target.value})}/></label><small>Optional. Canvas points are not course percentages.</small></details>
        </div>
      </details>;
    })}</div>
    <div className="assessment-actions"><button disabled={rows.length>=30} onClick={()=>{setOpenRows([rows.length]);setRows(old=>[...old,submissionStep()]);setError("");}}>+ Add submission deadline</button><button disabled={rows.length>=30} onClick={()=>{setOpenRows([rows.length]);addStep(true);}}>+ Add demo</button><button disabled={rows.length>=30} onClick={()=>{setOpenRows([rows.length]);addStep();}}>+ Add step</button></div>
    <p className="hint">{rows.length} independent checkmarks · parent total stays {task.weight||"unchanged"}. Blank weights are unknown, not zero.</p>
    {!!removed.length&&<p className="notice">Will remove: {removed.map(t=>t.title).join(" · ")}. Changes apply only when saved.</p>}
    {(error||validation)&&<p className={error?"error":"hint"} role={error?"alert":"status"}>{error||validation}</p>}
    <div className="schedule-actions"><button onClick={cancel}>Cancel</button><button className="primary" disabled={!!validation||(editing&&!dirty)} onClick={save}>{editing?"Save step changes":`Create ${rows.length} steps`}</button></div>
  </section>;
}
