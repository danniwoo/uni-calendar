"use client";
import {useState} from "react";
import {shortDate, weekFor, type Semester, type Task} from "@/lib/semester";
import {dateInputPatch} from "@/lib/assessment-schedule";
import {classKind, classKinds, classTimingPatch, deadlineTimingPatch, taskClassChoices} from "@/lib/task-timing";

export function TaskTimingEditor({task,semester,onChange}:{task:Task;semester:Semester;onChange:(t:Task)=>void}) {
  const [mode,setMode]=useState(task.timeBasis==="class" || (!task.date&&task.week) ? "class" : "date");
  const [kind,setKind]=useState(task.timeBasis==="class" ? classKinds.find(k=>new RegExp(k==="Lab"?"lab|practical":k,"i").test(task.timing)) || "" : "");
  const [error,setError]=useState("");
  const kinds=[...new Set([...classKinds,...semester.classes.filter(c=>c.unit===task.unit).map(c=>classKind(c.activity))])];
  const choices=taskClassChoices(semester,task.unit,task.week,kind);
  const selected=choices.find(c=>c.date===task.date&&c.time===task.time&&c.end===task.endTime);
  const pick=(week:number|undefined,nextKind:string,id?:string)=>{try{onChange({...task,...classTimingPatch(semester,task.unit,week,nextKind,id)});setError("");}catch(e){onChange({...task,week,dueWeek:undefined,date:undefined,time:undefined,endTime:undefined,timeBasis:"class",timing:`During ${nextKind.toLowerCase()||"class"} · date/time unconfirmed`});setError((e as Error).message);}};
  return <section className="task-timing-editor" aria-label="When">
    <strong>When</strong>
    <div className="task-mode" role="group" aria-label="Schedule by">
      <button type="button" aria-pressed={mode==="date"} onClick={()=>{if(mode==="date")return;setMode("date");setError("");onChange({...task,...deadlineTimingPatch(task)});}}>Date &amp; time</button>
      <button type="button" aria-pressed={mode==="class"} onClick={()=>{if(mode==="class")return;setMode("class");pick(semester.weeks.some(w=>w.kind==="teaching"&&w.number===task.week)?task.week:undefined,kind);}}>Week &amp; class</button>
    </div>
    {mode==="date"?<>
      <div className="field-pair"><label>Due date<input type="date" value={task.date||""} onInput={e=>onChange({...task,...deadlineTimingPatch(task),...dateInputPatch(task,"date",e.currentTarget.value),week:e.currentTarget.value?weekFor(e.currentTarget.value,semester.weeks):task.week})}/></label>
      <label>Due time · Sydney<input type="time" value={task.time||""} onInput={e=>onChange({...task,...deadlineTimingPatch(task),time:e.currentTarget.value||undefined})}/></label></div>
      {!task.date&&<small>Date not confirmed? Choose Week &amp; class to keep it visible in that week.</small>}
    </>:<>
      <div className="field-pair"><label>Teaching week<select aria-label="Teaching week" value={task.week||""} onChange={e=>pick(Number(e.target.value)||undefined,kind)}><option value="">Choose week…</option>{semester.weeks.filter(w=>w.kind==="teaching").map(w=><option key={w.id} value={w.number}>Week {w.number}</option>)}</select></label>
      <label>Class<select aria-label="Class" value={kind} onChange={e=>{setKind(e.target.value);pick(task.week,e.target.value);}}><option value="">Not known yet</option>{kinds.map(k=><option key={k}>{k}</option>)}</select></label></div>
      {choices.length>1&&<label>Choose your class<select aria-label="Choose your class" value={selected?.id||""} onChange={e=>pick(task.week,kind,e.target.value||undefined)}><option value="">{choices.length} classes — choose one…</option>{choices.map(c=><option key={c.id} value={c.id}>{shortDate(c.date)} · {c.time}–{c.end}{c.location?` · ${c.location}`:""}</option>)}</select></label>}
      <div className="task-time-preview" role="status">{task.date?<><strong>Week {task.week} · {kind||"Class"}</strong><span>{shortDate(task.date)} · {task.time}{task.endTime?`–${task.endTime}`:""} Sydney</span><small>From your timetable · saved when you save details.</small></>:<span>{!task.week?"Choose a week.":!kind?`Week ${task.week} · day & time TBC`:choices.length>1?"Choose a class to set the date and time.":`No ${kind.toLowerCase()} found in Week ${task.week}. The week stays visible; no date is guessed.`}</span>}</div>
    </>}
    {error&&<p role="alert" className="error">{error}</p>}
  </section>;
}
