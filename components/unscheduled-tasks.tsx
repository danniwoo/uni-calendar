"use client";
import {useState} from "react";
import type {Task} from "@/lib/semester";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "@/components/ui/sheet";
export function UnscheduledTasks({tasks,onTask,onToggle,forceOpen}:{tasks:Task[];onTask:(t:Task)=>void;onToggle:(t:Task)=>void;forceOpen?:number}) {
  const [open,setOpen]=useState(false),[dismissed,setDismissed]=useState<number>();
  const shown=open||!!forceOpen&&dismissed!==forceOpen;
  return <><button onClick={()=>setOpen(true)}>Unscheduled ({tasks.filter(t=>!t.done).length})</button><Sheet open={shown} onOpenChange={o=>{setOpen(o);if(!o)setDismissed(forceOpen);}}><SheetContent className="detail-panel"><SheetHeader><SheetTitle>Unscheduled tasks</SheetTitle><SheetDescription>Your own tasks without a deadline. These are not missing course details.</SheetDescription></SheetHeader><div className="week-sheet-list">{tasks.length?tasks.map(t=><div className="month-pending-row" key={t.id}><input type="checkbox" aria-label={(t.done?"Uncheck ":"Complete ")+t.title} checked={!!t.done} onChange={()=>onToggle(t)}/><button onClick={()=>{setOpen(false);setDismissed(forceOpen);onTask(t);}}>{t.unit&&<small>{t.unit} · </small>}{t.title}{t.done?" · completed":""}</button></div>):<p>No unscheduled tasks.</p>}</div></SheetContent></Sheet></>;
}
