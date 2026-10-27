import type {GradePlan,Semester,Task} from "./semester";
import {canvasTargets} from "./canvas-import";
import {assessmentGrade} from "./grades";

const number=(n:number)=>String(Number(n.toFixed(2)));
type Item=GradePlan["items"][number];
function itemResult(item?:Item){
  if(item?.grade)return `${number(item.grade.earned)} / ${number(item.grade.possible)}`;
  if(item?.grade===null)return "Cleared";
  return ({submitted:"Complete",missed:"Missed",not_taken:"Not taken",awaiting:"Awaiting result",not_due:"Not due",unknown:"Not recorded"} as const)[item?.outcome||"unknown"];
}
function overall(t?:Task){return t?.grade?`${number(t.grade.earned)} / ${number(t.grade.possible)}`:t?.grade===null?"Cleared":t?.gradePlan?"Individual results":"Not recorded";}

// Read the two planner snapshots, never parse human-readable action text or
// mistake a Canvas Complete flag for a numeric grade / unit percentage.
export function canvasResultChange(before:Semester,after:Semester,key:string,unit:string,targetId:string,part:boolean){
  const target=(s:Semester)=>canvasTargets(s,unit).find(t=>t.id===targetId);
  const old=target(before),next=target(after);
  return part?{before:itemResult(old?.gradePlan?.items.find(i=>i.id===`canvas:${key}`)),after:itemResult(next?.gradePlan?.items.find(i=>i.id===`canvas:${key}`))}:
    {before:overall(old),after:overall(next)};
}

export function canvasAssessmentImpact(before:Semester,after:Semester,unit:string,id:string){
  const old=canvasTargets(before,unit).find(t=>t.id===id),next=canvasTargets(after,unit).find(t=>t.id===id);
  if(!next?.gradePlan)return null;
  const current=old?assessmentGrade(old):null,result=assessmentGrade(next),plan=next.gradePlan;
  const completion=plan.method==="completion",percent=["equal","weighted","best"].includes(plan.method);
  const label=(r:typeof result|null)=>!r||r.error||r.ratio===null?"Not recorded":percent?`${number(r.ratio*100)}%`:`${number(r.earned!)} / ${number(r.possible!)}`;
  const comparable=current&&!current.error&&!result.error&&current.ratio!==null&&result.ratio!==null&&(percent||current.possible===result.possible);
  const delta=comparable?(percent?(result.ratio!-current!.ratio!)*100:result.earned!-current!.earned!):null;
  const units=completion?"completion points":percent?"percentage points":"marks";
  const difference=delta===null?"":Math.abs(delta)<1e-9?"No total change":`${delta>0?"+":""}${number(delta)} ${units}`;
  return {id,title:next.title,before:label(current),after:label(result),difference,
    units:percent?"":units,pending:!result.finished,error:result.error,
    rule:completion?`Up to ${plan.bestCount} completions × ${plan.completionPoints} points each`:
      plan.method==="highest"?"Highest attempt":plan.method==="points"?"Total earned marks ÷ total possible marks":plan.method==="equal"?"Each item counts equally":plan.method==="best"?`Best ${plan.bestCount} results`:"Weighted individual results",
    unlinked:plan.items.filter(i=>i.id.startsWith("canvas-rule-empty:")).length};
}
