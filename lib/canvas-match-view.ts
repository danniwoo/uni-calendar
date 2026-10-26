import type {Task} from "./semester";
import {canvasGrade,type CanvasAssignment,type CanvasChoice,type CanvasCourse,type CanvasImportRecord} from "./canvas-import";
import type {CanvasAction} from "./canvas-update-status";

// Presentation only. A Canvas group is never a target or a calculation rule.
// Keep orphaned/missing-group items visible without guessing their membership.
export function canvasMatchSections(course:CanvasCourse,rows:CanvasAssignment[],choices:Record<string,CanvasChoice>,targets:Task[],records:CanvasImportRecord[]=[]){
  const ids=[...new Set(rows.map(a=>a.groupId))];
  return ids.map(id=>{
    const group=course.groups.find(g=>g.id===id),items=rows.filter(a=>a.groupId===id);
    const selected=items.flatMap(a=>{const c=choices[`${course.course.id}:${a.id}`];return c?[c]:[];});
    const contextItems=course.assignments.filter(a=>a.groupId===id);
    const linked=contextItems.flatMap(a=>{const r=records.find(r=>r.key.endsWith(`:${course.course.id}:${a.id}`));return r?[{source:a,record:r,target:targets.find(t=>t.id===r.targetId)}]:[];});
    const destinationIds=contextItems.map(a=>choices[`${course.course.id}:${a.id}`]?.targetId||records.find(r=>r.key.endsWith(`:${course.course.id}:${a.id}`))?.targetId);
    const destinations=[...new Set(destinationIds)].flatMap(id=>{const t=targets.find(t=>t.id===id);return t?[t]:[];});
    return {id:id||"ungrouped",name:group?.name||"Other Canvas items",weight:group?.weight,items,destinations,linked,selectedCount:selected.length};
  });
}

export function canvasMatchStatus(choice:CanvasChoice|undefined,prior:CanvasImportRecord|undefined,action?:CanvasAction,source?:CanvasAssignment){
  if(!choice)return prior?"Linked · skipped this check":"Not linked · optional";
  if(action?.kind==="protected")return "Manual data protected";
  if(action?.kind==="attention")return "Needs review";
  if(action?.kind==="grade")return prior?"Linked · new result":"New result · review match";
  if(prior)return source&&(canvasGrade(source)||source.result)?"Linked · result unchanged":"Linked · waiting for a result";
  return "Proposed link · not saved";
}

export function canvasTargetLabel(t:Task){return `${t.title} · ${t.weight||"weight unknown"}`;}

// UI default only, after the user chooses a destination. It does not create a link.
export function simpleCanvasDestination(t:Task,tasks:Task[]){
  return t.kind!=="recurring"&&!t.series&&!t.gradePlan&&!tasks.some(child=>child.parentId===t.id);
}
