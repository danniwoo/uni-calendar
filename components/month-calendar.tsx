"use client";
import {useEffect,useState} from "react";
import {COLORS,shortDate,type Semester,type Task,type ClassEvent} from "@/lib/semester";
import {monthDays,monthEntries,shiftMonth,dayPreview,shortEntryTitle,entryBadge,restoreMonthPreferences,type MonthEntry,type MonthPreferences} from "@/lib/month-calendar";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "@/components/ui/sheet";
import {CalendarOptions} from "@/components/calendar-options";
import {AwaitingExams} from "@/components/awaiting-exams";
import {awaitingExamDate} from "@/lib/month-calendar";

type Props={semester:Semester;today:string;onTask:(t:Task)=>void;onClass:(c:ClassEvent)=>void;onToggleTask:(t:Task)=>void;onToggleClass:(c:ClassEvent)=>void};
function CalendarItem({entry:e,color,onOpen,onToggle,full=false}:{entry:MonthEntry;color:string;onOpen:(e:MonthEntry)=>void;onToggle:(e:MonthEntry)=>void;full?:boolean}) {
  const when=e.task?.timing.startsWith("Before")?"Before "+(e.time || "class"):e.task?.timeBasis==="class"?(e.time || "")+" in class":e.time || "Time TBC";
  const badge=entryBadge(e),routine=e.task?.routine&&!e.task.hurdle;
  return <div className={["month-entry",e.task?routine?"routine-entry":"deadline":"class-entry",e.done?"entry-done":"",full?"full-entry":""].join(" ")} style={{"--entry-color":color} as React.CSSProperties}>
    <label className="month-check"><input type="checkbox" aria-label={[e.done?"Uncheck":"Complete",e.unit,e.title,e.date].join(" ")} checked={e.done} onChange={()=>onToggle(e)}/></label>
    <button title={[e.unit,e.title,when,badge,e.done?"Recorded complete":""].filter(Boolean).join(" · ")} onClick={()=>onOpen(e)}>
      {e.event&&!full?<><span className="month-entry-name"><b>{e.unit}</b> {shortEntryTitle(e)}</span><small className="month-entry-time">{e.time}</small></>:<>
        <span className="month-entry-name">{full && <b>{e.unit}</b>} {full?e.title:shortEntryTitle(e)}</span>
        <span className="month-entry-meta">{!full && <b>{e.unit}</b>}<small>{when}{full && e.event?"–"+e.event.end:""}</small>{badge && <span className="month-entry-badge">{badge}</span>}</span>
      </>}
    </button>
  </div>;
}
export function MonthCalendar({semester,today,onTask,onClass,onToggleTask,onToggleClass}:Props) {
  const firstMonth=semester.weeks[0].start.slice(0,7),lastMonth=semester.weeks[semester.weeks.length-1].end.slice(0,7);
  const initial=today.slice(0,7)<firstMonth?firstMonth:today.slice(0,7)>lastMonth?lastMonth:today.slice(0,7);
  const codes=semester.units.map(u=>u.code).sort().join(","),preferenceKey=["month-view",semester.year,semester.session,codes].join(":");
  const [prefs,setPrefs]=useState<MonthPreferences>({month:initial,classes:true,completedMode:"show",unit:"all"});
  const [readyKey,setReadyKey]=useState("");
  const [day,setDay]=useState<string|null>(null),[pendingOpen,setPendingOpen]=useState(false);
  useEffect(()=>{
    let saved:unknown;try{saved=JSON.parse(localStorage.getItem(preferenceKey)||"null");}catch{}
    setPrefs(restoreMonthPreferences(saved,initial,firstMonth,lastMonth,codes.split(",")));setReadyKey(preferenceKey);
  },[preferenceKey,initial,firstMonth,lastMonth,codes]);
  useEffect(()=>{if(readyKey===preferenceKey)try{localStorage.setItem(preferenceKey,JSON.stringify(prefs));}catch{}},[prefs,readyKey,preferenceKey]);
  const {month,classes,completedMode,unit}=prefs;
  const showCompleted=completedMode!=="hide";
  function change(next:Partial<MonthPreferences>){setPrefs(p=>({...p,...next}));}
  const dates=monthDays(month),weeks=Array.from({length:dates.length/7},(_,i)=>dates.slice(i*7,i*7+7));
  const allEntries=monthEntries(semester).filter(e=>unit==="all" || e.unit===unit);
  const entries=allEntries.filter(e=>(classes || e.task) && (showCompleted || !e.done));
  const activeCodes=new Set(semester.units.map(u=>u.code));
  const undated=semester.tasks.filter(t=>activeCodes.has(t.unit) && !t.splitCount && !t.date && (showCompleted || !t.done) && (unit==="all" || t.unit===unit));
  const weekOnly=undated.filter(t=>!awaitingExamDate(t)&&t.week && semester.weeks.some(w=>w.number===t.week && w.start<=dates[dates.length-1] && w.end>=dates[0]));
  const unknown=undated.filter(t=>!t.week&&!awaitingExamDate(t)),pendingCount=weekOnly.length+unknown.length;
  const awaitingExams=undated.filter(awaitingExamDate);
  const retainedCount=semester.tasks.filter(t=>!activeCodes.has(t.unit)).length;
  const title=new Intl.DateTimeFormat("en-AU",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(month+"-01T12:00:00Z"));
  const dayTitle=day?new Intl.DateTimeFormat("en-AU",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"}).format(new Date(day+"T12:00:00Z")):"Day";
  function color(code:string){return COLORS[Math.max(0,semester.units.findIndex(u=>u.code===code))%COLORS.length];}
  function open(e:MonthEntry){setDay(null);if(e.task)onTask(e.task);else if(e.event)onClass(e.event);}
  function toggle(e:MonthEntry){if(e.task)onToggleTask(e.task);else if(e.event)onToggleClass(e.event);}
  function item(e:MonthEntry,full=false){return <CalendarItem key={e.id} entry={e} color={color(e.unit)} onOpen={open} onToggle={toggle} full={full}/>;}
  const dayItems=entries.filter(e=>e.date===day);
  return <section className="month-view" aria-label="Month calendar">
    <div className="month-toolbar">
      <div className="month-navigation"><h2 aria-live="polite">{title}</h2><div className="month-nav-actions"><button aria-label="Previous month" disabled={month<=firstMonth} onClick={()=>change({month:shiftMonth(month,-1)})}>‹</button><button onClick={()=>change({month:initial})}>{today.slice(0,7)===initial?"Today":"Semester start/end"}</button><button aria-label="Next month" disabled={month>=lastMonth} onClick={()=>change({month:shiftMonth(month,1)})}>›</button></div></div>
      <div className="month-filters"><select aria-label="Filter calendar by unit" value={unit} onChange={e=>change({unit:e.target.value})}><option value="all">All units</option>{semester.units.map(u=><option key={u.code}>{u.code}</option>)}</select><button className={"month-pending-trigger "+(pendingCount?"has-pending":"")} aria-expanded={pendingOpen} aria-controls="month-pending" onClick={()=>setPendingOpen(!pendingOpen)}>Needs dates ({pendingCount}) {pendingOpen?"−":"+"}</button><CalendarOptions classes={classes} completedMode={completedMode} onChange={change} retainedCount={retainedCount}/></div>
    </div>
    {pendingOpen && <div className="month-unscheduled" id="month-pending">{[{title:"Week known · shown weeks",tasks:weekOnly},{title:"Date unknown · semester",tasks:unknown}].map(group=><section key={group.title}><h3>{group.title} <span>{group.tasks.length}</span></h3>{group.tasks.length?group.tasks.map(t=><div className={"month-pending-row "+(t.done?"entry-done":"")} key={t.id}><input type="checkbox" aria-label={[t.done?"Uncheck":"Complete",t.unit,t.title].join(" ")} checked={!!t.done} onChange={()=>onToggleTask(t)}/><button onClick={()=>onTask(t)}>{t.week && <b>W{t.week} · </b>}{t.unit} · {t.title}</button></div>):<p>Nothing to schedule here.</p>}</section>)}</div>}
    <AwaitingExams tasks={awaitingExams} onTask={onTask}/>
    <div className="month-scroll" tabIndex={0} role="region" aria-label="Monthly calendar. Click a date for all items; checkboxes record completion."><div className="month-grid">
      <div className="month-day-headings">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><strong key={d}>{d}</strong>)}</div>
      {weeks.map(row=>{
        const teaching=semester.weeks.find(w=>row[0]>=w.start && row[0]<=w.end);
        return <div className="month-week" key={row[0]}>
          <div className={"month-week-label "+(teaching?.kind==="break"?"is-break":"")} title={teaching?.label || "Outside semester"}><span>{teaching?.number?"W"+teaching.number:teaching?.kind==="break"?"Break":teaching?.kind==="study"?"Study":teaching?.kind==="exam"?"Exam":"—"}</span></div>
          <div className="month-week-days">{row.map(date=>{
            const items=entries.filter(e=>e.date===date),preview=dayPreview(items,3,completedMode),mobile=dayPreview(items,3,completedMode),hiddenTasks=preview.overflow.filter(e=>e.task&&!e.done).length;
            return <div key={date} className={"month-day "+(date.slice(0,7)!==month?"other-month":"")}>
              <div className="month-date-heading"><button className="month-day-number" aria-label={"Open "+date+(date===today?", today":"")} aria-current={date===today?"date":undefined} onClick={()=>setDay(date)}>{Number(date.slice(-2))}</button></div>
              <div className="month-day-items">{preview.visible.map(e=>item(e))}{preview.overflow.length>0 && <button className="month-more" onClick={()=>setDay(date)}>+{preview.overflow.length} more{hiddenTasks?" · "+hiddenTasks+" task"+(hiddenTasks===1?"":"s"):""}</button>}{preview.completed.length>0 && <details className="month-completed-group"><summary>✓ {preview.completed.length} completed</summary><div>{preview.completed.map(e=>item(e))}</div></details>}</div>
              {items.length>0 && <button className="month-mobile-summary" aria-label={shortDate(date)+": "+items.length+" items, "+items.filter(e=>e.done).length+" complete. Open day to view and tick."} onClick={()=>setDay(date)}>{mobile.visible.map(e=><span key={e.id} className={"month-mobile-item "+(e.task&&(!e.task.routine||e.task.hurdle)?"mobile-deadline":"")+(e.done?" mobile-entry-done":"")} style={{"--entry-color":color(e.unit)} as React.CSSProperties} title={e.unit+" · "+e.title}><span>{e.done?"✓ ":""}{shortEntryTitle(e,true)}</span>{e.task?.hurdle && <small>Hurdle</small>}</span>)}{mobile.overflow.length>0 && <span className="month-mobile-more">+{mobile.overflow.length} more</span>}{mobile.completed.length>0 && <span className="month-mobile-completed">✓ {mobile.completed.length}</span>}</button>}
            </div>;
          })}</div>
        </div>;
      })}
    </div></div>
    <Sheet open={!!day} onOpenChange={o=>{if(!o)setDay(null);}}><SheetContent className="detail-panel month-day-panel"><SheetHeader><SheetTitle>{dayTitle}</SheetTitle><SheetDescription>Tick to record completion · Open a title for details. Changes also appear in Semester.</SheetDescription></SheetHeader><div className="month-agenda">{[{name:"Tasks & quizzes",items:dayItems.filter(e=>e.task&&(completedMode==="show"||!e.done))},{name:"Classes",items:dayItems.filter(e=>e.event&&(completedMode==="show"||!e.done))},{name:"Completed ("+dayItems.filter(e=>e.done).length+")",items:completedMode==="collapse"?dayItems.filter(e=>e.done):[]}].filter(g=>g.items.length).map(group=><section key={group.name}><h3>{group.name}</h3>{group.items.map(e=>item(e,true))}</section>)}{!dayItems.length && <p>No items with these filters.</p>}</div></SheetContent></Sheet>
  </section>;
}
