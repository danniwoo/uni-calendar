import type {CanvasRule,GradePlan,Semester} from "./semester";
import {validGrade,validGradePlan} from "./grade-value";
import {canvasGrade,canvasKey,canvasTargets,type CanvasBundle,type CanvasChoice,type CanvasImportRecord} from "./canvas-import";
import {partGrade} from "./grades";

const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function validCanvasRule(value:unknown):value is CanvasRule {
  if(!value||typeof value!=="object")return false;
  const r=value as CanvasRule;
  return ["highest","completion"].includes(r.method)&&Number.isInteger(r.count)&&r.count>0&&r.count<=200
    &&(r.passMark===undefined||validGrade(r.passMark))
    &&(r.method==="highest"?r.bestCount===undefined&&r.completionPoints===undefined:
      Number.isInteger(r.bestCount)&&r.bestCount!>0&&r.bestCount!<=r.count&&typeof r.completionPoints==="number"&&Number.isFinite(r.completionPoints)&&r.completionPoints>0&&r.completionPoints<=1000000&&r.passMark===undefined);
}
export function validRuleRecord(r:Record<string,unknown>) {
  if(r.rule===undefined)return r.lastItem===undefined&&r.sourceRules===undefined;
  return r.mode==="part"&&validCanvasRule(r.rule)&&typeof r.sourceRules==="string"&&r.sourceRules.length<=20000
    &&!!r.lastItem&&validGradePlan({mode:"parts",method:"points",items:[r.lastItem]})
    &&(r.lastItem as {id:string}).id===`canvas:${r.key}`;
}
export const ruleDescription=(r:CanvasRule)=>r.method==="highest"?`Highest of ${r.count} attempts${r.passMark?` · threshold ${r.passMark.earned}/${r.passMark.possible}`:""}`:`Best ${r.bestCount} of ${r.count} · ${r.completionPoints} per confirmed submission`;
function configured(plan:GradePlan,r:CanvasRule) {
  return plan.mode==="parts"&&plan.method===r.method&&plan.items.length===r.count&&plan.bestCount===r.bestCount
    &&plan.completionPoints===r.completionPoints&&same(plan.passMark,r.passMark)&&!plan.attemptsClosed;
}
const placeholder=(id:string,n:number)=>({id:`canvas-rule-empty:${id}:${n}`,name:`Unlinked opportunity ${n}`,outcome:"unknown" as const});

// Runs against a cloned board. Stable source IDs, never occurrence order, own
// entries. Rule changes and user edits stop updates rather than guessing intent.
export function applyCanvasRules(s:Semester,b:CanvasBundle,choices:CanvasChoice[],records:Map<string,CanvasImportRecord>,actions:{key:string;text:string;changed:boolean}[]) {
  for(const targetId of new Set(choices.map(c=>c.targetId))) {
    const selected=choices.filter(c=>c.targetId===targetId),first=selected[0],rule=first.rule!;
    if(!validCanvasRule(rule)||selected.some(c=>!same(c.rule,rule)||c.unit!==first.unit||c.courseId!==first.courseId))throw new Error("Use one course, unit and confirmed rule per assessment.");
    const course=b.courses.find(c=>c.course.id===first.courseId),target=canvasTargets(s,first.unit).find(t=>t.id===targetId);
    if(!course||!target||!s.units.some(u=>u.code===first.unit))throw new Error("Choose an existing assessment in the selected unit.");
    if(selected.length>rule.count)throw new Error("Selected source items exceed the confirmed opportunity count.");
    const ledger=[...records.values()].filter(r=>r.targetId===targetId);
    const blocked=target.grade!==undefined||target.gradePlan!==undefined&&(!target.gradePlan||!configured(target.gradePlan,rule)||!ledger.length||ledger.some(r=>!same(r.rule,rule)))
      ||ledger.some(r=>!same(r.rule,rule));
    let plan:GradePlan=target.gradePlan?structuredClone(target.gradePlan):{mode:"parts",method:rule.method,
      ...(rule.bestCount?{bestCount:rule.bestCount}:{}),...(rule.completionPoints?{completionPoints:rule.completionPoints}:{}),...(rule.passMark?{passMark:rule.passMark}:{}),
      items:Array.from({length:rule.count},(_,i)=>placeholder(targetId,i+1))};
    let updated=false;
    for(const choice of selected) {
      const a=course.assignments.find(a=>a.id===choice.assignmentId);if(!a)throw new Error("Canvas item no longer exists in this file. Review again.");
      const key=canvasKey(b,course.course.id,a.id),prior=records.get(key),itemId=`canvas:${key}`;
      const keep=(reason:string)=>actions.push({key,text:`${target.title} → ${a.name}: ${reason}; unchanged`,changed:false});
      if(prior&&(prior.targetId!==targetId||prior.mode!=="part"||!same(prior.rule,rule)))throw new Error("This Canvas item is already linked with a different target or rule. Existing mapping preserved.");
      if(blocked){keep("manual / existing grade or rule setup protected");continue;}
      const sourceRules=JSON.stringify({unavailable:course.groupsUnavailable,group:course.groups.find(g=>g.id===a.groupId)||null});
      if(prior?.sourceRules!==undefined&&prior.sourceRules!==sourceRules){keep("Canvas group rules changed — review required");continue;}
      if(prior?.readAt&&Date.parse(course.fetchedAt)<Date.parse(prior.readAt)){keep("older source ignored");continue;}
      const current=plan.items.find(i=>i.id===itemId);
      if(prior&&(!prior.readAt||prior.manual||!current||!same(current,prior.lastItem))){keep("manual / removed entry protected");continue;}
      if(current&&!prior){keep("existing entry has no source baseline");continue;}
      const grade=canvasGrade(a);
      const complete=a.result==="complete"&&a.submission?.released&&!a.submission.excused&&a.submission.currentAttemptGraded!==false&&!a.omitted;
      if(choice.outcome&&!["missed","not_taken"].includes(choice.outcome))throw new Error("Invalid explicit outcome.");
      if(choice.outcome&&(grade||complete||choice.outcome==="missed"&&rule.method!=="completion"||choice.outcome==="not_taken"&&rule.method!=="highest"))throw new Error("Explicit outcome conflicts with the source result or grading rule.");
      if(a.omitted||a.submission?.excused){keep("excluded / excused source needs separate review");continue;}
      if(current?.maximum!==undefined&&a.pointsPossible!==null&&current.maximum!==a.pointsPossible){keep("source maximum changed — review required");continue;}
      // Hidden/unavailable results never clear an existing result or become zero.
      const item:GradePlan["items"][number]=current?{...current}:{id:itemId,name:a.name.slice(0,300),...(a.pointsPossible&&a.pointsPossible>0?{maximum:a.pointsPossible}:{}),outcome:"unknown"};
      if(rule.method==="highest"&&grade)item.grade=grade;
      if(rule.method==="completion"&&complete)item.outcome="submitted";
      if(choice.outcome)item.outcome=choice.outcome;
      if(current&&same(current,item)){keep("no new applicable result");continue;}
      if(!current) {
        const index=plan.items.findIndex(i=>i.id.startsWith(`canvas-rule-empty:${targetId}:`)&&same(i,placeholder(targetId,Number(i.id.split(":").at(-1)))));
        if(index<0){keep("no untouched slot available — review the count / entries");continue;}
        plan.items[index]=item;
      }else plan.items=plan.items.map(i=>i.id===itemId?item:i);
      records.set(key,{key,targetId,mode:"part",rule:structuredClone(rule),readAt:course.fetchedAt,lastItem:structuredClone(item),sourceRules,
        ...(item.grade?{lastGrade:item.grade}:{}),...(choice.outcome==="missed"?{manual:true}:{})});
      const label=rule.method==="highest"&&item.grade?`${item.grade.earned}/${item.grade.possible}`:item.outcome==="submitted"?`Complete → ${rule.completionPoints}`:item.outcome==="missed"?"Confirmed by you: missed → 0":item.outcome==="not_taken"?"Not taken · no zero":"Unconfirmed · no zero";
      actions.push({key,text:`${target.title} → ${a.name}: ${label} · ${ruleDescription(rule)}; dates, weight and calendar completion kept`,changed:true});updated=true;
    }
    if(updated) {
      if(!validGradePlan(plan))throw new Error("Invalid rule import. Nothing saved.");
      const next={...target,gradePlan:plan},index=s.tasks.findIndex(t=>t.id===targetId);
      if(index>=0)s.tasks[index]=next;else s.tasks.push(next);
      const result=partGrade(plan);
      actions.push({key:`summary:${targetId}`,text:`${first.unit} · ${target.title}: ${result.earned===null?"No result":`${result.earned}/${result.possible}`} · ${result.finished?"settled result":"in progress, not final"} · ${plan.items.filter(i=>i.id.startsWith("canvas-rule-empty:")).length} opportunities not linked to Canvas`,changed:false});
    }
  }
}
