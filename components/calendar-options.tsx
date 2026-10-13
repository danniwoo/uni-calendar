"use client";
import {useState} from "react";
import type {CompletedMode} from "@/lib/month-calendar";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "@/components/ui/sheet";

export function CalendarOptions({classes,completedMode,onChange,retainedCount=0}:{classes:boolean;completedMode:CompletedMode;onChange:(value:{classes?:boolean;completedMode?:CompletedMode})=>void;retainedCount?:number}){
  const [open,setOpen]=useState(false);
  const filtered=!classes||completedMode!=="show";
  return <><button className="calendar-options-trigger" aria-label="View options" onClick={()=>setOpen(true)}>View options{filtered&&<span className="options-active" title="Some items are collapsed or hidden"> ·</span>}</button>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent className="detail-panel calendar-options-panel"><SheetHeader><SheetTitle>View options</SheetTitle><SheetDescription>Shared by Month and Week on this device. Your tasks and checkmarks are unchanged.</SheetDescription></SheetHeader>
      <div className="calendar-options-fields"><label><span>Show classes</span><input type="checkbox" checked={classes} onChange={e=>onChange({classes:e.target.checked})}/></label>
      <label><span>Completed items</span><select aria-label="Completed items" value={completedMode} onChange={e=>onChange({completedMode:e.target.value as CompletedMode})}><option value="show">Keep visible</option><option value="collapse">Collapse</option><option value="hide">Hide</option></select></label>
      <p>Checking a lecture records learning progress. Class and assessment checks are separate; neither records a grade or a passed hurdle.</p>
      <p>Dates and times use Australia/Sydney. Teaching-week numbering pauses during the midsemester break.</p>
      {!!retainedCount&&<p>{retainedCount} retained task(s) belong to other units. These calendars show your currently imported units; nothing has been deleted.</p>}
      <a href="https://www.sydney.edu.au/students/key-dates.html" target="_blank" rel="noreferrer">USYD teaching calendar ↗</a><p>Find backup export and timetable refresh under Manage.</p></div>
    </SheetContent></Sheet></>;
}
