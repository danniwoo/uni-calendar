"use client";
import {useState} from "react";
import {COLORS,shortDate,type Semester,type Task,type ClassEvent} from "@/lib/semester";
import {monthDays,monthEntries,shiftMonth,type MonthEntry} from "@/lib/month-calendar";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "@/components/ui/sheet";

export function MonthCalendar({semester,today,onTask,onClass,onToggleTask,onToggleClass}:{semester:Semester;today:string;onTask:(t:Task)=>void;onClass:(c:ClassEvent)=>void;onToggleTask:(t:Task)=>void;onToggleClass:(c:ClassEvent)=>void}) {
  const firstMonth=semester.weeks[0].start.slice(0,7),lastMonth=semester.weeks[semester.weeks.length-1].end.slice(0,7);
  const initial=today.slice(0,7)<firstMonth?firstMonth:today.slice(0,7)>lastMonth?lastMonth:today.slice(0,7);
  const [month,setMonth]=useState(initial),[classes,setClasses]=useState(true),[completed,setCompleted]=useState(true),[unit,setUnit]=useState("all"),[day,setDay]=useState<string|null>(null);
  const dates=monthDays(month),weeks=Array.from({length:dates.length/7},(_,i)=>dates.slice(i*7,i*7+7));
  const entries=monthEntries(semester).filter(e=>(classes || e.task) && (completed || !e.done) && (unit==="all" || e.unit===unit));
  const activeCodes=new Set(semester.units.map(u=>u.code));
  const undated=semester.tasks.filter(t=>activeCodes.has(t.unit) && !t.splitCount && !t.date && (completed || !t.done) && (unit==="all" || t.unit===unit));
  const weekOnly=undated.filter(t=>t.week && semester.weeks.some(w=>w.number===t.week && w.start<=dates[dates.length-1] && w.end>=dates[0]));
  const unknown=undated.filter(t=>!t.week);
  const retainedCount=semester.tasks.filter(t=>!activeCodes.has(t.unit)).length;
  const title=new Intl.DateTimeFormat("en-AU",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${month}-01T12:00:00Z`));
  function open(e:MonthEntry){setDay(null);if(e.task)onTask(e.task);else if(e.event)onClass(e.event);}
  function Item({entry:e,full=false}:{entry:MonthEntry;full?:boolean}) {
    const color=COLORS[Math.max(0,semester.units.findIndex(u=>u.code===e.unit))%COLORS.length];
    const when=e.task?.timeBasis==="class"?`${e.time || ""} in class`:e.task?.timing.startsWith("Before")?`Before ${e.time || "class"}`:e.time || "Time TBC";
    return <div className={`month-entry ${e.task?"deadline":"class-entry"} ${e.done?"entry-done":""} ${full?"full-entry":""}`} style={{"--entry-color":color} as React.CSSProperties}>
      <input type="checkbox" aria-label={`${e.done?"Uncheck":"Complete"} ${e.unit} ${e.title} ${e.date}`} checked={e.done} onChange={()=>e.task?onToggleTask(e.task):e.event && onToggleClass(e.event)}/>
      <button title={`${e.unit} · ${e.title} · ${when}${e.done?" · Recorded complete":""}`} onClick={()=>open(e)}><span className="month-entry-name">{e.task && <b>{e.unit} · </b>}{e.title}</span><small>{!e.task?`${e.unit} · `:""}{when}{full && e.event?`–${e.event.end}`:""}{e.done?" · ✓ Done":""}</small></button>
    </div>;
  }
  return <section className="month-view" aria-label="Month calendar">
    <div className="month-toolbar"><div className="month-navigation"><h2 aria-live="polite">{title}</h2><button aria-label="Previous month" disabled={month<=firstMonth} onClick={()=>setMonth(shiftMonth(month,-1))}>‹</button><button aria-label="Next month" disabled={month>=lastMonth} onClick={()=>setMonth(shiftMonth(month,1))}>›</button><button onClick={()=>setMonth(initial)}>Today</button></div><div className="month-filters"><label>Unit <select value={unit} onChange={e=>setUnit(e.target.value)}><option value="all">All units</option>{semester.units.map(u=><option key={u.code}>{u.code}</option>)}</select></label><label><input type="checkbox" checked={classes} onChange={e=>setClasses(e.target.checked)}/>Classes</label><label><input type="checkbox" checked={completed} onChange={e=>setCompleted(e.target.checked)}/>Show completed</label></div></div>
    <p className="month-help">Tick to record completion · Click an item for details · Sydney time</p>
    <div className="month-scroll" tabIndex={0} role="region" aria-label="Calendar grid, scroll horizontally on small screens"><div className="month-grid">
      <div className="month-day-headings">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><strong key={d}>{d}</strong>)}</div>
      {weeks.map(row=>{const teaching=semester.weeks.find(w=>row[0]>=w.start && row[0]<=w.end);return <div className="month-week" key={row[0]}><div className="month-week-label">{teaching?.label || "Outside semester"}</div><div className="month-week-days">{row.map(date=>{const items=entries.filter(e=>e.date===date),extra=items.slice(3),hiddenTasks=extra.filter(e=>e.task).length;return <div key={date} className={`month-day ${date.slice(0,7)!==month?"other-month":""} ${date===today?"month-today":""}`}><button className="month-day-number" aria-label={`Open ${date}${date===today?", today":""}`} aria-current={date===today?"date":undefined} onClick={()=>setDay(date)}>{Number(date.slice(-2))}{date===today && <small>Today</small>}</button><div className="month-day-items">{items.slice(0,3).map(e=><Item key={e.id} entry={e}/>)}</div>{extra.length>0 && <button className="month-more" onClick={()=>setDay(date)}>+{extra.length} more{hiddenTasks?` · ${hiddenTasks} task${hiddenTasks===1?"":"s"}`:""}</button>}</div>;})}</div></div>;})}
    </div></div>
    <div className="month-unscheduled">{[{title:"Week known · date to confirm",tasks:weekOnly},{title:"No date yet",tasks:unknown}].map(group=><details key={group.title}><summary>{group.title} <span>{group.tasks.length}</span></summary>{group.tasks.length?group.tasks.map(t=><div className={`month-pending-row ${t.done?"entry-done":""}`} key={t.id}><input type="checkbox" aria-label={`Complete ${t.unit} ${t.title}`} checked={!!t.done} onChange={()=>onToggleTask(t)}/><button onClick={()=>onTask(t)}>{t.week && <b>W{t.week} · </b>}{t.unit} · {t.title}{t.done?" · ✓ Done":""}</button></div>):<p>Nothing to schedule here.</p>}</details>)}</div>
    {!!retainedCount && <p className="hint">Showing your currently imported units. Tasks retained from other units have not been deleted.</p>}
    <Sheet open={!!day} onOpenChange={o=>{if(!o)setDay(null);}}><SheetContent className="detail-panel"><SheetHeader><SheetTitle>{day?shortDate(day):"Day"}</SheetTitle><SheetDescription>All visible items for this day. Checkboxes sync with Semester.</SheetDescription></SheetHeader><div className="month-agenda">{entries.filter(e=>e.date===day).map(e=><Item key={e.id} entry={e} full/>)}{!entries.some(e=>e.date===day) && <p>No items with these filters.</p>}</div></SheetContent></Sheet>
  </section>;
}
