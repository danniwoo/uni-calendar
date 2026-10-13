"use client";
import {useState} from "react";
import {addDays,shortDate,weekFor,type Semester,type Task} from "@/lib/semester";
import {fillEmptySchedules,splitAssessment,type PartSchedule} from "@/lib/split-assessment";

export function FlexibleSubmissions({task,semester,onSave,onCancel}:{task:Task;semester:Semester;onSave:(s:Semester)=>void;onCancel:()=>void}) {
  const initialCount=task.rules?.count || 5;
  const [countText,setCount]=useState(String(initialCount)),[weight,setWeight]=useState(String(task.rules?.perOccurrence ?? (parseFloat(task.weight)/initialCount || 0))),[label,setLabel]=useState(/report|portfolio|journal/i.test(task.title)?"Report":task.title);
  const [rows,setRows]=useState<PartSchedule[]>(Array.from({length:30},()=>({}))),[active,setActive]=useState<number|null>(null),[modes,setModes]=useState<Record<number,string>>({});
  const [batch,setBatch]=useState(false),[method,setMethod]=useState("pattern"),[first,setFirst]=useState(""),[interval,setInterval]=useState("2"),[selected,setSelected]=useState<number[]>([]),[day,setDay]=useState(""),[time,setTime]=useState("23:59"),[replace,setReplace]=useState(false),[message,setMessage]=useState("");
  const count=Number(countText), bounded=Math.min(30,Math.max(0,count || 0)), schedules=rows.slice(0,bounded);
  const plan={count,weight:Number(weight),label,weeks:schedules.map(r=>r.week),schedules};
  let validation="";try{splitAssessment(semester,task,plan);}catch(e){validation=(e as Error).message;}
  const teaching=semester.weeks.filter(w=>w.kind==="teaching");
  function update(i:number,value:PartSchedule){setRows(old=>old.map((r,j)=>j===i?value:r));setMessage("");}
  function applyBatch(){
    const weeks=method==="selected"?[...selected].sort((a,b)=>a-b):Array.from({length:bounded},(_,i)=>Number(first)+i*Number(interval));
    const incoming=schedules.map((_,i):PartSchedule=>{const w=teaching.find(w=>w.number===weeks[i]);if(!w)return {};return day===""?{week:w.number}:{week:w.number,date:addDays(w.start,Number(day)),time:time||undefined};});
    const next=fillEmptySchedules(schedules,incoming,replace);
    const changed=next.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(schedules[i])).length;
    setRows(old=>[...next,...old.slice(bounded)]);setModes({});setMessage(`${changed} parts updated. ${replace?"All parts were replaced.":"Existing entries kept."}`);setBatch(false);setReplace(false);
  }
  return <section className="schedule-editor flexible-editor">
    <p className="design-caption">A · Individual deadlines <span>No repeating pattern required</span></p>
    <details className="schedule-settings"><summary>{countText || "?"} parts × {weight || "?"}% · {task.weight} total <span>Edit</span></summary><div className="field-pair"><label>Number of parts<input type="number" min={2} max={30} value={countText} onChange={e=>setCount(e.target.value)}/></label><label>Weight each (%)<input type="number" min={0} step="0.1" value={weight} onChange={e=>setWeight(e.target.value)}/></label></div><label>Part name<input value={label} onChange={e=>setLabel(e.target.value)}/></label></details>
    <div className="flexible-intro"><p>Fill what you know. You can leave the rest for later.</p><button aria-expanded={batch} onClick={()=>setBatch(!batch)}>Batch fill…</button></div>
    {batch && <section className="batch-settings"><strong>Quick fill · optional</strong><div className="task-mode"><button aria-pressed={method==="pattern"} onClick={()=>setMethod("pattern")}>Regular interval</button><button aria-pressed={method==="selected"} onClick={()=>setMethod("selected")}>Choose weeks</button></div>
      {method==="pattern"?<div className="field-pair"><label>First week<select value={first} onChange={e=>setFirst(e.target.value)}><option value="">Choose</option>{teaching.map(w=><option key={w.id} value={w.number}>W{w.number}</option>)}</select></label><label>Repeat<select value={interval} onChange={e=>setInterval(e.target.value)}>{[1,2,3].map(n=><option key={n} value={n}>Every {n} teaching week{n>1?"s":""}</option>)}</select></label></div>:<><div className="batch-week-chips">{teaching.map(w=><button key={w.id} aria-pressed={selected.includes(w.number!)} onClick={()=>setSelected(old=>old.includes(w.number!)?old.filter(n=>n!==w.number):[...old,w.number!])}>W{w.number}</button>)}</div><small>{selected.length}/{count} weeks selected · earliest week goes to Part 1</small></>}
      <div className="field-pair"><label>Shared day<select value={day} onChange={e=>setDay(e.target.value)}><option value="">Week only</option>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>{day!=="" && <label>Time · Sydney<input type="time" value={time} onChange={e=>setTime(e.target.value)}/><small>23:59 suggested</small></label>}</div>
      <label>Apply to<select value={replace?"all":"empty"} onChange={e=>setReplace(e.target.value==="all")}><option value="empty">Empty parts only · keep my entries</option><option value="all">Replace all part deadlines</option></select></label>
      <small>Teaching breaks are skipped. {replace?"This replaces all dates in the draft, including manual entries.":"Parts with an existing week or date stay untouched."}</small>
      <button disabled={!bounded || (method==="pattern"?!first:selected.length===0 || selected.length>bounded)} onClick={applyBatch}>Apply to draft</button>
    </section>}
    {message && <p className="hint" role="status">{message}</p>}
    <div className="flexible-rows">{schedules.map((r,i)=>{const mode=modes[i] || (r.date?"date":r.week?"week":"unknown");const summary=r.date?`${r.week?`W${r.week} · `:""}${shortDate(r.date)} · ${r.time || "Time TBC"}`:r.week?`W${r.week} · Day & time TBC`:"Not set";return <section className="flexible-part" key={i}>
      <button className="part-heading" aria-expanded={active===i} onClick={()=>setActive(active===i?null:i)}><strong>{label || "Part"} {i+1}</strong><span>{summary}</span><small>{active===i?"Close":"Edit"}</small></button>
      {active===i && <div className="part-fields"><label>Deadline known<select value={mode} onChange={e=>{const m=e.target.value;setModes(old=>({...old,[i]:m}));if(m==="unknown")update(i,{});else if(m==="week")update(i,{week:r.week});else update(i,{week:r.week});}}><option value="unknown">Not yet</option><option value="week">Teaching week only</option><option value="date">Exact date</option></select></label>
        {mode==="week" && <label>Teaching week<select value={r.week || ""} onChange={e=>update(i,{week:e.target.value?Number(e.target.value):undefined})}><option value="">Not set</option>{teaching.map(w=><option key={w.id} value={w.number}>W{w.number}</option>)}</select></label>}
        {mode==="date" && <div className="field-pair"><label>Due date<input type="date" min={semester.weeks[0].start} max={semester.weeks[semester.weeks.length-1].end} value={r.date || ""} onChange={e=>update(i,e.target.value?{date:e.target.value,week:weekFor(e.target.value,semester.weeks),time:r.time ?? "23:59"}:{})}/></label><label>Time · Sydney<input type="time" disabled={!r.date} value={r.time || ""} onChange={e=>update(i,{...r,time:e.target.value || undefined})}/><small>23:59 suggested · editable</small></label></div>}
      </div>}
    </section>;})}</div>
    <p className="hint">{schedules.filter(r=>r.date).length} dated · {schedules.filter(r=>r.week&&!r.date).length} week only · {schedules.filter(r=>!r.week&&!r.date).length} not set. Each part is tracked separately.</p>
    {validation && <p role="alert" className="error">{validation}</p>}
    <div className="schedule-actions"><button onClick={onCancel}>Cancel</button><button className="primary" disabled={!!validation} onClick={()=>onSave(splitAssessment(semester,task,plan))}>Create {countText} submissions</button></div>
  </section>;
}
