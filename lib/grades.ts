import type { Grade, GradePlan, Semester, Task } from "./semester";
import { subjectAssessments } from "./subject-view";
import { isPersonal } from "./personal-items";
import { validGrade, validGradePlan } from "./grade-value";

export function partGrade(plan:GradePlan) {
  const items=plan.items.filter(i=>!i.excluded), marked=items.filter(i=>validGrade(i.grade));
  const base={recorded:marked.length,total:items.length,finished:!plan.canvasPendingReview&&items.length>0&&marked.length===items.length};
  const invalid=!validGradePlan(plan)?"Check the individual grade entries.":!items.length?"Include at least one graded item.":
    plan.method==="weighted" && (items.some(i=>!i.weight)||Math.abs(items.reduce((s,i)=>s+(i.weight||0),0)-100)>0.01)?"Part weights must be filled in and total 100% of this assessment.":
    plan.method==="best" && (!plan.bestCount||plan.bestCount>items.length)?"Choose how many results count (no more than the included items).":null;
  if (invalid || !marked.length) return {...base,ratio:null,error:invalid,earned:null,possible:null};
  let earned=0,possible=0;
  if (plan.method==="points") {
    earned=marked.reduce((s,i)=>s+i.grade!.earned,0);possible=marked.reduce((s,i)=>s+i.grade!.possible,0);
  } else {
    const counted=plan.method==="best"?[...marked].sort((a,b)=>b.grade!.earned/b.grade!.possible-a.grade!.earned/a.grade!.possible).slice(0,plan.bestCount):marked;
    for (const i of counted) {const w=plan.method==="weighted"?i.weight!:1;earned+=i.grade!.earned/i.grade!.possible*w;possible+=w;}
  }
  return {...base,ratio:earned/possible,error:null,earned,possible};
}

export function assessmentGrade(t:Task) {
  if (t.gradePlan?.mode==="parts") return {...partGrade(t.gradePlan),source:"parts" as const};
  const g=validGrade(t.grade)?t.grade:null;
  return {ratio:g?g.earned/g.possible:null,finished:!!g,recorded:g?1:0,total:1,error:t.grade!=null&&!g?"Invalid grade needs review":null,earned:g?.earned??null,possible:g?.possible??null,source:"overall" as const};
}

export function seedGradePlan(s:Semester,t:Task):GradePlan {
  if (t.gradePlan) return structuredClone(t.gradePlan);
  const children=s.tasks.filter(c=>c.unit===t.unit&&(c.parentId===t.id||c.series===t.id)).sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.week||0)-(b.week||0));
  const count=Math.max(1,Math.min(200,t.splitCount||t.rules?.count||2));
  return {mode:"parts",method:"points",items:children.length?children.map(c=>({id:c.id,name:`${c.title}${c.week?` · W${c.week}`:c.date?` · ${c.date}`:""}`,grade:c.grade??null})):
    Array.from({length:count},(_,i)=>({id:`part-${i+1}`,name:`Part ${i+1}`}))};
}

export function saveGradePlan(s:Semester,id:string,plan:GradePlan,expected:GradePlan|null|undefined):Semester {
  if (!validGradePlan(plan)) throw new Error("Check item names, scores and maximum marks. Blank scores mean unrecorded, not zero.");
  const t=s.units.flatMap(u=>subjectAssessments(s,u.code)).find(t=>t.id===id&&!isPersonal(t));
  if (!t) throw new Error("This assessment was removed. Reopen the grade list.");
  if (JSON.stringify(t.gradePlan??null)!==JSON.stringify(expected??null)) throw new Error("Individual grades changed elsewhere. Cancel and reopen to review the latest entries.");
  const {canvasPendingReview:_,...reviewed}=plan;
  const task={...t,gradePlan:reviewed};
  return {...s,tasks:s.tasks.some(t=>t.id===id)?s.tasks.map(t=>t.id===id?task:t):[...s.tasks,task]};
}

// Never parse "3% each", ranges, bonus text or an orphan occurrence as a unit weight.
export function gradeWeight(t: Task): number | null {
  if (isPersonal(t) || t.parentId || t.series || t.rules?.optional) return null;
  const match=t.weight.trim().match(/^(\d+(?:\.\d+)?)\s*%(?:\s+total)?$/i);
  const weight=match?Number(match[1]):null;
  if (weight===null || weight>100) return null;
  if (t.rules?.total!==undefined && Math.abs(t.rules.total-weight)>0.01) return null;
  return weight;
}

export function unitGrades(s: Semester, unit: string) {
  // All roots, including hidden recurring: never use the filtered display rows.
  const roots=subjectAssessments(s,unit).filter(t=>!isPersonal(t));
  let earned=0,gradedWeight=0,totalWeight=0,gradedCount=0,currentPoints=0,currentWeight=0,currentCount=0,pendingGroups=0;
  const issues: {task:Task; reason:string}[]=[];
  for (const t of roots) {
    const weight=gradeWeight(t);
    if (weight===null) {issues.push({task:t,reason:t.rules?.optional?"Optional / bonus rules need review":"Assessment weight needs review"});continue;}
    totalWeight+=weight;
    const result=assessmentGrade(t);
    if (result.error) {issues.push({task:t,reason:result.error});continue;}
    if (result.ratio!==null && weight>0) {
      currentPoints+=result.ratio*weight;currentWeight+=weight;currentCount++;
      if(result.finished) {gradedWeight+=weight;earned+=result.ratio*weight;gradedCount++;}
      else pendingGroups++;
    }
  }
  const complete=roots.length>0 && !issues.length && Math.abs(totalWeight-100)<0.01;
  return {earned,gradedWeight,gradedCount,totalWeight,issues,complete,currentWeight,currentCount,pendingGroups,
    average:currentWeight>0?currentPoints/currentWeight*100:null,
    remaining:Math.max(0,100-gradedWeight),hurdles:roots.filter(t=>t.hurdle)};
}

export function gradeTarget(stats: ReturnType<typeof unitGrades>, target:number) {
  if (!stats.complete) return {status:"incomplete" as const};
  if (stats.pendingGroups) return {status:"inprogress" as const};
  const gap=target-stats.earned;
  if (gap<=0) return {status:"reached" as const};
  if (stats.remaining<=0) return {status:"finished" as const};
  const average=gap/stats.remaining*100;
  return average>100+1e-8?{status:"unreachable" as const}:{status:"needed" as const,average};
}

export function saveGrade(s:Semester, id:string, grade:Grade|null, expected:Grade|null|undefined):Semester {
  if (grade!==null && !validGrade(grade)) throw new Error("Enter a score from 0 to the maximum, with a maximum greater than 0.");
  const task=s.units.flatMap(u=>subjectAssessments(s,u.code)).find(t=>t.id===id && !isPersonal(t));
  if (!task) throw new Error("This assessment changed or was removed. Reopen it before entering a grade.");
  if (task.gradePlan?.mode==="parts") throw new Error("This assessment is calculated from individual grades. Switch its grade source to Overall result first.");
  if (JSON.stringify(task.grade??null)!==JSON.stringify(expected??null)) throw new Error("This grade changed elsewhere. Cancel and reopen to review the latest score before editing.");
  const existing=s.tasks.some(t=>t.id===id);
  // Store imported aggregate overrides by ID, without turning them into manual schedules.
  return {...s,tasks:existing?s.tasks.map(t=>t.id===id?{...t,grade}:t):[...s.tasks,{...task,grade}]};
}
