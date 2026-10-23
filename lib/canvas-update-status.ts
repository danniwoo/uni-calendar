import type {Semester} from "./semester";
import {canvasKey,type CanvasBundle,type CanvasChoice} from "./canvas-import";

export type CanvasActionKind="grade"|"protected"|"attention"|"mapping"|"added"|"unchanged"|"summary";
export type CanvasAction={key:string;text:string;changed:boolean;kind?:CanvasActionKind};

// Status comes from the planner, never from matching English warning strings.
export function canvasUpdateStatus(s:Semester,b:CanvasBundle,choices:CanvasChoice[],actions:CanvasAction[]) {
  const selected=new Set(choices.map(c=>`${c.courseId}:${c.assignmentId}`));
  const records=new Set(s.canvasImports?.map(r=>r.key));
  const unmatched=b.courses.flatMap(c=>c.assignments.filter(a=>!selected.has(`${c.course.id}:${a.id}`)).map(a=>({
    key:`${c.course.id}:${a.id}`,name:a.name,course:c.course.code,isNew:!records.has(canvasKey(b,c.course.id,a.id)),
  })));
  return {
    grades:actions.filter(a=>a.kind==="grade"),
    protected:actions.filter(a=>a.kind==="protected"),
    attention:actions.filter(a=>a.kind==="attention"),
    otherChanges:actions.filter(a=>a.changed&&a.kind!=="grade"&&a.kind!=="protected"),
    unchanged:actions.filter(a=>!a.changed&&!["protected","attention","summary"].includes(a.kind||"")),
    unmatched,
  };
}
