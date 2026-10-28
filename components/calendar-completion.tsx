"use client";
import {useState} from "react";
import type {Task,ClassEvent,Semester} from "@/lib/semester";
import type {CompletedMode} from "@/lib/month-calendar";

// Temporary feedback/Undo only. No activity log or completion date is invented.
export function useCalendarCompletion(s:Semester,mode:CompletedMode,onTask:(t:Task)=>void,onClass:(c:ClassEvent)=>void){
  const [last,setLast]=useState<{id:string;kind:"task"|"class";label:string;done:boolean}|null>(null);
  function toggleTask(t:Task){onTask(t);setLast({id:t.id,kind:"task",label:t.title,done:!t.done});}
  function toggleClass(c:ClassEvent){onClass(c);setLast({id:c.id,kind:"class",label:`${c.unit} ${c.activity}`,done:!s.completed[c.id]});}
  const task=last?.kind==="task"?s.tasks.find(t=>t.id===last.id):undefined;
  const event=last?.kind==="class"?s.classes.find(c=>c.id===last.id):undefined;
  const canUndo=!!last&&(task?!!task.done===last.done:event?!!s.completed[event.id]===last.done:false);
  function undo(){if(!canUndo)return;if(task)onTask(task);else if(event)onClass(event);setLast(null);}
  const filtered=!!event||!!task?.date||!!task?.week;
  const feedback=last&&canUndo&&<div className="calendar-completion-feedback" role="status">
    <span>{last.done?"✓ Completed":"Marked unfinished"} · {last.label}{last.done&&filtered&&mode!=="show"?(mode==="collapse"?" · In Completed":" · Hidden by your filter"):""}</span>
    {canUndo&&<button onClick={undo}>Undo</button>}<button aria-label="Dismiss completion message" onClick={()=>setLast(null)}>×</button>
  </div>;
  return {toggleTask,toggleClass,feedback};
}
