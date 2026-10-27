import type {Semester} from "./semester";
import {canvasGrade,canvasKey,canvasResultLabel,type CanvasBundle,type CanvasChoice} from "./canvas-import";

export type CanvasActionKind="grade"|"protected"|"attention"|"mapping"|"added"|"unchanged"|"summary";
export type CanvasAction={key:string;text:string;changed:boolean;kind?:CanvasActionKind};

// Offer already-confirmed rules as explicit choices, never as automatic matches.
// The planner still checks manual edits, slot capacity and source rule changes.
export function existingCanvasRuleChoices(s:Semester,b:CanvasBundle,courseId:string,unit:string) {
  if(s.canvasAccountId!==b.accountId)return [];
  const prefix=`${b.accountId}:${courseId}:`;
  const records=(s.canvasImports||[]).filter(r=>r.key.startsWith(prefix)&&r.rule);
  return [...new Set(records.map(r=>r.targetId))].flatMap(targetId=>{
    const t=s.tasks.find(t=>t.id===targetId&&t.unit===unit),r=records.find(r=>r.targetId===targetId)!;
    if(!t?.gradePlan||t.grade!==undefined||records.some(x=>x.targetId===targetId&&JSON.stringify(x.rule)!==JSON.stringify(r.rule)))return [];
    const plan=t.gradePlan,rule=r.rule!;
    if(plan.method!==rule.method||plan.items.length!==rule.count||plan.bestCount!==rule.bestCount||plan.completionPoints!==rule.completionPoints||JSON.stringify(plan.passMark)!==JSON.stringify(rule.passMark)||plan.attemptsClosed)return [];
    return [{target:t,rule:r.rule!}];
  });
}
export const defaultCanvasStage=(_s:Semester,_b:CanvasBundle)=>"prepared" as const;

// A newer export timestamp alone is not evidence that any course was refreshed.
// Never offer a different account, missing course or older course over a review.
export function isNewerCanvasBatch(current:CanvasBundle,incoming:CanvasBundle){
  if(current.accountId!==incoming.accountId)return false;
  const times=new Map(incoming.courses.map(c=>[c.course.id,Date.parse(c.fetchedAt)]));
  if(current.courses.some(c=>{const next=times.get(c.course.id);return next===undefined||next<Date.parse(c.fetchedAt);} ))return false;
  return incoming.courses.some(c=>{const old=current.courses.find(o=>o.course.id===c.course.id);return !old||Date.parse(c.fetchedAt)>Date.parse(old.fetchedAt);});
}

export function canvasResultsHeadline(grades:number,unconnected:number){
  const total=grades+unconnected;
  return total?`${total} Canvas ${total===1?"result":"results"} to review`:"No new results to review";
}

// Status comes from the planner, never from matching English warning strings.
export function canvasUpdateStatus(s:Semester,b:CanvasBundle,choices:CanvasChoice[],actions:CanvasAction[]) {
  const selected=new Set(choices.map(c=>`${c.courseId}:${c.assignmentId}`));
  const records=new Set(s.canvasImports?.map(r=>r.key));
  const unmatched=b.courses.flatMap(c=>c.assignments.filter(a=>!selected.has(`${c.course.id}:${a.id}`)).map(a=>({
    key:`${c.course.id}:${a.id}`,name:a.name,course:c.course.code,result:canvasResultLabel(a),isNew:!records.has(canvasKey(b,c.course.id,a.id)),hasResult:!!canvasGrade(a)||!!a.result&&!a.omitted&&!a.submission?.excused,
  })));
  return {
    grades:actions.filter(a=>a.kind==="grade"),
    protected:actions.filter(a=>a.kind==="protected"),
    attention:actions.filter(a=>a.kind==="attention"),
    otherChanges:actions.filter(a=>a.changed&&a.kind!=="grade"&&a.kind!=="protected"),
    unchanged:actions.filter(a=>!a.changed&&!["protected","attention","summary"].includes(a.kind||"")),
    unmatched,
    // An unlinked item is not necessarily new or actionable. Only released
    // results need a destination in the daily update flow; the rest is setup.
    resultsToConnect:unmatched.filter(a=>a.isNew&&a.hasResult),
    optionalLinks:unmatched.filter(a=>!a.isNew||!a.hasResult),
  };
}
