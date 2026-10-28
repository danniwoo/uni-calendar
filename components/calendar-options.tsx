"use client";
import {useState} from "react";
import type {CompletedMode,CalendarVisibility} from "@/lib/month-calendar";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "@/components/ui/sheet";

export function CalendarOptions({classes,assignments,personal,completedMode,onChange,retainedCount=0}:CalendarVisibility&{completedMode:CompletedMode;onChange:(value:Partial<CalendarVisibility>&{completedMode?:CompletedMode})=>void;retainedCount?:number}){
  const [open,setOpen]=useState(false);
  return <div className="calendar-visibility-controls"><div className="calendar-visibility" role="group" aria-label="Show in calendar">
      {([["assignments","Assignments / quizzes",assignments],["classes","Classes",classes],["personal","Personal",personal]] as const).map(([key,label,shown])=><button key={key} type="button" aria-pressed={shown} onClick={()=>onChange({[key]:!shown})}><span aria-hidden="true">{shown?"✓":"−"}</span>{label}</button>)}
    </div><label className="calendar-completion-filter">Completed<select aria-label="Completed items" value={completedMode} onChange={e=>onChange({completedMode:e.target.value as CompletedMode})}><option value="show">Keep visible</option><option value="collapse">Collapse</option><option value="hide">Hide</option></select></label>
    <button className="calendar-options-trigger" aria-label="Calendar help" onClick={()=>setOpen(true)}>Help</button>
    {!assignments&&!classes&&!personal&&<p className="calendar-filters-empty">All categories hidden. Turn one on above.</p>}
    <Sheet open={open} onOpenChange={setOpen}><SheetContent className="detail-panel calendar-options-panel"><SheetHeader><SheetTitle>Calendar display</SheetTitle><SheetDescription>Filters are shared by Month and Week on this device. Hiding items does not delete them.</SheetDescription></SheetHeader>
      <div className="calendar-options-fields">
      <p>Checking a lecture records learning progress. Class and assessment checks are separate; neither records a grade or a passed hurdle.</p>
      <p>Dates and times use Australia/Sydney. Teaching-week numbering pauses during the midsemester break.</p>
      {!!retainedCount&&<p>{retainedCount} retained task(s) belong to other units. These calendars show your currently imported units; nothing has been deleted.</p>}
      <a href="https://www.sydney.edu.au/students/key-dates.html" target="_blank" rel="noreferrer">USYD teaching calendar ↗</a><p>Find backup export and timetable refresh under Manage.</p><button onClick={()=>setOpen(false)}>Done</button></div>
    </SheetContent></Sheet></div>;
}
