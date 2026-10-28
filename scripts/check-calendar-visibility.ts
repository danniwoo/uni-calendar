import assert from "node:assert/strict";
import {calendarFixture as s} from "./fixtures/calendar-visibility";
import {weekOnlyTasks,calendarTaskVisible,restoreMonthPreferences,dayPreview,monthEntries} from "../lib/month-calendar";
import {weekData} from "../lib/week-calendar";
const initial=JSON.stringify(s),week="2026-10-19";
assert.deepEqual(weekOnlyTasks(s,s.tasks,week,"2026-10-25").map(t=>t.id),["week-report","week-exam"]);
assert.deepEqual(weekOnlyTasks(s,s.tasks,"2026-10-26","2026-11-01").map(t=>t.id),["later"]);
assert.equal(weekOnlyTasks(s,s.tasks,"2026-09-28","2026-10-04").length,0,"break is not a teaching week");
assert.equal(weekOnlyTasks(s,s.tasks,"2026-10-12","2026-10-18").length,0);
const special=[{...s.tasks[0],id:"parent",splitCount:2},{...s.tasks[0],id:"dated",date:week},{...s.tasks[0],id:"own",kind:"task" as const},{...s.tasks[0],id:"activity",week:undefined,activity:{week:11,label:"Demo"}}];
assert.equal(weekOnlyTasks(s,special,week,"2026-10-25").length,0,"do not duplicate dated, aggregate, personal or activity-only items");
for(const assignments of [true,false])for(const classes of [true,false])for(const personal of [true,false]){
 const view=weekData(s,week,"all",classes,{assignments,personal});
 assert.equal(view.classes.length,classes?1:0);
 assert.equal(view.weekOnly.length,assignments?2:0);
 assert.equal(view.awaitingExams.length,assignments?1:0);
 assert.equal(view.unknown.length,assignments?1:0);
 assert.equal(view.events.length,personal?1:0);
 assert.equal(view.due.some(t=>t.id==="personal"),personal);
 const tasks=[...view.due,...view.linked.values()].flat();
 assert.equal(tasks.some(t=>t.id==="class-quiz"),assignments,"in-class quiz does not depend on Classes toggle");
 const prefs=restoreMonthPreferences({assignments,classes,personal},"2026-10","2026-08","2026-11",["TEST1001"]);
 assert.equal(prefs.assignments,assignments);assert.equal(prefs.personal,personal);
 assert.equal(monthEntries(s).filter(e=>e.task?calendarTaskVisible(e.task,prefs):classes).length,(assignments?5:0)+(classes?1:0)+(personal?2:0));
}
assert.equal(weekData(s,week,"OTHER").weekOnly.length,0);
const crowded=monthEntries(s).filter(e=>e.date==="2026-10-21"),before=dayPreview(crowded);
for(const tick of crowded){const after=dayPreview(crowded.map(e=>({...e,done:e.id===tick.id})));assert.deepEqual(after.visible.map(e=>e.id),before.visible.map(e=>e.id));assert.deepEqual(after.overflow.map(e=>e.id),before.overflow.map(e=>e.id));}
assert.equal(JSON.stringify(s),initial,"all projections are read-only");
console.log("PASS: known weeks/breaks, separate activity dates, eight category combinations, preference migration, crowded-day position stability and read-only projections.");
