import type { Grade, Semester, Task } from "./semester";
import { subjectAssessments } from "./subject-view";
import { isPersonal } from "./personal-items";
import { validGrade } from "./grade-value";

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
  let earned=0,gradedWeight=0,totalWeight=0,gradedCount=0;
  const issues: {task:Task; reason:string}[]=[];
  for (const t of roots) {
    const weight=gradeWeight(t);
    if (weight===null) {issues.push({task:t,reason:t.rules?.optional?"Optional / bonus rules need review":"Assessment weight needs review"});continue;}
    totalWeight+=weight;
    if (t.grade!=null && !validGrade(t.grade)) {issues.push({task:t,reason:"Invalid grade needs review"});continue;}
    if (validGrade(t.grade) && weight>0) {
      gradedWeight+=weight;earned+=t.grade.earned/t.grade.possible*weight;gradedCount++;
    }
  }
  const complete=roots.length>0 && !issues.length && Math.abs(totalWeight-100)<0.01;
  return {earned,gradedWeight,gradedCount,totalWeight,issues,complete,
    average:gradedWeight>0?earned/gradedWeight*100:null,
    remaining:Math.max(0,100-gradedWeight),hurdles:roots.filter(t=>t.hurdle)};
}

export function gradeTarget(stats: ReturnType<typeof unitGrades>, target:number) {
  if (!stats.complete) return {status:"incomplete" as const};
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
  if (JSON.stringify(task.grade??null)!==JSON.stringify(expected??null)) throw new Error("This grade changed elsewhere. Cancel and reopen to review the latest score before editing.");
  const existing=s.tasks.some(t=>t.id===id);
  // Store imported aggregate overrides by ID, without turning them into manual schedules.
  return {...s,tasks:existing?s.tasks.map(t=>t.id===id?{...t,grade}:t):[...s.tasks,{...task,grade}]};
}
