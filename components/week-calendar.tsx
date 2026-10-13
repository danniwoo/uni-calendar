"use client";
import {useEffect,useRef,useState} from "react";
import {addDays,COLORS,shortDate,type Semester,type Task,type ClassEvent} from "@/lib/semester";
import {mondayOf,classRange,weekData,positionClasses,sydneyMinute,shortLocation} from "@/lib/week-calendar";
import {CalendarOptions} from "@/components/calendar-options";
import {restoreMonthPreferences,type MonthPreferences} from "@/lib/month-calendar";
import {learningScope} from "@/lib/learning-scope";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "@/components/ui/sheet";

type Props={semester:Semester;today:string;now:Date;onTask:(t:Task)=>void;onPreparation:(t:Task)=>void;onClass:(c:ClassEvent)=>void;onToggleTask:(t:Task)=>void;onToggleClass:(c:ClassEvent)=>void};
export function WeekCalendar({semester:s,today,now,onTask,onPreparation,onClass:showClass,onToggleTask,onToggleClass}:Props){
  const first=mondayOf(s.weeks[0].start),last=mondayOf(s.weeks[s.weeks.length-1].end);
  const initial=mondayOf(today)<first?first:mondayOf(today)>last?last:mondayOf(today);
  const codes=s.units.map(u=>u.code).sort().join(","),key=["month-view",s.year,s.session,codes].join(":"),weekKey=key+":week";
  const [start,setStart]=useState(initial),[prefs,setPrefs]=useState<MonthPreferences>({month:today.slice(0,7),unit:"all",classes:true,completedMode:"show"}),[ready,setReady]=useState(false),[pending,setPending]=useState(false);
  const scroll=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    try{setPrefs(restoreMonthPreferences(JSON.parse(localStorage.getItem(key)||"null"),today.slice(0,7),first.slice(0,7),last.slice(0,7),codes.split(",")));
      const saved=localStorage.getItem(weekKey);setStart(saved&&/^\d{4}-\d{2}-\d{2}$/.test(saved)&&saved>=first&&saved<=last?mondayOf(saved):initial);
    }catch{}setReady(true);
  },[key,weekKey,first,last,initial,codes,today]);
  // Reuse Month's filters/completion preference without changing its selected month.
  function change(next:Partial<MonthPreferences>){setPrefs(p=>{const updated={...p,...next};try{localStorage.setItem(key,JSON.stringify(updated));}catch{}return updated;});}
  useEffect(()=>{if(ready)try{localStorage.setItem(weekKey,start);}catch{}},[start,ready,weekKey]);
  useEffect(()=>{if(!ready||!scroll.current)return;scroll.current.scrollLeft=0;scroll.current.scrollTop=0;},[start,ready]);
  const {unit,classes,completedMode:mode}=prefs;
  const dates=Array.from({length:7},(_,i)=>addDays(start,i)),data=weekData(s,start,unit,classes);
  const monthName=(date:string)=>new Date(date+"T12:00:00Z").toLocaleDateString("en-AU",{month:"short",timeZone:"UTC"});
  const monthContext=monthName(start)+(start.slice(0,7)!==dates[6].slice(0,7)?"/"+monthName(dates[6]):"");
  const teaching=s.weeks.find(w=>start>=w.start&&start<=w.end);
  const color=(code:string)=>COLORS[Math.max(0,s.units.findIndex(u=>u.code===code))%COLORS.length];
  const keep=(t:Task)=>mode==="show"||!t.done;
  const visibleClasses=data.classes.filter(c=>mode==="show"||!s.completed[c.id]||(data.linked.get(c.id)||[]).some(t=>!t.done));
  const ranges=data.classes.flatMap(c=>{const r=classRange(c);return r?[r]:[];});
  const low=Math.min(8,...ranges.map(r=>Math.floor(r.start/60))),high=Math.max(20,...ranges.map(r=>Math.ceil(r.end/60)));
  const nowMinute=sydneyMinute(now);
  const [day,setDay]=useState<string|null>(null);
  useEffect(()=>setDay(null),[start]);
  const scaled=(minutes:number)=>`calc(${minutes}px * var(--week-scale, 1.2))`;
  const unknown=data.unknown.filter(t=>mode!=="hide"||!t.done);
  const visibleDue=data.due.filter(keep);
  const weekOnly=data.weekOnly.filter(keep),exams=data.awaitingExams.filter(t=>mode!=="hide"||!t.done);
  const [examsOpen,setExamsOpen]=useState(false),[dueExpanded,setDueExpanded]=useState(false);
  function toggleDueCards(){if(!dueExpanded&&scroll.current)scroll.current.scrollTop=0;setDueExpanded(!dueExpanded);}
  const retainedCount=s.tasks.filter(t=>!s.units.some(u=>u.code===t.unit)).length;
  const completedCount=data.due.filter(t=>t.done).length+data.classes.filter(c=>s.completed[c.id]).length+[...data.linked.values()].flat().filter(t=>t.done).length+data.weekOnly.filter(t=>t.done).length;
  const [completedOpen,setCompletedOpen]=useState(false);
  function onClass(c:ClassEvent){setDay(null);setPending(false);setCompletedOpen(false);showClass(c);}
  function task(t:Task,embedded=false){
    const scope=t.coverage?.length?learningScope(t,s):null;
    const when=t.timeBasis==="class"?(/^Before/i.test(t.timing)?"Before ":"In class · ")+(t.time||"time TBC"):t.time?"Due "+t.time:"Time TBC";
    return <div key={t.id} className={"week-task "+(t.done?"week-done":"")+(embedded?" embedded-task":"")} style={{"--entry-color":color(t.unit)} as React.CSSProperties}>
      <input type="checkbox" checked={!!t.done} aria-label={(t.done?"Uncheck ":"Complete ")+t.unit+" "+t.title+" "+(t.date||t.week||"")} onChange={()=>onToggleTask(t)}/>
      <div className="week-task-content"><button onClick={()=>{setDay(null);setPending(false);setCompletedOpen(false);onTask(t);}}><strong>{t.title}</strong><span>{!embedded&&<b>{t.unit} · </b>}{embedded?"In class":t.date?when:t.week?"W"+t.week+" · Date TBC":"Date TBC"}{t.hurdle&&" · Hurdle"}</span></button>{scope&&!t.done&&<button className="preparation-link" onClick={()=>{setDay(null);setPending(false);setCompletedOpen(false);onPreparation(t);}}>{scope.status} →</button>}</div>
    </div>;
  }
  function classLabel(c:ClassEvent){return c.activity.replace(/Practical/gi,"Lab");}
  return <section className="week-view" aria-label="Week calendar">
    <div className="week-scroll" ref={scroll} tabIndex={0} role="region" aria-label="Weekly time grid. On phones, tap a day or class for details and completion.">
    <div className="month-toolbar week-toolbar"><div className="month-navigation"><div><h2>{teaching?.number?"Week "+teaching.number:teaching?.label||"Week"}</h2><p>{shortDate(start)} – {shortDate(dates[6])} {s.year}</p></div><div className="month-nav-actions"><button aria-label="Previous week" disabled={start<=first} onClick={()=>setStart(addDays(start,-7))}>‹</button><button onClick={()=>setStart(initial)}>{today>=first&&today<=addDays(last,6)?"Today":"Semester start/end"}</button><button aria-label="Next week" disabled={start>=last} onClick={()=>setStart(addDays(start,7))}>›</button></div></div>
      <div className="month-filters"><select aria-label="Filter calendar by unit" value={unit} onChange={e=>change({unit:e.target.value})}><option value="all">All units</option>{s.units.map(u=><option key={u.code}>{u.code}</option>)}</select><button className={"month-pending-trigger "+(unknown.length?"has-pending":"")} onClick={()=>setPending(true)}>Needs dates ({unknown.length})</button><CalendarOptions classes={classes} completedMode={mode} onChange={change} retainedCount={retainedCount}/></div>
    </div>
    {(weekOnly.length>0||exams.length>0||(mode==="collapse"&&completedCount>0))&&<div className="week-status-bar" aria-label="Week summaries">
      {weekOnly.length>0&&<button className="week-status-undated" onClick={()=>setDay("week")}>{weekOnly.length} this week · date TBC</button>}
      {mode==="collapse"&&completedCount>0&&<button onClick={()=>setCompletedOpen(true)}>✓ {completedCount} completed</button>}
      {exams.length>0&&<button onClick={()=>setExamsOpen(true)}>Exams · awaiting dates ({exams.length})</button>}
    </div>}
    <div className="week-grid">
      <div className="week-sticky"><div className="week-date-row"><div className="week-gutter" title={`${shortDate(start)} – ${shortDate(dates[6])} ${s.year} · Sydney time`}>{monthContext}</div>{dates.map((date,i)=><div key={date} title={date} className={"week-date "+(i>4?"weekend":"")}><span>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</span><b aria-current={date===today?"date":undefined}>{Number(date.slice(-2))}</b><button className="week-mobile-day-hit" aria-label={"Open day "+date} onClick={()=>setDay(date)}/></div>)}</div>
        {!!visibleDue.length&&<div className="week-mobile-due-row"><span><span className="week-due-label">Due</span><button className="week-due-expand" aria-label="Expand due task cards" aria-expanded={dueExpanded} onClick={toggleDueCards}>Due {dueExpanded?"▴":"▾"}</button></span>{dates.map(date=>{const tasks=visibleDue.filter(t=>t.date===date);return <div key={date}>{tasks.length>0&&<button onClick={()=>setDay(date)} aria-label={`${shortDate(date)}: ${tasks.length} tasks, ${tasks.filter(t=>t.done).length} complete`}>{tasks.every(t=>t.done)?"✓ ":""}{tasks.length} {tasks.length===1?"task":"tasks"}</button>}</div>;})}</div>}
      </div>
      {!!visibleDue.length&&dueExpanded&&<div className="week-due-row"><div className="week-gutter">Tasks</div>{dates.map(date=>{const tasks=visibleDue.filter(t=>t.date===date);return <div key={date} className="week-due-cell">{tasks.map(t=>task(t))}</div>;})}</div>}
      <div className="week-time-grid" style={{height:scaled((high-low)*60)}}><div className="week-hours">{Array.from({length:high-low},(_,i)=><span key={i} style={{top:scaled(i*60)}}>{String(low+i).padStart(2,"0")}:00</span>)}</div>
        {dates.map((date,index)=>{const positioned=positionClasses(visibleClasses.filter(c=>c.date===date));return <div key={date} className={"week-time-day "+(index>4?"weekend":"")} style={{backgroundSize:`100% ${scaled(60)}`}}>
          {positioned.map(p=>{const c=p.event,linked=data.linked.get(c.id)||[],done=!!s.completed[c.id];return <div className="week-class" key={c.id} style={{top:scaled(p.start-low*60),height:`calc(${scaled(p.end-p.start)} - 2px)`,left:`calc(${p.lane/p.lanes*100}% + var(--week-inset, 3px))`,width:`calc(${100/p.lanes}% - var(--week-gap, 6px))`,"--entry-color":color(c.unit)} as React.CSSProperties}>
            <button className="week-mobile-class" onClick={()=>setDay(date)} aria-label={[c.unit,c.activity,c.time+"–"+c.end,done?"Recorded complete":"Unrecorded","Open day details"].join(" · ")}><b>{c.unit.slice(0,4)}<br/>{c.unit.slice(4)}</b><span>{done?"✓ ":""}{classLabel(c).replace(/Lecture/i,"Lec").replace(/Tutorial/i,"Tut").replace(/Workshop/i,"W/shop")}</span>{linked.filter(keep).length>0&&<small>{linked.filter(keep).length} task{linked.filter(keep).length===1?"":"s"}</small>}</button>
            <div className={"week-class-main "+(done?"week-done":"")}><input type="checkbox" checked={done} aria-label={(done?"Uncheck ":"Complete ")+c.unit+" "+c.activity+" "+c.date+" "+c.time} onChange={()=>onToggleClass(c)}/><button onClick={()=>onClass(c)} title={[c.unit,c.activity,c.time+"–"+c.end,c.location].join(" · ")}><strong>{c.unit} <span>{classLabel(c)}</span></strong><span>{c.time}–{c.end}</span>{c.location&&<small className="week-location">{shortLocation(c.location,c.date)}</small>}</button></div>
            {linked.filter(keep).map(t=>task(t,true))}
            {mode==="collapse"&&linked.some(t=>t.done)&&<button className="week-linked-completed" onClick={()=>setCompletedOpen(true)}>✓ {linked.filter(t=>t.done).length} task completed</button>}
          </div>;})}
          {date===today&&nowMinute>=low*60&&nowMinute<high*60&&<div className="week-now" style={{top:scaled(nowMinute-low*60)}}><span>{String(Math.floor(nowMinute/60)).padStart(2,"0")}:{String(nowMinute%60).padStart(2,"0")}</span></div>}
        </div>;})}
      </div>
    </div></div>
    {visibleClasses.some(c=>!classRange(c))&&<div className="week-unscheduled"><strong>Class time needs checking</strong>{visibleClasses.filter(c=>!classRange(c)).map(c=><button key={c.id} onClick={()=>onClass(c)}>{c.unit} · {c.activity} · {shortDate(c.date)} · {c.time}–{c.end}</button>)}</div>}
    <Sheet open={examsOpen} onOpenChange={setExamsOpen}><SheetContent className="detail-panel"><SheetHeader><SheetTitle>Final exams · awaiting dates</SheetTitle><SheetDescription>Add the official date when your exam timetable is available. These are not counted as missing details.</SheetDescription></SheetHeader><div className="week-sheet-list">{exams.map(t=><button className="week-exam-link" key={t.id} onClick={()=>{setExamsOpen(false);onTask(t);}}>{t.unit} · {t.title}<small>{t.weight}{t.done?" · recorded complete":""}</small></button>)}</div></SheetContent></Sheet>
    <Sheet open={pending||completedOpen} onOpenChange={o=>{if(!o){setPending(false);setCompletedOpen(false);}}}><SheetContent className="detail-panel"><SheetHeader><SheetTitle>{pending?"Needs dates":"Completed this week"}</SheetTitle><SheetDescription>{pending?"No date or teaching week yet. Open an item to place it; nothing is assigned a guessed date.":"Your checkmarks are kept across all views."}</SheetDescription></SheetHeader><div className="week-sheet-list">{pending?(unknown.length?unknown.map(t=>task(t)):<p>No unscheduled tasks.</p>):<>{[...data.due,...[...data.linked.values()].flat(),...data.weekOnly].filter(t=>t.done).map(t=>task(t))}{data.classes.filter(c=>s.completed[c.id]).map(c=><div key={c.id} className="week-completed-class"><input type="checkbox" checked aria-label={"Uncheck "+c.unit+" "+c.activity+" "+c.date+" "+c.time} onChange={()=>onToggleClass(c)}/><button onClick={()=>onClass(c)}>{c.unit} · {c.activity}<small>{shortDate(c.date)} · {c.time}–{c.end}</small></button></div>)}</>}</div></SheetContent></Sheet>
    <Sheet open={!!day} onOpenChange={o=>{if(!o)setDay(null);}}><SheetContent className="detail-panel week-day-panel"><SheetHeader><SheetTitle>{day==="week"?"This week · date TBC":day?new Date(day+"T12:00:00Z").toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"}):"Day"}</SheetTitle><SheetDescription>Full details and separate class/task checkmarks · Sydney time</SheetDescription></SheetHeader>
      <div className="week-sheet-list">{day==="week"?data.weekOnly.filter(keep).map(t=>task(t)):<>
        <h3>Tasks & quizzes</h3>
        {[...data.due,...[...data.linked.values()].flat()].filter(t=>t.date===day&&(mode!=="hide"||!t.done)).map(t=>task(t))}
        {![...data.due,...[...data.linked.values()].flat()].some(t=>t.date===day&&(mode!=="hide"||!t.done))&&<p>No tasks with these filters.</p>}
        <h3>Classes</h3>{data.classes.filter(c=>c.date===day&&(mode!=="hide"||!s.completed[c.id])).sort((a,b)=>a.time.localeCompare(b.time)).map(c=><div className="week-completed-class" key={c.id}><input type="checkbox" checked={!!s.completed[c.id]} aria-label={(s.completed[c.id]?"Uncheck ":"Complete ")+c.unit+" "+c.activity+" "+c.date+" "+c.time} onChange={()=>onToggleClass(c)}/><button onClick={()=>onClass(c)}>{c.unit} · {classLabel(c)}<small>{c.time}–{c.end}</small>{c.location&&<small>{shortLocation(c.location,c.date)}</small>}</button></div>)}
        {!data.classes.some(c=>c.date===day&&(mode!=="hide"||!s.completed[c.id]))&&<p>No classes with these filters.</p>}
      </>}</div>
    </SheetContent></Sheet>
  </section>;
}
