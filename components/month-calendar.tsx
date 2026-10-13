"use client";
import {useState} from "react";
import {COLORS,shortDate,type Semester,type Task,type ClassEvent} from "@/lib/semester";
import {monthDays,monthEntries,shiftMonth,type MonthEntry} from "@/lib/month-calendar";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "@/components/ui/sheet";

type Props={semester:Semester;today:string;onTask:(t:Task)=>void;onClass:(c:ClassEvent)=>void;onToggleTask:(t:Task)=>void;onToggleClass:(c:ClassEvent)=>void};
function CalendarItem({entry:e,color,onOpen,onToggle,full=false}:{entry:MonthEntry;color:string;onOpen:(e:MonthEntry)=>void;onToggle:(e:MonthEntry)=>void;full?:boolean}) {
  const when=e.task?.timing.startsWith("Before")?`Before ${e.time || "class"}`:e.task?.timeBasis==="class"?`${e.time || ""} in class`:e.time || "Time TBC";
  return <div className={`month-entry ${e.task?"deadline":"class-entry"} ${e.done?"entry-done":""} ${full?"full-entry":""}`} style={{"--entry-color":color} as React.CSSProperties}>
    <label className="month-check"><input type="checkbox" aria-label={`${e.done?"Uncheck":"Complete"} ${e.unit} ${e.title} ${e.date}`} checked={e.done} onChange={()=>onToggle(e)}/></label>
    <button title={`${e.unit} · ${e.title} · ${when}${e.done?" · Recorded complete":""}`} onClick={()=>onOpen(e)}><span className="month-entry-meta"><b>{e.unit}</b><span>{e.done?"✓ Done":e.task?.hurdle?"Hurdle":e.task?.kind==="quiz"?"Quiz":""}</span></span><span className="month-entry-name">{e.title}</span><small>{when}{full && e.event?`–${e.event.end}`:""}</small></button>
  </div>;
}
export function MonthCalendar({semester,today,onTask,onClass,onToggleTask,onToggleClass}:Props) {
  const firstMonth=semester.weeks[0].start.slice(0,7),lastMonth=semester.weeks[semester.weeks.length-1].end.slice(0,7);
  const initial=today.slice(0,7)<firstMonth?firstMonth:today.slice(0,7)>lastMonth?lastMonth:today.slice(0,7);
  const [month,setMonth]=useState(initial),[classes,setClasses]=useState(true),[completed,setCompleted]=useState(true),[unit,setUnit]=useState("all"),[day,setDay]=useState<string|null>(null),[pendingOpen,setPendingOpen]=useState(false);
  const dates=monthDays(month),weeks=Array.from({length:dates.length/7},(_,i)=>dates.slice(i*7,i*7+7));
  const allEntries=monthEntries(semester).filter(e=>unit==="all" || e.unit===unit);
  const entries=allEntries.filter(e=>(classes || e.task) && (completed || !e.done));
  const monthTasks=allEntries.filter(e=>e.task && e.date.startsWith(month));
  const activeCodes=new Set(semester.units.map(u=>u.code));
  const undated=semester.tasks.filter(t=>activeCodes.has(t.unit) && !t.splitCount && !t.date && (completed || !t.done) && (unit==="all" || t.unit===unit));
  const weekOnly=undated.filter(t=>t.week && semester.weeks.some(w=>w.number===t.week && w.start<=dates[dates.length-1] && w.end>=dates[0]));
  const unknown=undated.filter(t=>!t.week),pendingCount=weekOnly.length+unknown.length;
  const retainedCount=semester.tasks.filter(t=>!activeCodes.has(t.unit)).length;
  const title=new Intl.DateTimeFormat("en-AU",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${month}-01T12:00:00Z`));
  const dayTitle=day?new Intl.DateTimeFormat("en-AU",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"}).format(new Date(`${day}T12:00:00Z`)):"Day";
  function color(code:string){return COLORS[Math.max(0,semester.units.findIndex(u=>u.code===code))%COLORS.length];}
  function open(e:MonthEntry){setDay(null);if(e.task)onTask(e.task);else if(e.event)onClass(e.event);}
  function toggle(e:MonthEntry){if(e.task)onToggleTask(e.task);else if(e.event)onToggleClass(e.event);}
  function item(e:MonthEntry,full=false){return <CalendarItem key={e.id} entry={e} color={color(e.unit)} onOpen={open} onToggle={toggle} full={full}/>;}
  return <section className="month-view" aria-label="Month calendar">
    <div className="month-toolbar"><div className="month-navigation"><div><h2 aria-live="polite">{title}</h2><p className="month-stats">{monthTasks.length} dated tasks · {monthTasks.filter(e=>e.done).length} recorded complete</p></div><div className="month-nav-actions"><button aria-label="Previous month" disabled={month<=firstMonth} onClick={()=>setMonth(shiftMonth(month,-1))}>‹</button><button aria-label="Next month" disabled={month>=lastMonth} onClick={()=>setMonth(shiftMonth(month,1))}>›</button><button onClick={()=>setMonth(initial)}>{today.slice(0,7)===initial?"Today":"Semester start/end"}</button></div></div><div className="month-filters"><label><span className="sr-only">Unit</span><select aria-label="Filter calendar by unit" value={unit} onChange={e=>setUnit(e.target.value)}><option value="all">All units</option>{semester.units.map(u=><option key={u.code}>{u.code}</option>)}</select></label><label><input type="checkbox" checked={classes} onChange={e=>setClasses(e.target.checked)}/>Classes</label><label><input type="checkbox" checked={completed} onChange={e=>setCompleted(e.target.checked)}/>Completed</label></div></div>
    <div className="month-context"><div className="month-unit-key">{semester.units.filter(u=>unit==="all" || unit===u.code).map(u=><span key={u.code}><i style={{background:color(u.code)}}/>{u.code}</span>)}</div><button className={`month-pending-trigger ${pendingCount?"has-pending":""}`} aria-expanded={pendingOpen} aria-controls="month-pending" onClick={()=>setPendingOpen(!pendingOpen)}>{pendingCount} dates to confirm {pendingOpen?"−":"+"}</button></div>
    {pendingOpen && <div className="month-unscheduled" id="month-pending">{[{title:"Week known · this month",tasks:weekOnly},{title:"Date unknown · semester",tasks:unknown}].map(group=><section key={group.title}><h3>{group.title} <span>{group.tasks.length}</span></h3>{group.tasks.length?group.tasks.map(t=><div className={`month-pending-row ${t.done?"entry-done":""}`} key={t.id}><input type="checkbox" aria-label={`Complete ${t.unit} ${t.title}`} checked={!!t.done} onChange={()=>onToggleTask(t)}/><button onClick={()=>onTask(t)}>{t.week && <b>W{t.week} · </b>}{t.unit} · {t.title}{t.done?" · ✓ Done":""}</button></div>):<p>Nothing to schedule here.</p>}</section>)}</div>}
    <div className="month-help"><span className="desktop-calendar-help">Tick to record completion · Click a title for details</span><span className="mobile-calendar-help">Tap a day to view and tick its items</span><span>Sydney time</span></div>
    <div className="month-scroll" tabIndex={0} role="region" aria-label="Monthly calendar"><div className="month-grid">
      <div className="month-day-headings">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><strong key={d}>{d}</strong>)}</div>
      {weeks.map(row=>{const teaching=semester.weeks.find(w=>row[0]>=w.start && row[0]<=w.end);return <div className="month-week" key={row[0]}><div className={`month-week-label ${teaching?.kind==="break"?"is-break":""}`}>{teaching?.label || "Outside semester"}</div><div className="month-week-days">{row.map(date=>{const items=entries.filter(e=>e.date===date),extra=items.slice(3),hiddenTasks=extra.filter(e=>e.task&&!e.done).length,doneCount=items.filter(e=>e.done).length,taskCount=items.filter(e=>e.task).length;return <div key={date} className={`month-day ${date.slice(0,7)!==month?"other-month":""} ${date===today?"month-today":""}`}><div className="month-date-heading"><button className="month-day-number" aria-label={`Open ${date}${date===today?", today":""}`} aria-current={date===today?"date":undefined} onClick={()=>setDay(date)}>{Number(date.slice(-2))}</button>{doneCount>0 && <span className="month-day-completed" title={`${doneCount} recorded complete`}>✓ {doneCount}</span>}</div><div className="month-day-items">{items.slice(0,3).map(e=>item(e))}</div>{extra.length>0 && <button className="month-more" onClick={()=>setDay(date)}>+{extra.length} more{hiddenTasks?` · ${hiddenTasks} unchecked task${hiddenTasks===1?"":"s"}`:""}</button>}
        {items.length>0 && <button className="month-mobile-summary" aria-label={`${shortDate(date)}: ${taskCount} tasks, ${items.length-taskCount} classes, ${doneCount} complete. Open day.`} onClick={()=>setDay(date)}><span className="month-mobile-dots">{[...new Set(items.map(e=>e.unit))].map(code=><i key={code} style={{background:color(code)}}/>)}</span>{taskCount>0?<strong>{taskCount} task{taskCount===1?"":"s"}</strong>:<span>{items.length} class{items.length===1?"":"es"}</span>}</button>}
      </div>;})}</div></div>;})}
    </div></div>
    {!!retainedCount && <p className="hint month-retained-note">Calendar shows currently imported units. Other retained tasks have not been deleted.</p>}
    <Sheet open={!!day} onOpenChange={o=>{if(!o)setDay(null);}}><SheetContent className="detail-panel month-day-panel"><SheetHeader><SheetTitle>{dayTitle}</SheetTitle><SheetDescription>{entries.filter(e=>e.date===day).length} items · {entries.filter(e=>e.date===day&&e.done).length} recorded complete. Checkmarks sync with Semester.</SheetDescription></SheetHeader><div className="month-agenda">{[{name:"Tasks & quizzes",items:entries.filter(e=>e.date===day&&e.task)},{name:"Classes",items:entries.filter(e=>e.date===day&&e.event)}].filter(g=>g.items.length).map(group=><section key={group.name}><h3>{group.name}</h3>{group.items.map(e=>item(e,true))}</section>)}{!entries.some(e=>e.date===day) && <p>No items with these filters.</p>}</div></SheetContent></Sheet>
  </section>;
}
