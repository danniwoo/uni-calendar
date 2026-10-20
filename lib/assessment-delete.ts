import type {Semester, Task} from "./semester";
import {reconcile} from "./sync";

// `manual` also marks edits to imported assessments. Creation IDs, source
// membership and root ownership must agree before offering whole-item deletion.
export function canDeleteAssessment(s:Semester, id:string):boolean {
  const t=s.tasks.find(t=>t.id===id);
  return !!t && t.manual===true && t.id.startsWith("manual-")
    && t.kind!=="task" && t.kind!=="event" && !t.parentId && !t.series
    && !s.units.some(u=>u.assessments.some(a=>a.id===id));
}

export function assessmentDeletionTasks(s:Semester, id:string):Task[] {
  if(!canDeleteAssessment(s,id))return [];
  const ids=new Set([id]);
  let count=0;
  while(count!==ids.size) {
    count=ids.size;
    for(const t of s.tasks)
      if((t.parentId&&ids.has(t.parentId))||(t.series&&ids.has(t.series)))ids.add(t.id);
  }
  return s.tasks.filter(t=>ids.has(t.id));
}

function sameBoard(a:Semester,b:Semester) {
  return a.year===b.year && a.session===b.session && a.feedUrl===b.feedUrl
    && a.boardGeneration===b.boardGeneration && a.canvasAccountId===b.canvasAccountId;
}

export function deleteAssessment(s:Semester,id:string,expected:Semester):Semester {
  if(!sameBoard(s,expected))throw new Error("The board changed. Reopen the assessment before deleting.");
  const tasks=assessmentDeletionTasks(s,id),reviewed=assessmentDeletionTasks(expected,id);
  if(!tasks.length)throw new Error("Only a saved assessment you created can be deleted here. Edit individual steps from their parent assessment.");
  if(JSON.stringify(tasks)!==JSON.stringify(reviewed))
    throw new Error("This assessment or its steps changed. Review them again before deleting.");
  // Do not remove a source-defined descendant if an imported/legacy board has
  // an unexpected relationship. Keep the deletion boundary conservative.
  const ids=new Set(tasks.map(t=>t.id));
  if(s.units.some(u=>u.assessments.some(a=>ids.has(a.id))))
    throw new Error("This assessment includes source-defined items. They cannot be deleted here.");
  // Retain Canvas import ledgers: removing the target must not permit an old
  // import file to recreate it or silently reassign its source records.
  return {...s,tasks:s.tasks.filter(t=>!ids.has(t.id))};
}

export function undoAssessmentDeletion(before:Semester,after:Semester,current:Semester):Semester {
  if(!sameBoard(after,current))throw new Error("The board changed. Undo is no longer available for this board.");
  const result=reconcile(after,before,current);
  if(result.conflicts.length)throw new Error("These items changed after deletion. Undo would overwrite newer changes.");
  return result.semester;
}
