import assert from "node:assert/strict";
import {mixedUpdatesFixture} from "./fixtures/canvas-mixed-updates";
import {planCanvasImport} from "../lib/canvas-import";
import {prepareCanvasImport} from "../lib/canvas-prepare";
import {canvasAssessmentImpact,canvasResultChange} from "../lib/canvas-preview-impact";
const {board,bundle}=mixedUpdatesFixture(),snapshot=JSON.stringify(board);
const choices=prepareCanvasImport(board,bundle).choices;
const plan=planCanvasImport(board,bundle,Object.values(choices));
const record=plan.semester.canvasImports!.find(r=>r.targetId==="root-2")!;
assert.deepEqual(canvasResultChange(board,plan.semester,record.key,"ELEC2302","root-2",true),{before:"Not recorded",after:"Complete"});
const impact=canvasAssessmentImpact(board,plan.semester,"ELEC2302","root-2")!;
assert.equal(impact.before,"0.5 / 1.5");assert.equal(impact.after,"1 / 1.5");
assert.equal(impact.difference,"+0.5 completion points");assert.equal(impact.pending,true);
assert.equal(impact.unlinked,1);
// Multiple changed sources affect a single parent total once, not separate increments.
const multi=structuredClone(board);const multiPlan=multi.tasks.find(t=>t.id==="root-2")!.gradePlan!;
const manualSource=multi.canvasImports!.find(r=>r.key.endsWith(":103:3"))!;
multiPlan.items[2]=structuredClone(manualSource.lastItem!);
const mp=planCanvasImport(multi,bundle,Object.values(prepareCanvasImport(multi,bundle).choices));
assert.equal(canvasAssessmentImpact(multi,mp.semester,"ELEC2302","root-2")!.difference,"+1 completion points");
const skipped={...choices};delete skipped["103:1"];
const skip=planCanvasImport(board,bundle,Object.values(skipped));
assert.equal(canvasAssessmentImpact(board,skip.semester,"ELEC2302","root-2")!.difference,"No total change");
assert.equal(canvasAssessmentImpact(board,planCanvasImport(board,bundle,Object.values(choices)).semester,"ELEC2302","root-2")!.after,impact.after,"Undo recomputes from unchanged original");
// A newly Complete item can add no points at an already reached cap.
const capped=structuredClone(board);const cp=capped.tasks.find(t=>t.id==="root-2")!.gradePlan!;cp.bestCount=1;
const next=structuredClone(capped);next.tasks.find(t=>t.id==="root-2")!.gradePlan!.items[0].outcome="submitted";
const ci=canvasAssessmentImpact(capped,next,"ELEC2302","root-2")!;
assert.equal(ci.after,"0.5 / 0.5");assert.equal(ci.difference,"No total change");assert.equal(ci.pending,false);
// Unknown is never displayed as zero; equal-weight totals are percentages, not raw sums.
const empty=structuredClone(board);const ep=empty.tasks.find(t=>t.id==="root-2")!.gradePlan!;ep.items.forEach(i=>i.outcome="unknown");
assert.equal(canvasAssessmentImpact(empty,plan.semester,"ELEC2302","root-2")!.before,"Not recorded");
assert.equal(canvasAssessmentImpact(empty,plan.semester,"ELEC2302","root-2")!.difference,"");
const numeric=structuredClone(empty);numeric.tasks.find(t=>t.id==="root-2")!.gradePlan={mode:"parts",method:"equal",items:[{id:"a",name:"A",grade:{earned:4,possible:10}}]};
const numericNext=structuredClone(numeric);numericNext.tasks.find(t=>t.id==="root-2")!.gradePlan!.items.push({id:"b",name:"B",grade:{earned:8,possible:10}});
const ni=canvasAssessmentImpact(numeric,numericNext,"ELEC2302","root-2")!;
assert.equal(ni.before,"40%");assert.equal(ni.after,"60%");assert.equal(ni.difference,"+20 percentage points");
assert.equal(JSON.stringify(board),snapshot);
console.log("PASS impact: actual before/after snapshots, Complete separate from points, whole-batch totals, skip/Undo, cap no-increase, unknown not zero, equal-weight units and immutable input.");
