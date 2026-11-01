import type {GradePlan,Semester,Task} from "./semester";
import {saveGradePlan,seedGradePlan} from "./grades";
import {subjectAssessments} from "./subject-view";
import {availabilityError,validDate} from "./assessment-schedule";
import {reminderError} from "./reminders";
import {taskTimingKeys} from "./task-timing";

export type AttemptSchedule = {itemId:string; task?:Task; existingId?:string};
export const attemptParent = (s:Semester,t:Task) => t.attemptId?s.tasks.find(p=>p.id===t.parentId):t;
export const supportsAttempts = (t:Task) => !t.parentId&&!t.series&&(t.kind==="quiz"||!!t.rules?.attempts||t.gradePlan?.method==="highest");
export function attemptPlan(s:Semester,t:Task):GradePlan {
  if(t.gradePlan)return structuredClone(t.gradePlan);
  const seed=seedGradePlan(s,t);
  if(seed.items.some(i=>i.grade))return seed;
  // The explicit setup action, not a quiz title, confirms highest-attempt scoring.
  return {...seed,items:Array.from({length:Math.min(30,Math.max(1,t.rules?.attempts||seed.items.length))},(_,i)=>({id:crypto.randomUUID(),name:`Attempt ${i+1}`,maximum:undefined}))};
}
export function attemptLabel(item:GradePlan["items"][number],index:number){
  const explicit=item.name.match(/\battempt\s*(\d+)\b/i);
  return explicit?`Attempt ${explicit[1]}`:item.id.startsWith("canvas:")?item.name:`Attempt ${index+1}`;
}
export function attemptSchedules(s:Semester,t:Task,plan:GradePlan):AttemptSchedule[] {
  return plan.items.map(i=>{const task=s.tasks.find(c=>c.parentId===t.id&&c.attemptId===i.id);return {itemId:i.id,...(task?{task:structuredClone(task),existingId:task.id}:{})};});
}
export function newAttemptTask(parent:Task,index:number):Task {
  return {id:`attempt-${crypto.randomUUID()}`,parentId:parent.id,unit:parent.unit,title:`${parent.title} · Attempt ${index+1}`,kind:parent.kind==="quiz"?"quiz":"assessment",weight:"",timing:"Time not set",description:"",source:parent.source,sourceText:parent.sourceText,hurdle:false,group:false,manual:true,overrides:[]};
}
export function attemptLinksError(s:Semester):string {
  const seen=new Set<string>();
  for(const t of s.tasks){
    if(t.attemptId===undefined)continue;
    const parent=s.tasks.find(p=>p.id===t.parentId);
    const key=JSON.stringify([t.parentId,t.attemptId]);
    if(typeof t.attemptId!=="string"||!t.attemptId||t.attemptId.length>500||!parent||parent.unit!==t.unit||!parent.gradePlan?.items.some(i=>i.id===t.attemptId)||seen.has(key))return "An attempt schedule has an invalid or duplicate result link. Reopen attempts before saving.";
    seen.add(key);
  }
  return "";
}
export function attemptSnapshot(s:Semester,id:string){
  const parent=s.tasks.find(t=>t.id===id)||s.units.flatMap(u=>u.assessments).find(t=>t.id===id);
  return JSON.stringify([s.year,s.session,s.feedUrl,s.boardGeneration,parent,s.tasks.filter(t=>t.parentId===id||t.series===id),s.canvasImports?.filter(r=>r.targetId===id)]);
}
export function saveAttempts(s:Semester,id:string,plan:GradePlan,rows:AttemptSchedule[],expected:Semester):Semester {
  if(attemptSnapshot(s,id)!==attemptSnapshot(expected,id))throw new Error("This assessment changed while you were editing. Cancel and reopen; your saved data is unchanged.");
  const parent=subjectAssessments(s,s.tasks.find(t=>t.id===id)?.unit||s.units.find(u=>u.assessments.some(t=>t.id===id))?.code||"").find(t=>t.id===id);
  if(!parent||parent.parentId||parent.series)throw new Error("Open the whole assessment to manage attempts.");
  if(plan.method!=="highest"||plan.mode!=="parts")throw new Error("Confirm highest-attempt scoring before saving.");
  if(plan.items.length>30)throw new Error("Use the individual-grade editor for more than 30 attempts.");
  if(s.tasks.some(t=>t.series===id))throw new Error("Recurring submissions are not retakes. Keep their existing schedule.");
  if(rows.length!==plan.items.length||new Set(rows.map(r=>r.itemId)).size!==rows.length||rows.some(r=>!plan.items.some(i=>i.id===r.itemId)))throw new Error("The attempt list changed. Reopen it.");
  let next=JSON.stringify(plan)===JSON.stringify(parent.gradePlan)?structuredClone(s):saveGradePlan(structuredClone(s),id,plan,parent.gradePlan);
  if(!next.tasks.some(t=>t.id===id))next.tasks.push({...parent,gradePlan:plan});
  const chosen=rows.filter(r=>r.task),ids=chosen.map(r=>r.existingId||r.task!.id);
  if(new Set(ids).size!==ids.length)throw new Error("Each scheduled item can belong to only one attempt.");
  for(const row of chosen){
    const old=row.existingId===id?parent:s.tasks.find(t=>t.id===row.existingId);
    if(row.existingId&&(!old||old.id!==id&&old.parentId!==id||old.attemptId&&old.attemptId!==row.itemId))throw new Error("Choose a schedule from this assessment that is not linked to another attempt.");
    if(old&&old.id!==id&&!old.attemptId&&(old.weight||old.grade||old.gradePlan))throw new Error("This step has its own weight or result. Keep it separate; choose a schedule-only step or a new time.");
    if(!row.existingId&&s.tasks.some(t=>t.id===row.task!.id))throw new Error("A new schedule already exists. Reopen attempts.");
    if(row.task!.unit!==parent.unit||row.task!.time&&!row.task!.date||row.task!.date&&(!validDate(row.task!.date)||!s.weeks.some(w=>row.task!.date!>=w.start&&row.task!.date!<=w.end)))throw new Error("Choose a valid date in this semester, or leave just the teaching week.");
    if(row.task!.week&&!s.weeks.some(w=>w.number===row.task!.week))throw new Error("Choose a teaching week in this semester.");
    for(const time of [row.task!.time,row.task!.endTime])if(time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error("Check the attempt time.");
    if(row.task!.endTime&&(!row.task!.time||row.task!.endTime!<=row.task!.time))throw new Error("The end time must be after the start time.");
    const problem=availabilityError(row.task!)||reminderError(row.task!.reminders);if(problem)throw new Error(problem);
  }
  // Preserve the original scheduled item (including alerts/notes/completion),
  // even when the user schedules Attempt 2 first. Linking it is always explicit.
  let originalSchedule:Task|undefined;
  if(chosen.length&&!parent.splitCount&&(parent.date||parent.week||parent.reminders?.length)){
    const {grade:_,gradePlan:__,rules:___,splitCount:____,attemptId:_____,activity:______,...rest}=parent;
    originalSchedule={...rest,id:`attempt-time-${crypto.randomUUID()}`,parentId:id,title:`${parent.title} · Existing time`,weight:"",hurdle:false,group:false,splitPart:1,manual:true};
    next.tasks.push(originalSchedule);
  }
  for(const [index,item] of plan.items.entries()){
    const row=rows.find(r=>r.itemId===item.id)!;if(!row.task)continue;
    const existing=row.existingId===id?originalSchedule:next.tasks.find(t=>t.id===row.existingId);
    if(row.existingId===id&&!existing)throw new Error("There is no original assessment time to link.");
    const draft=row.task;
    const schedule:Task={...(existing||draft),title:`${parent.title} · ${attemptLabel(item,index)}`,parentId:id,attemptId:item.id,unit:parent.unit,
      ...Object.fromEntries(taskTimingKeys.map(k=>[k,draft[k]])),reminders:draft.reminders,
      weight:"",hurdle:false,manual:true,splitPart:existing?.splitPart||next.tasks.filter(t=>t.parentId===id).length+1,
      overrides:[...new Set([...(existing?.overrides||[]),"title","attemptId",...taskTimingKeys,"reminders"])]};
    if(existing)next.tasks=next.tasks.map(t=>t.id===existing.id?schedule:t);else next.tasks.push(schedule);
  }
  const children=next.tasks.filter(t=>t.parentId===id);
  if(children.length)next.tasks=next.tasks.map(t=>t.id===id?{...t,splitCount:children.length,...(!parent.splitCount?{date:undefined,time:undefined,endTime:undefined,week:undefined,dueWeek:undefined,reminders:[]}:{}),manual:true,
    overrides:[...new Set([...(t.overrides||[]),"splitCount",...(!parent.splitCount?[...taskTimingKeys,"reminders"]:[])])]}:t);
  if(next.tasks.length>2500)throw new Error("This board has reached its task limit.");
  const issue=attemptLinksError(next);if(issue)throw new Error(issue);
  return next;
}
