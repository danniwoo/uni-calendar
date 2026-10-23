import assert from "node:assert/strict";
import {fixtureBoard,fixtureBundle,fixtureChoices} from "./fixtures/canvas-connect";
import {planCanvasImport,suggestCanvasMatches,readCanvasBundle} from "../lib/canvas-import";
import {canvasUpdateStatus} from "../lib/canvas-update-status";

const first=planCanvasImport(fixtureBoard,fixtureBundle,fixtureChoices);
const newer=structuredClone(fixtureBundle);
newer.courses.forEach(c=>c.fetchedAt="2026-10-24T00:00:00Z");
newer.courses[0].assignments[0].submission!.score=9;
newer.courses[0].assignments.push({...structuredClone(newer.courses[0].assignments[1]),id:"3",name:"New activity"});
const board=structuredClone(first.semester);board.tasks[2].grade=null;
const before=JSON.stringify(board),choices=Object.values(suggestCanvasMatches(board,newer).choices),plan=planCanvasImport(board,newer,choices);
const status=canvasUpdateStatus(board,newer,choices,plan.actions);
assert.equal(status.grades.length,1);assert.match(status.grades[0].text,/7\/10 → 9\/10/);
assert.equal(status.protected.length,2);assert.equal(status.unmatched.length,5);
assert.equal(status.otherChanges.length,0);assert.equal(status.unchanged.length,1);
assert.ok(status.unmatched.some(a=>a.name==="New activity"&&a.isNew));
assert.equal(JSON.stringify(board),before,"preview never saves");
assert.equal(plan.semester.tasks[2].grade,null);assert.equal(plan.semester.tasks[1].grade!.earned,8);
assert.equal(canvasUpdateStatus(plan.semester,newer,choices,planCanvasImport(plan.semester,newer,choices).actions).grades.length,0);
assert.throws(()=>planCanvasImport({...board,canvasAccountId:"92"},newer,choices),/different Canvas account/);
// Bridge and JSON share the parser and preserve text results; not normalized twice.
const raw={...newer,courses:newer.courses.map(c=>({...c,assignments:c.assignments.map(a=>a.id==="2"?{...a,gradingType:"pass_fail",submission:{...a.submission,grade:"complete",released:true,releaseEvidence:"marks-page"}}:a)}))};
const parsed=readCanvasBundle(JSON.stringify(raw));assert.equal(parsed.courses[0].assignments[1].result,"complete");
console.log("Canvas update statuses passed: new results, unmatched, protected, repeat, account guard and raw transport.");
