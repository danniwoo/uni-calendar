"use client";
import { useState } from "react";
import { splitAssessment } from "@/lib/split-assessment";
import { type Semester, type Task, timingLabel } from "@/lib/semester";

export function SplitAssessment({task,semester,onSave,onOpen}:{task:Task;semester:Semester;onSave:(next:Semester)=>void;onOpen:(t:Task)=>void}) {
  const children=semester.tasks.filter(t=>t.parentId===task.id || t.series===task.id);
  const [open,setOpen]=useState(false),[count,setCount]=useState(task.rules?.count || 5),[weight,setWeight]=useState(String(task.rules?.perOccurrence ?? (parseFloat(task.weight)/5 || 0))),[label,setLabel]=useState(/report|portfolio|journal/i.test(task.title)?"Report":task.title),[weeks,setWeeks]=useState<string[]>(Array(30).fill("")),[day,setDay]=useState(""),[time,setTime]=useState(""),[midnight,setMidnight]=useState(false),[interval,setInterval]=useState(2),[error,setError]=useState("");
  if (task.parentId || task.series) return null;
  if (children.length) return <section className="split-editor"><strong>{children.filter(t=>t.done).length}/{children.length} completed · {children.filter(t=>!t.week&&!t.date).length} need weeks</strong><div className="series-occurrences">{children.map(t=><button key={t.id} onClick={()=>onOpen(t)}>{t.title} · {t.weight} · {t.week?`W${t.week} · `:""}{timingLabel(t)}</button>)}</div></section>;
  const boundedCount=Math.min(30,Math.max(2,count || 2));
  const plan={count,weight:Number(weight),label,weeks:Array.from({length:boundedCount},(_,i)=>weeks[i]?Number(weeks[i]):undefined),weekday:day===""?undefined:Number(day),time:day===""?undefined:midnight?"24:00":time||undefined};
  let preview:Task[]=[];let validation="";
  try {preview=splitAssessment(semester,task,plan).tasks.filter(t=>t.parentId===task.id);} catch(e) {validation=(e as Error).message;}
  return <section className="split-editor"><button aria-expanded={open} onClick={()=>setOpen(!open)}>Split into multiple submissions</button>{open && <>
    <p>Keep {task.title} ({task.weight}) as the total; track each submission separately.</p>
    <div className="field-pair"><label>Number of parts<input type="number" min={2} max={30} value={count} onChange={e=>setCount(Number(e.target.value))}/></label><label>Weight per part (%)<input type="number" min={0} step="0.1" value={weight} onChange={e=>setWeight(e.target.value)}/></label></div>
    <label>Part name<input value={label} onChange={e=>setLabel(e.target.value)}/></label>
    <p className="hint">{count} × {weight || "?"}% = {Number((count*Number(weight)).toFixed(2))}% · original total {task.weight}</p>
    <div className="split-pattern"><label>Repeat every <select value={interval} onChange={e=>setInterval(Number(e.target.value))}><option value={1}>1 teaching week</option><option value={2}>2 teaching weeks</option><option value={3}>3 teaching weeks</option></select></label><button disabled={!weeks[0]} onClick={()=>setWeeks(old=>Array.from({length:30},(_,i)=>i<boundedCount && Number(old[0])+i*interval<=13?String(Number(old[0])+i*interval):""))}>Fill from first week</button></div>
    <div className="split-weeks">{Array.from({length:boundedCount},(_,i)=><label key={i}>{label || "Part"} {i+1}<select aria-label={`Part ${i+1} week`} value={weeks[i] || ""} onChange={e=>setWeeks(old=>old.map((v,j)=>i===j?e.target.value:v))}><option value="">Not known yet</option>{semester.weeks.filter(w=>w.number).map(w=><option key={w.id} value={w.number}>Week {w.number}</option>)}</select></label>)}</div>
    <label>Shared deadline day<select value={day} onChange={e=>setDay(e.target.value)}><option value="">Week only / not known</option>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>
    {day!=="" && <><label>Time (Sydney)<input type="time" disabled={midnight} value={time} onChange={e=>setTime(e.target.value)}/></label><label className="inline-label"><input type="checkbox" checked={midnight} onChange={e=>setMidnight(e.target.checked)}/>End of selected day (next day 00:00)</label></>}
    <p className="hint">Review the dates below against Ed / Canvas. Breaks are skipped when counting teaching weeks. Unknown parts stay in Needs details.</p>
    <div className="split-preview">{preview.map(t=><p key={t.id}><strong>{t.title} · {t.weight}</strong><span>{t.week?`W${t.week} · `:""}{timingLabel(t)}</span></p>)}</div>
    {(error || validation) && <p role="alert" className="error">{error || validation}</p>}
    <button className="primary" disabled={!!validation} onClick={()=>{try{onSave(splitAssessment(semester,task,plan));}catch(e){setError((e as Error).message);}}}>Create {count} submissions</button>
  </>}</section>;
}
