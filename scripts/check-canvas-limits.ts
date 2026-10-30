import assert from "node:assert/strict";
import {onboardingBoard,onboardingBundle} from "./fixtures/canvas-onboarding";
import {planCanvasImport,readCanvasBundle,type CanvasChoice} from "../lib/canvas-import";
import {prepareCanvasImport} from "../lib/canvas-prepare";
import {confirmCanvasImport} from "../lib/canvas-history";
import {backupText,readBackup} from "../lib/backup";

// Invented data only. Preview must enforce the same eight-unit boundary as
// persistence, before confirmation can replace the current board in memory.
const bundle=structuredClone(onboardingBundle);
bundle.courses=bundle.courses.slice(0,2);
bundle.courses.forEach(c=>{c.assignments=c.assignments.slice(0,2);});
const board=(count:number)=>({...structuredClone(onboardingBoard),
  units:Array.from({length:count},(_,i)=>({...structuredClone(onboardingBoard.units[0]),code:`TEST${9000+i}`,assessments:[]}))});
const choices:CanvasChoice[]=bundle.courses.map(c=>({
  courseId:c.course.id,assignmentId:c.assignments[0].id,unit:c.course.code,targetId:"new",mode:"overall",
}));
const full=board(8),fullBefore=JSON.stringify(full),bundleBefore=JSON.stringify(bundle);
for(const incoming of [bundle,readCanvasBundle(JSON.stringify(bundle))]) {
  assert.throws(()=>planCanvasImport(full,incoming,[choices[0]]),/8 units/,
    "preview must reject a ninth unit before it reaches the save API");
  assert.throws(()=>confirmCanvasImport(full,incoming,[choices[0]],"synthetic-over-limit"),/8 units/);
}
assert.equal(JSON.stringify(full),fullBefore,"rejection preserves the complete board and import history");
assert.equal(JSON.stringify(bundle),bundleBefore,"source snapshot stays unchanged");

// One remaining slot admits one new course, not one slot per assessment.
const seven=board(7),sevenBefore=JSON.stringify(seven);
const sameCourse=[choices[0],{...choices[0],assignmentId:bundle.courses[0].assignments[1].id}];
const atLimit=planCanvasImport(seven,bundle,sameCourse);
assert.equal(atLimit.semester.units.length,8);
assert.equal(atLimit.semester.tasks.length,2);
assert.equal(atLimit.changed,2);
assert.equal(readBackup(backupText(atLimit.semester)).units.length,8);
assert.equal(planCanvasImport(atLimit.semester,bundle,sameCourse).changed,0,"repeat import stays idempotent at the limit");

// Each course fits alone, but the complete batch must be checked cumulatively.
for(const choice of choices)assert.equal(planCanvasImport(seven,bundle,[choice]).semester.units.length,8);
assert.throws(()=>planCanvasImport(seven,bundle,choices),/8 units/,"two new courses cannot share the last slot");
assert.throws(()=>confirmCanvasImport(seven,bundle,choices,"synthetic-batch-over-limit"),/8 units/);
assert.equal(JSON.stringify(seven),sevenBefore,"no partial import or course creation on batch failure");

// Existing-course results remain usable on a full board; only the extra
// course is left for review by the shared JSON/direct preparation path.
const existing=board(8);
existing.units[0].code=bundle.courses[0].course.code;
const existingBefore=JSON.stringify(existing);
const prepared=prepareCanvasImport(existing,bundle);
assert.deepEqual(Object.keys(prepared.choices),["101:1"]);
assert.match(prepared.issues["102:1"],/8 units/);
assert.deepEqual(prepareCanvasImport(existing,readCanvasBundle(JSON.stringify(bundle))),prepared);
const accepted=confirmCanvasImport(existing,bundle,Object.values(prepared.choices),"synthetic-existing-unit");
assert.equal(accepted.semester.units.length,8);
assert.equal(accepted.changed,1);
assert.equal(accepted.semester.canvasHistory?.length,1);
assert.equal(readBackup(backupText(accepted.semester)).units.length,8);
assert.equal(JSON.stringify(existing),existingBefore,"preview and confirmation planning do not mutate their input");
assert.equal(JSON.stringify(bundle),bundleBefore);

console.log("PASS: Canvas eight-unit limit, cumulative batch rejection, existing-course updates, same-course additions, no partial mutation/history, repeat import and JSON/direct parity.");
