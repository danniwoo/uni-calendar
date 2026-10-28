"use client";
import type {Task} from "@/lib/semester";
import type {CompletedMode} from "@/lib/month-calendar";

// A known teaching week is useful scheduling information, not a guessed day.
export function CalendarWeekItems({tasks,week,mode,onOpen,onSchedule,onToggle}:{tasks:Task[];week?:number;mode:CompletedMode;onOpen:(t:Task)=>void;onSchedule:(t:Task)=>void;onToggle:(t:Task)=>void}){
  const visible=tasks.filter(t=>mode==="show"||!t.done),completed=mode==="collapse"?tasks.filter(t=>t.done):[];
  if(!visible.length&&!completed.length)return null;
  const row=(t:Task)=><li key={t.id} className={t.done?"calendar-week-done":""}>
    <input type="checkbox" checked={!!t.done} aria-label={`${t.done?"Uncheck":"Complete"} ${t.unit} ${t.title} week ${t.week}`} onChange={()=>onToggle(t)}/>
    <button onClick={()=>onOpen(t)}><strong>{t.title}</strong><small>{t.unit}{t.weight&&` · ${t.weight}`}{t.done?" · Completed":" · Date to confirm"}</small></button>
    <button className="calendar-week-edit" onClick={()=>onSchedule(t)}>Set date</button>
  </li>;
  return <section className="calendar-week-items" aria-label={`Week ${week} dates to confirm`}>
    <h3>Week {week} · dates to confirm <span>{visible.length+completed.length}</span></h3>
    <ul>{visible.map(row)}</ul>
    {!!completed.length&&<details><summary>✓ Completed ({completed.length})</summary><ul>{completed.map(row)}</ul></details>}
  </section>;
}
