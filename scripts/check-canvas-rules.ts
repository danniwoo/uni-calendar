import assert from "node:assert/strict";
import {fixtureBoard,fixtureBundle} from "./fixtures/canvas-connect";
import {planCanvasImport,suggestCanvasMatches,validCanvasMetadata,type CanvasChoice} from "../lib/canvas-import";
import {partGrade,saveGradePlan} from "../lib/grades";
import {backupText,readBackup} from "../lib/backup";
import type {CanvasRule} from "../lib/semester";
import {existingCanvasRuleChoices,defaultCanvasStage} from "../lib/canvas-update-status";

// Invented scores and identifiers, not a student's export.
const board=structuredClone(fixtureBoard),bundle=structuredClone(fixtureBundle),course=bundle.courses[2];
course.assignments[0].name="Quiz alpha";course.assignments[1].name="Quiz alpha attempt 2";
course.assignments[1].groupId="6";
course.groups.push({...structuredClone(course.groups[0]),id:"6",name:"Other group"});
const highest:CanvasRule={method:"highest",count:3,passMark:{earned:7,possible:10}};
const choices:CanvasChoice[]=course.assignments.map(a=>({courseId:course.course.id,assignmentId:a.id,unit:"ELEC2302",targetId:"root-2",mode:"part",rule:highest,...(a.id==="2"?{outcome:"not_taken" as const}:{})}));
const before=JSON.stringify(board),first=planCanvasImport(board,bundle,choices),root=()=>first.semester.tasks.find(t=>t.id==="root-2")!;
assert.equal(JSON.stringify(board),before);assert.equal(first.changed,2);
assert.equal(root().gradePlan!.items.length,3);assert.equal(partGrade(root().gradePlan!).earned,7);assert.equal(partGrade(root().gradePlan!).finished,false);
assert.equal(root().gradePlan!.items[1].grade,undefined);assert.equal(root().gradePlan!.items[1].outcome,"not_taken");
for(const key of ["date","time","weight","description","done"] as const)assert.equal(root()[key],board.tasks[2][key]);
assert.deepEqual(first.semester.completed,board.completed);assert.equal(first.semester.tasks.length,board.tasks.length);
assert.equal(planCanvasImport(first.semester,bundle,choices).changed,0);
const suggested=Object.values(suggestCanvasMatches(first.semester,bundle).choices).filter(c=>c.rule);
assert.equal(suggested.length,2);assert.deepEqual(suggested[0].rule,highest);
const newer=structuredClone(bundle),newCourse=newer.courses[2];newCourse.fetchedAt="2026-10-22T00:00:00Z";
Object.assign(newCourse.assignments[1].submission!,{released:true,score:9,releaseEvidence:"marks-page"});
const update=planCanvasImport(first.semester,newer,suggested);
assert.equal(update.changed,1);assert.equal(partGrade(update.semester.tasks[2].gradePlan!).earned,9);
assert.equal(planCanvasImport(update.semester,bundle,suggested).changed,0,"stale source cannot roll back");
const future={...structuredClone(newCourse.assignments[0]),id:"3",name:"Quiz alpha attempt 3"};newCourse.assignments.push(future);
const added=planCanvasImport(update.semester,newer,[...suggested,{...suggested[0],assignmentId:"3"}]);
assert.equal(added.semester.tasks[2].gradePlan!.items.length,3);assert.equal(partGrade(added.semester.tasks[2].gradePlan!).finished,true);
assert.equal(planCanvasImport(added.semester,newer,[...suggested,{...suggested[0],assignmentId:"3"}]).changed,0);
assert.throws(()=>planCanvasImport(board,bundle,[...choices,{...choices[0],assignmentId:"99"}]),/no longer exists/);
assert.equal(JSON.stringify(board),before);
assert.throws(()=>planCanvasImport(board,bundle,[choices[0],{...choices[1],rule:{...highest,count:2}}]),/one course/);
assert.throws(()=>planCanvasImport(board,bundle,[choices[0],{...choices[1],rule:undefined,method:"points"}]),/Do not mix/);

for(const grade of [null,{earned:2,possible:10}]) {
  const manual=structuredClone(board);manual.tasks[2].grade=grade;
  assert.equal(planCanvasImport(manual,bundle,choices).changed,0);
}
const manualPlan=structuredClone(board);manualPlan.tasks[2].gradePlan=structuredClone(root().gradePlan!);
assert.equal(planCanvasImport(manualPlan,bundle,choices).changed,0,"pre-existing manual rule never adopted silently");
for(const mutate of [(p:any)=>p.items[0].grade=null,(p:any)=>p.items[0].outcome="missed",(p:any)=>p.items[0].name="My title",(p:any)=>p.items.splice(0,1),(p:any)=>p.passMark={earned:8,possible:10}]) {
  const p=structuredClone(root().gradePlan!);mutate(p);
  const edited=saveGradePlan(first.semester,"root-2",p,root().gradePlan);
  const applied=planCanvasImport(edited,newer,suggested);
  assert.deepEqual(applied.semester.tasks[2].gradePlan!.items[0],p.items[0],"manual entry preserved");
}
const changedRules=structuredClone(bundle);changedRules.courses[2].groups[0].rules.dropLowest=1;
assert.equal(planCanvasImport(first.semester,changedRules,suggested).changed,0);
assert(planCanvasImport(first.semester,changedRules,suggested).actions.some(a=>a.text.includes("rules changed")));
const changedMax=structuredClone(newer);changedMax.courses[2].assignments[0].pointsPossible=20;
const maximumReview=planCanvasImport(first.semester,changedMax,suggested);
assert.equal(maximumReview.semester.tasks[2].gradePlan!.items[0].maximum,10);
assert(maximumReview.actions.some(a=>a.text.includes("maximum changed")));
const clearedOverall=structuredClone(first.semester);clearedOverall.tasks[2].grade=null;
assert.equal(planCanvasImport(clearedOverall,newer,suggested).changed,0);

const cb=structuredClone(bundle),cc=cb.courses[2];cc.groups[0].rules.dropLowest=2;
cc.assignments=Array.from({length:7},(_,i)=>({...structuredClone(cc.assignments[0]),id:String(20+i),name:`Preparation ${i+1}`,result:i<4?"complete" as const:undefined,submission:{...cc.assignments[0].submission!,score:null,released:i<4,releaseEvidence:i<4?"marks-page":null}}));
const completion:CanvasRule={method:"completion",count:10,bestCount:8,completionPoints:.5};
const compChoices:CanvasChoice[]=cc.assignments.map((a,i)=>({...choices[0],assignmentId:a.id,rule:completion,...(i===4?{outcome:"missed" as const}:{})}));
const cp=planCanvasImport(board,cb,compChoices),plan=cp.semester.tasks[2].gradePlan!;
assert.equal(partGrade(plan).earned,2);assert.equal(partGrade(plan).possible,4);assert.equal(partGrade(plan).recorded,5);assert.equal(partGrade(plan).finished,false);
assert.equal(plan.items.filter(i=>i.outcome==="unknown").length,5);assert.equal(plan.items[4].outcome,"missed");
assert.equal(planCanvasImport(cp.semester,cb,compChoices).changed,0);
const completionSuggestions=Object.values(suggestCanvasMatches(cp.semester,cb).choices).filter(c=>c.rule);
const changed=structuredClone(cb);changed.courses[2].fetchedAt="2026-10-23T00:00:00Z";
for(const i of [4,5]){changed.courses[2].assignments[i].result="complete";changed.courses[2].assignments[i].submission!.released=true;}
const completionUpdate=planCanvasImport(cp.semester,changed,completionSuggestions);
assert.equal(completionUpdate.semester.tasks[2].gradePlan!.items[4].outcome,"missed","user confirmed miss requires conflict review, not overwrite");
assert.equal(completionUpdate.semester.tasks[2].gradePlan!.items[5].outcome,"submitted");
assert.equal(partGrade(completionUpdate.semester.tasks[2].gradePlan!).earned,2.5);
const noResults=structuredClone(cb);for(const a of noResults.courses[2].assignments){a.result=undefined;a.submission!.released=false;}
assert.equal(planCanvasImport(cp.semester,noResults,completionSuggestions).changed,0,"hidden results never clear earned outcomes");
const numeric=structuredClone(cb);numeric.courses[2].assignments[5].submission={...numeric.courses[2].assignments[0].submission!,score:1};
assert.equal(planCanvasImport(cp.semester,numeric,completionSuggestions).semester.tasks[2].gradePlan!.items[5].outcome,"unknown","numeric mark alone is not proof of submission rule");
assert.throws(()=>planCanvasImport(board,cb,[{...compChoices[0],outcome:"missed"}]),/conflicts/);
for(const bad of [{...completion,count:0},{...completion,bestCount:11},{...completion,completionPoints:0}])assert.throws(()=>planCanvasImport(board,cb,[{...compChoices[0],rule:bad}]),/valid grading rule/);
assert(validCanvasMetadata(cp.semester));assert.deepEqual(readBackup(backupText(cp.semester)).canvasImports,cp.semester.canvasImports);
const invalid=structuredClone(cp.semester);invalid.canvasImports![0].lastItem!.id="wrong";assert.equal(validCanvasMetadata(invalid),false);
assert.throws(()=>planCanvasImport(cp.semester,{...cb,accountId:"100"},compChoices),/different Canvas account/);
// Explicitly append a newly discovered prework to its already-confirmed rule.
const freshPrep=structuredClone(cb);freshPrep.courses[2].assignments.push({...structuredClone(cc.assignments[6]),id:"27",name:"Preparation 8"});
const options=existingCanvasRuleChoices(cp.semester,freshPrep,cc.course.id,"ELEC2302");
assert.equal(options.length,1);assert.deepEqual(options[0].rule,completion);
assert.equal(defaultCanvasStage(cp.semester,freshPrep),"updates");assert.equal(defaultCanvasStage(board,freshPrep),"match");
assert.equal(existingCanvasRuleChoices(cp.semester,{...freshPrep,accountId:"100"},cc.course.id,"ELEC2302").length,0);
assert.equal(existingCanvasRuleChoices(cp.semester,freshPrep,cc.course.id,"SOFT2412").length,0);
const auto=Object.values(suggestCanvasMatches(cp.semester,freshPrep).choices);
assert(!auto.some(c=>c.assignmentId==="27"),"new prework is never auto selected");
const appended=planCanvasImport(cp.semester,freshPrep,[...auto,{...compChoices[0],assignmentId:"27",outcome:undefined,rule:options[0].rule}]);
assert.equal(appended.changed,1);assert.equal(appended.semester.tasks.length,cp.semester.tasks.length);
assert.equal(appended.semester.tasks[2].gradePlan!.items[7].outcome,"unknown");
assert.equal(appended.semester.tasks[2].gradePlan!.items[4].outcome,"missed","manual miss preserved during append");
assert.equal(planCanvasImport(cp.semester,freshPrep,auto).changed,0,"leaving new item skipped changes nothing");
console.log("PASS Canvas rules: cross-group highest, best-N completion, unknowns, explicit misses, stable IDs, placeholders, updates, idempotence, manual/cleared/removed/rule protection, changed source rules, backups and isolation.");
