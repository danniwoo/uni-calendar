import assert from "node:assert/strict";
import {calendar,mergeSemester,type Semester,type Task} from "../lib/semester";
import {assessmentDeletionTasks,canDeleteAssessment,deleteAssessment,undoAssessmentDeletion} from "../lib/assessment-delete";
import {backupText,readBackup} from "../lib/backup";
import {reconcile} from "../lib/sync";
import {subjectAssessments} from "../lib/subject-view";

const task=(id:string,patch:Partial<Task>={}):Task=>({id,kind:"assessment",manual:true,unit:"TEST1001",title:id,weight:"10%",timing:"Added by you",description:"",source:"",sourceText:"",hurdle:false,group:false,...patch});
const root=task("manual-project",{done:true,grade:{earned:14,possible:20}});
const imported=task("outline-quiz",{source:"https://example.test/outline",overrides:["title"]});
const s:Semester={year:2026,session:"S2C",boardGeneration:"test-board",weeks:calendar(2026,"S2C"),units:[{code:"TEST1001",name:"Synthetic unit",session:"S2C",outline:"",summary:"",status:"ready",assessments:[imported],topics:[]}],tasks:[root,imported,task("manual-other")],classes:[],completed:{},feedUrl:"",importedAt:"2026-10-20",warnings:[]};
const snapshot=structuredClone(s);
assert(canDeleteAssessment(s,root.id));
assert(!canDeleteAssessment(s,"manual-unsaved"));
assert(!canDeleteAssessment(s,imported.id),"editing an imported task does not grant delete");
for(const item of [task("manual-event",{kind:"event"}),task("manual-task",{kind:"task"}),task("canvas-1",{source:"https://example.test/canvas"}),task("manual-child",{parentId:root.id}),task("manual-occurrence",{series:root.id})]) {
 const board={...s,tasks:[...s.tasks,item]};
 assert(!canDeleteAssessment(board,item.id));assert.throws(()=>deleteAssessment(board,item.id,board));
}
const sourceCollision={...s,units:[{...s.units[0],assessments:[root]}]};
assert(!canDeleteAssessment(sourceCollision,root.id),"source membership wins over manual prefix");
const removed=deleteAssessment(s,root.id,s);
assert(!removed.tasks.some(t=>t.id===root.id));
assert.deepEqual(s,snapshot,"delete is immutable");
assert.deepEqual(removed.tasks,[imported,s.tasks[2]]);
assert(!subjectAssessments(removed,"TEST1001").some(t=>t.id===root.id));
assert.deepEqual(readBackup(backupText(removed)).tasks,removed.tasks,"deletion survives backup/reload");
assert(!mergeSemester(removed,{...structuredClone(s),tasks:[imported]}).tasks.some(t=>t.id===root.id),"refresh does not restore a manual creation");
assert.deepEqual(undoAssessmentDeletion(s,removed,removed).tasks.find(t=>t.id===root.id),root,"undo restores marks/completion");

const grouped={...s,tasks:[...s.tasks,task("part-1",{parentId:root.id}),task("part-2",{series:root.id,routine:true}),task("nested",{parentId:"part-1"})],canvasAccountId:"91",canvasImports:[{key:"91:101:1",targetId:root.id,mode:"overall" as const,lastGrade:{earned:14,possible:20},readAt:"2026-10-20T01:00:00Z"}]};
assert.equal(assessmentDeletionTasks(grouped,root.id).length,4);
const removedGroup=deleteAssessment(grouped,root.id,grouped);
assert.deepEqual(removedGroup.tasks,[imported,s.tasks[2]],"all descendants removed without touching other assessments");
assert.deepEqual(removedGroup.canvasImports,grouped.canvasImports,"retain anti-recreation/import mapping ledger");
assert.deepEqual(readBackup(backupText(removedGroup)).canvasImports,grouped.canvasImports);
assert.deepEqual(undoAssessmentDeletion(grouped,removedGroup,removedGroup).tasks.find(t=>t.id==="part-2"),grouped.tasks.find(t=>t.id==="part-2"));
const protectedChild={...grouped,units:[{...s.units[0],assessments:[grouped.tasks[3]]}]};
assert.throws(()=>deleteAssessment(protectedChild,root.id,protectedChild),/source-defined/);

const changed=structuredClone(s);changed.tasks[0].description="Changed in another tab";
assert.throws(()=>deleteAssessment(changed,root.id,s),/changed/);
const changedSteps={...grouped,tasks:[...grouped.tasks,task("new-part",{parentId:root.id})]};
assert.throws(()=>deleteAssessment(changedSteps,root.id,grouped),/changed/);
assert.throws(()=>deleteAssessment({...s,boardGeneration:"replacement"},root.id,s),/board changed/);
const unrelated=structuredClone(s);unrelated.tasks[2].description="Keep this newer edit";
assert.equal(deleteAssessment(unrelated,root.id,s).tasks[1].description,"Keep this newer edit");
const afterOtherEdit=structuredClone(removed);afterOtherEdit.tasks[1].description="After delete";
assert.equal(undoAssessmentDeletion(s,removed,afterOtherEdit).tasks.find(t=>t.id==="manual-other")?.description,"After delete");
assert.throws(()=>undoAssessmentDeletion(s,removed,{...removed,boardGeneration:"replacement"}),/board changed/);
assert.throws(()=>undoAssessmentDeletion(s,removed,{...removed,tasks:[...removed.tasks,{...root,title:"Newer task"}]}),/overwrite/);
assert(reconcile(s,removed,changed).conflicts.length,"concurrent target edit vs deletion must conflict");
assert.equal(reconcile(s,removed,unrelated).conflicts.length,0,"unrelated changes merge safely");
console.log("PASS: manual-only deletion, source/child protection, cascade, grade/completion undo, backup/refresh, retained import ledger, stale confirmation and conflict-aware undo.");
