import assert from "node:assert/strict";
import {type GradePlan, type Task, type Semester, calendar, mergeSemester} from "../lib/semester";
import {partGrade,gradeThreshold,saveGradePlan,assessmentGrade,unitGrades,gradeTarget} from "../lib/grades";
import {validGradePlan,requiresGradeRuleClient} from "../lib/grade-value";
import {backupText,readBackup} from "../lib/backup";
import {upgradeSemester} from "../lib/importer";
import {reconcile} from "../lib/sync";
import {planCanvasImport,suggestCanvasMatches,type CanvasChoice} from "../lib/canvas-import";
import {fixtureBoard,fixtureBundle,fixtureChoices} from "./fixtures/canvas-connect";

const highest:GradePlan={mode:"parts",method:"highest",passMark:{earned:14,possible:20},items:[1,13,15].map((earned,i)=>({id:`try${i}`,name:`Attempt ${i+1}`,grade:{earned,possible:20}}))};
assert(validGradePlan(highest));assert.equal(partGrade(highest).ratio,.75);assert.equal(partGrade(highest).earned,15);assert.equal(partGrade(highest).finished,true);assert.equal(gradeThreshold(highest),"Threshold met");
assert(requiresGradeRuleClient(highest));assert(requiresGradeRuleClient({...highest,method:"points",mode:"overall"}),"Inactive rules still require a capable client");assert(!requiresGradeRuleClient({mode:"parts",method:"points",items:[]}));assert(!requiresGradeRuleClient(null));
const pending=structuredClone(highest);pending.items[0].grade={earned:3.5,possible:20};pending.items[1].grade={earned:7,possible:20};pending.items[2].grade=null;pending.items[2].outcome="not_taken";
assert.equal(partGrade(pending).ratio,.35);assert.equal(partGrade(pending).finished,false);assert.equal(gradeThreshold(pending),"Not yet at threshold");
assert.equal(partGrade({...pending,attemptsClosed:true}).finished,true);assert.equal(gradeThreshold({...pending,attemptsClosed:true}),"Threshold not met");
for(const outcome of ["unknown","awaiting"] as const){const x=structuredClone(pending);x.attemptsClosed=true;x.items[2].outcome=outcome;assert.equal(partGrade(x).finished,false);}
const zero=structuredClone(pending);zero.items.forEach(i=>{i.grade={earned:0,possible:20};});assert.equal(partGrade(zero).ratio,0);assert.equal(partGrade(zero).finished,true);
const different=structuredClone(highest);different.items[0].grade={earned:8,possible:10};assert.equal(partGrade(different).ratio,.8);assert.equal(partGrade(different).earned,8);
const excluded=structuredClone(highest);excluded.items[2].excluded=true;assert.equal(partGrade(excluded).ratio,.65);
const none=structuredClone(highest);none.items.forEach(i=>{i.grade=null;});assert.equal(partGrade(none).ratio,null);assert.equal(gradeThreshold(none),"No result to check");
const boundary=structuredClone(pending);boundary.items[0].grade={earned:14,possible:20};assert.equal(gradeThreshold(boundary),"Threshold met");assert.equal(partGrade(boundary).finished,false,"Hurdle met does not finalize future attempts");

const completion:GradePlan={mode:"parts",method:"completion",bestCount:8,completionPoints:.5,items:Array.from({length:10},(_,i)=>({id:`week${i}`,name:`Week ${i+1}`,outcome:i<4?"submitted":"not_due"}))};
assert(validGradePlan(completion));let result=partGrade(completion);assert.equal(result.ratio,.5);assert.equal(result.earned,2);assert.equal(result.possible,4);assert.equal(result.finished,false);assert.equal(result.recorded,4);
const incomplete=structuredClone(completion);incomplete.items[4].outcome="missed";incomplete.items[5].outcome="unknown";result=partGrade(incomplete);assert.equal(result.recorded,5);assert.equal(result.earned,2);assert.equal(result.finished,false);
const finished=structuredClone(completion);finished.items.forEach((i,index)=>{i.outcome=index<7?"submitted":"missed";});result=partGrade(finished);assert.equal(result.earned,3.5);assert.equal(result.ratio,.875);assert.equal(result.finished,true);
const capped=structuredClone(completion);capped.items.slice(0,8).forEach(i=>i.outcome="submitted");assert.equal(partGrade(capped).ratio,1);assert.equal(partGrade(capped).finished,true,"Enough confirmed submissions settles capped total without zeroing future entries");assert.equal(capped.items[9].outcome,"not_due");
capped.items.forEach(i=>i.outcome="submitted");assert.equal(partGrade(capped).earned,4);
const allMissed=structuredClone(completion);allMissed.items.forEach(i=>i.outcome="missed");assert.equal(partGrade(allMissed).ratio,0);assert.equal(partGrade(allMissed).finished,true);
const unresolved=structuredClone(completion);unresolved.items.forEach(i=>{i.outcome="unknown";i.grade={earned:1,possible:1};});assert.equal(partGrade(unresolved).ratio,null,"Numeric results never imply binary completion");
assert(partGrade({...completion,bestCount:11}).error);assert(partGrade({...completion,completionPoints:undefined}).error);
for(const p of [{...completion,bestCount:2.5},{...completion,completionPoints:0},{...completion,completionPoints:NaN},{...highest,passMark:{earned:21,possible:20}},{...highest,attemptsClosed:"yes"},{...completion,items:[{id:"x",name:"X",outcome:"half"}]}])assert.equal(validGradePlan(p),false);
const generic={...completion,bestCount:3,completionPoints:2,items:finished.items.slice(0,5)};assert.equal(partGrade(generic).earned,6,"Other units can use different counts and points");

const root:Task={id:"assessment",unit:"TEST1001",title:"Practice",kind:"recurring",weight:"4%",timing:"",description:"",source:"",sourceText:"",hurdle:false,group:false};
const remainder={...root,id:"exam",kind:"exam" as const,weight:"96%"};
const s:Semester={year:2026,session:"S2C",weeks:calendar(2026,"S2C"),feedUrl:"",importedAt:"",completed:{keep:true},classes:[],warnings:[],units:[{code:root.unit,name:"Test",session:"S2C",outline:"",status:"ready",summary:"",topics:[],assessments:[root,remainder]}],tasks:[root,remainder]};
const before=JSON.stringify(s);const saved=saveGradePlan(s,root.id,completion,undefined);assert.equal(JSON.stringify(s),before);assert.deepEqual(saved.completed,s.completed);assert.deepEqual(saved.classes,s.classes);assert.equal(saved.tasks[0].done,undefined);
let stats=unitGrades(saved,root.unit);assert.equal(stats.average,null,"Partial secured tally must not lower the marked-work average");assert.equal(stats.securedCompletionPoints,2);assert.equal(stats.earned,0);assert.equal(gradeTarget(stats,50).status,"inprogress");
const settled=saveGradePlan(saved,root.id,finished,completion);stats=unitGrades(settled,root.unit);assert.equal(stats.earned,3.5);assert.equal(stats.average,87.5);
for(const plan of [highest,completion]){const x=saveGradePlan(s,root.id,plan,undefined);for(const restored of [readBackup(backupText(x)),upgradeSemester(structuredClone(x)),mergeSemester(x,structuredClone(s))])assert.deepEqual(restored.tasks[0].gradePlan,plan);}
const alternate=saveGradePlan(saved,root.id,{...completion,bestCount:7},completion);assert(reconcile(saved,alternate,settled).conflicts.includes("tasks.assessment.gradePlan"));
const overall={...saved.tasks[0],grade:{earned:3,possible:4},gradePlan:{...completion,mode:"overall" as const}};assert.equal(assessmentGrade(overall).ratio,.75);assert.deepEqual(overall.gradePlan.items,completion.items);
assert.throws(()=>saveGradePlan(settled,root.id,highest,completion),/changed elsewhere/);

// Existing Canvas links cannot replace a user-selected special calculation or its raw entries.
const choices:CanvasChoice[]=["1","2"].map(assignmentId=>({...fixtureChoices[0],assignmentId,mode:"part",method:"points"}));
const imported=planCanvasImport(fixtureBoard,fixtureBundle,choices).semester;
for(const method of ["highest","completion"] as const){const plan={...imported.tasks[0].gradePlan!,method,bestCount:1,completionPoints:.5};const configured=saveGradePlan(imported,"root-0",plan,imported.tasks[0].gradePlan);const newer=structuredClone(fixtureBundle);newer.courses[0].fetchedAt="2026-10-22T01:00:00Z";newer.courses[0].assignments[0].submission!.score=9;assert.equal(planCanvasImport(configured,newer,choices).changed,0);assert.deepEqual(planCanvasImport(configured,newer,choices).semester.tasks[0].gradePlan,configured.tasks[0].gradePlan);assert.equal(suggestCanvasMatches(configured,newer).choices["101:1"],undefined);}
console.log("PASS: generic highest-attempt and binary best-N rules, exact threshold, unknown/future/zero results, cap, partial statistics, raw-result retention, backups, conflict protection and repeat Canvas imports.");
