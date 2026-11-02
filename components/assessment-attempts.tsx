"use client";
import {useState} from "react";
import type {GradePlan,Semester,Task} from "@/lib/semester";
import {attemptPlan,attemptSchedules,attemptLabel,newAttemptTask,type AttemptSchedule} from "@/lib/assessment-attempts";
import {assessmentTiming} from "@/lib/assessment-schedule";
import {partGrade} from "@/lib/grades";
import {gradeNumber,validGradePlan} from "@/lib/grade-value";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "./ui/sheet";
import {TaskTimingEditor} from "./task-timing-editor";
import {ReminderEditor} from "./reminder-editor";
import {AssessmentConfirm} from "./assessment-confirm";

export function AssessmentAttempts({semester,task,onSave,onClose}:{semester:Semester;task:Task;onSave:(plan:GradePlan,rows:AttemptSchedule[],expected:Semester)=>void;onClose:()=>void}){
  const [initial]=useState(()=>({semester,plan:attemptPlan(semester,task)}));
  const [plan,setPlan]=useState(initial.plan),[rows,setRows]=useState(()=>attemptSchedules(semester,task,initial.plan));
  const [open,setOpen]=useState<string|null>(null),[discard,setDiscard]=useState(false),[error,setError]=useState("");
  const [scores,setScores]=useState(()=>initial.plan.items.map(i=>({id:i.id,earned:i.grade?String(i.grade.earned):"",maximum:String(i.grade?.possible||i.maximum||"")})));
  const initialRows=attemptSchedules(initial.semester,task,initial.plan);
  const dirty=JSON.stringify(plan)!==JSON.stringify(initial.plan)||JSON.stringify(rows)!==JSON.stringify(initialRows)||scores.some(s=>{const i=initial.plan.items.find(i=>i.id===s.id);return s.earned!==(i?.grade?String(i.grade.earned):"")||s.maximum!==String(i?.grade?.possible||i?.maximum||"");});
  const draft:GradePlan={...plan,items:plan.items.map(i=>{const score=scores.find(s=>s.id===i.id)!;if(score.earned===(i.grade?String(i.grade.earned):"")&&score.maximum===String(i.grade?.possible||i.maximum||""))return i;return {...i,maximum:score.maximum.trim()?Number(score.maximum):undefined,grade:score.earned.trim()?{earned:Number(score.earned),possible:Number(score.maximum)}:i.grade==null?i.grade:null};})};
  const invalid=!validGradePlan(draft)||scores.some(s=>s.earned.trim()&&!s.maximum.trim());
  const result=!invalid&&plan.method==="highest"?partGrade(draft):null;
  const schedules=initial.semester.tasks.filter(t=>t.parentId===task.id&&!t.series);
  const options=[...(!task.splitCount&&(task.date||task.week)?[task]:[]),...schedules.filter(t=>t.attemptId||!t.weight&&!t.grade&&!t.gradePlan)];
  const retained=[...(!task.splitCount&&(task.date||task.week)?[task]:[]),...schedules].filter(t=>!rows.some(r=>r.existingId===t.id));
  function close(){if(dirty)setDiscard(true);else onClose();}
  function changeSchedule(itemId:string,value:Task){setRows(rows=>rows.map(r=>r.itemId===itemId?{...r,task:value}:r));setError("");}
  function pick(itemId:string,value:string,index:number){const existing=options.find(t=>t.id===value);setRows(rows=>rows.map(r=>r.itemId===itemId?{itemId,...(existing?{existingId:existing.id,task:{...structuredClone(existing),attemptId:itemId}}:value==="new"?{task:{...newAttemptTask(task,index),attemptId:itemId}}:{})}:r));setError("");}
  function add(){const id=crypto.randomUUID(),max=scores[0]?.maximum||"";setPlan(p=>({...p,items:[...p.items,{id,name:`Attempt ${p.items.length+1}`}]}));setRows(r=>[...r,{itemId:id}]);setScores(s=>[...s,{id,earned:"",maximum:max}]);setError("");}
  return <Sheet open onOpenChange={v=>{if(!v)close();}}><SheetContent className="detail-panel attempts-panel">
    <SheetHeader><SheetTitle>{task.title} · Attempts</SheetTitle><SheetDescription>{task.unit} · {task.weight||"Weight not set"} for the whole assessment, counted once</SheetDescription></SheetHeader>
    {discard&&<AssessmentConfirm title="Discard attempt changes?" description="Saved schedules, reminders and results stay unchanged." action="Discard changes" onCancel={()=>setDiscard(false)} onConfirm={onClose}/>}
    <div className="attempts-body">
      {plan.method!=="highest"||plan.mode!=="parts"?<div className="attempts-setup"><strong>How do these attempts count?</strong><p>This editor is for retakes of the same assessment, not separate graded parts.</p><button className="primary" onClick={()=>setPlan(p=>({...p,mode:"parts",method:"highest"}))}>Use highest attempt</button>{task.grade&&<small>Your reported overall result is kept; saving switches to the individual attempts below.</small>}</div>:<div className="attempts-rule"><strong>Highest of {plan.items.filter(i=>!i.excluded).length} attempts</strong><span>Each attempt keeps its own time and score.</span></div>}
      {plan.items.map((item,index)=>{const row=rows.find(r=>r.itemId===item.id)!,score=scores.find(s=>s.id===item.id)!,expanded=open===item.id,bound=initialRows.find(r=>r.itemId===item.id)?.existingId;
        const linked=item.id.startsWith("canvas:")||semester.canvasImports?.some(r=>r.targetId===task.id&&r.attemptItemId===item.id);
        return <section key={item.id} className="attempt-card" aria-label={attemptLabel(item,index)}>
          <div className="attempt-card-heading"><strong>{attemptLabel(item,index)}</strong><span>{item.excluded?"Excluded from result":item.outcome==="not_taken"?"Not taken · no zero":linked?"Canvas-linked result":""}</span></div>
          {item.id.startsWith("canvas:")&&<details className="attempt-source"><summary>Canvas item</summary><p>{item.name}</p></details>}
          <div className="attempt-main-row"><div><span className="attempt-label">When</span><button type="button" className="attempt-time" aria-expanded={expanded} onClick={()=>setOpen(expanded?null:item.id)}>{row.task?`${assessmentTiming(row.task)} · Edit`:"+ Set time / choose existing schedule"}</button></div>
            <div className="attempt-score"><label>Score<input aria-label={`Attempt ${index+1} score`} type="number" min="0" step="any" placeholder="Not graded" value={score.earned} onInput={e=>{const value=e.currentTarget.value;setScores(s=>s.map(x=>x.id===item.id?{...x,earned:value}:x));}}/></label><span>/</span><label>Out of<input aria-label={`Attempt ${index+1} maximum`} type="number" min="0" step="any" placeholder="Marks" value={score.maximum} onInput={e=>{const value=e.currentTarget.value;setScores(s=>s.map(x=>x.id===item.id?{...x,maximum:value}:x));}}/></label></div>
          </div>
          {expanded&&<div className="attempt-time-editor">
            {!bound&&<label>Schedule for Attempt {index+1}<select aria-label={`Schedule for Attempt ${index+1}`} value={row.existingId||(row.task?"new":"")} onChange={e=>pick(item.id,e.target.value,index)}><option value="">Not scheduled</option><option value="new">New time…</option>{options.filter(t=>!t.attemptId||t.attemptId===item.id).map(t=><option key={t.id} value={t.id} disabled={rows.some(r=>r.itemId!==item.id&&r.existingId===t.id)}>{t.id===task.id?"Current assessment time":t.title} · {assessmentTiming(t)}</option>)}</select></label>}
            {row.task&&<><TaskTimingEditor task={row.task} semester={semester} onChange={t=>changeSchedule(item.id,t)} purpose="attempt"/><ReminderEditor task={row.task} onChange={t=>changeSchedule(item.id,t)}/><small>One schedule in Semester, Week and Month. No extra assessment weight.</small></>}
            <button type="button" onClick={()=>setOpen(null)}>Done editing time</button>
          </div>}
        </section>;
      })}
      <button type="button" disabled={plan.items.length>=30} onClick={add}>+ Add another attempt</button>
      <div className="attempt-total" aria-live="polite"><span>Assessment result · highest attempt</span><strong>{result?.earned!=null?`${gradeNumber(result.earned)} / ${gradeNumber(result.possible!)}`:"No result yet"}</strong><small>{result?`${result.recorded} / ${result.total} attempts graded${result.finished?"":" · not final"}`:"Confirm the rule and check the marks."} · Blank is not zero.</small></div>
      {retained.length>0&&<details className="attempt-source"><summary>Other existing schedules · kept ({retained.length})</summary>{retained.map(t=><p key={t.id}>{t.id===task.id?"Current assessment time":t.title} · {assessmentTiming(t)}</p>)}</details>}
      {error&&<p role="alert" className="error">{error}</p>}
      <div className="attempt-actions"><button type="button" onClick={close}>Cancel</button><button type="button" className="primary" disabled={invalid||plan.method!=="highest"||plan.mode!=="parts"} onClick={()=>{try{onSave(draft,rows,initial.semester);}catch(e){setError((e as Error).message);}}}>Save attempts</button></div>
    </div>
  </SheetContent></Sheet>;
}
