"use client";
import { useState } from "react";
import { splitAssessment } from "@/lib/split-assessment";
import { type Semester, type Task, timingLabel } from "@/lib/semester";

export function SplitAssessment({task,semester,onSave,onOpen,onModeChange,recurring=false,onCancel}:{task:Task;semester:Semester;onSave:(next:Semester)=>void;onOpen:(t:Task)=>void;onModeChange?:(open:boolean)=>void;recurring?:boolean;onCancel?:()=>void}) {
  const children=semester.tasks.filter(t=>t.parentId===task.id || t.series===task.id);
  const [open,setOpen]=useState(recurring),[countText,setCount]=useState(String(task.rules?.count || 5)),[weight,setWeight]=useState(String(task.rules?.perOccurrence ?? (parseFloat(task.weight)/5 || 0))),[label,setLabel]=useState(recurring?"":/report|portfolio|journal/i.test(task.title)?"Report":task.title),[unit,setUnit]=useState(task.unit),[first,setFirst]=useState(""),[last,setLast]=useState("13"),[interval,setInterval]=useState(recurring?1:2),[overrides,setOverrides]=useState<Record<number,string>>({}),[day,setDay]=useState(""),[time,setTime]=useState("23:59"),[error,setError]=useState("");
  if (task.parentId || task.series) return null;
  if (children.length) return <section className="split-editor"><strong>{children.filter(t=>t.done).length}/{children.length} completed</strong><div className="series-occurrences">{children.map(t=><button key={t.id} onClick={()=>onOpen(t)}>{t.title} · {t.weight} · {t.week?`W${t.week} · `:""}{timingLabel(t)}</button>)}</div></section>;
  const count=recurring ? first && Number(last)>=Number(first) ? Math.floor((Number(last)-Number(first))/interval)+1 : 0 : Number(countText);
  const weeks=Array.from({length:Math.min(30,Math.max(0,count))},(_,i)=>{const value=overrides[i] ?? (first && Number(first)+i*interval<=13?String(Number(first)+i*interval):"");return value?Number(value):undefined;});
  const parent=recurring?{...task,title:label.trim(),unit,weight:""}:task;
  const plan={count,weight:recurring?0:Number(weight),label,weeks,weekday:day===""?undefined:Number(day),time:day===""?undefined:time||undefined,routine:recurring};
  let preview:Task[]=[];let validation="";
  try {preview=splitAssessment(semester,parent,plan).tasks.filter(t=>t.parentId===task.id);} catch(e) {validation=(e as Error).message;}
  const weekOptions=<><option value="">Not known yet</option>{semester.weeks.filter(w=>w.number).map(w=><option key={w.id} value={w.number}>W{w.number}</option>)}</>;
  function close(){setOpen(false);onModeChange?.(false);onCancel?.();}
  if(!open) return <button onClick={()=>{setOpen(true);onModeChange?.(true);}}>Split into multiple submissions</button>;
  return <section className="schedule-editor">
    {recurring ? <div className="field-pair"><label>Task name<input placeholder="e.g. Weekly reading" value={label} onChange={e=>setLabel(e.target.value)}/></label><label>Unit<select value={unit} onChange={e=>setUnit(e.target.value)}>{semester.units.map(u=><option key={u.code}>{u.code}</option>)}</select></label></div> : <details className="schedule-settings"><summary>{countText || "?"} parts × {weight || "?"}% · {task.weight} total <span>Edit</span></summary><div className="field-pair"><label>Number of parts<input type="number" min={2} max={30} value={countText} onChange={e=>setCount(e.target.value)}/></label><label>Weight each (%)<input type="number" min={0} step="0.1" value={weight} onChange={e=>setWeight(e.target.value)}/></label></div><label>Part name<input value={label} onChange={e=>setLabel(e.target.value)}/></label></details>}
    <div className="field-pair"><label>First week<select value={first} onChange={e=>{setFirst(e.target.value);setOverrides({});}}>{weekOptions}</select></label><label>Repeat<select value={interval} onChange={e=>{setInterval(Number(e.target.value));setOverrides({});}}><option value={1}>Every teaching week</option><option value={2}>Every 2 teaching weeks</option><option value={3}>Every 3 teaching weeks</option></select></label></div>
    {recurring && <label>Last week<select value={last} onChange={e=>{setLast(e.target.value);setOverrides({});}}>{semester.weeks.filter(w=>w.number).map(w=><option key={w.id} value={w.number}>W{w.number}</option>)}</select></label>}
    <div className="field-pair"><label>Due day · all occurrences<select value={day} onChange={e=>setDay(e.target.value)}><option value="">Week only / unknown</option>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>{day!=="" && <label>Time · Sydney<input type="time" value={time} onChange={e=>setTime(e.target.value)}/><small>23:59 suggested — change if needed.</small></label>}</div>
    <p className="hint">Teaching breaks are skipped. Adjust individual weeks below.</p>
    <div className="schedule-rows">{weeks.map((w,i)=> <div className="schedule-row" key={i}><span>{recurring ? `Occurrence ${i+1}` : `${label || "Part"} ${i+1}`}</span><select aria-label={`Part ${i+1} week`} value={w || ""} onChange={e=>setOverrides(old=>({...old,[i]:e.target.value}))}>{weekOptions}</select><small>{preview[i] ? timingLabel(preview[i]) : "Date not set"}</small></div>)}</div>
    {!recurring && <p className="hint">Each part has its own completion checkbox. The original {task.weight} remains the total.</p>}
    {(error || (validation && (!recurring || !!first && !!label))) && <p role="alert" className="error">{error || validation}</p>}
    <div className="schedule-actions"><button onClick={close}>Cancel</button><button className="primary" disabled={!!validation} onClick={()=>{try{onSave(splitAssessment(semester,parent,plan));onModeChange?.(false);}catch(e){setError((e as Error).message);}}}>Create {count || ""} {recurring?"tasks":"submissions"}</button></div>
  </section>;
}
