// Synthetic fixtures only: no personal timetable, locations or subscription URL.
import assert from "node:assert/strict";
import { parseICS, parseOutline, scheduleTasks, upgradeSemester } from "../lib/importer";
import { calendar, mergeSemester, weekFor, needsPlacement, isPast, type Semester } from "../lib/semester";
import { reconcile } from "../lib/sync";
import { learningScope, withCoverage } from "../lib/learning-scope";
import { splitAssessment, fillEmptySchedules } from "../lib/split-assessment";
import { monthDays, monthEntries, shiftMonth, dayPreview, shortEntryTitle, entryBadge, restoreMonthPreferences } from "../lib/month-calendar";
const feed = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=Australia/Sydney:20261008T100000
DTEND;TZID=Australia/Sydney:20261008T120000
SUMMARY:Example unit\\, Tutorial
DESCRIPTION:TEST1001-S2C-ND-CC\\, Tutorial\\, 01
LOCATION:Example room
UID:example1
END:VEVENT
END:VCALENDAR`;
const parsed = parseICS(feed);
assert.equal(parsed.units[0].code, "TEST1001");
assert.equal(parsed.classes[0].week, 9);
assert.equal(weekFor("2026-09-30", parsed.weeks), undefined);
assert.equal(weekFor("2026-10-08", parsed.weeks), 9);
assert.equal(calendar(2026,"S1C").filter(w=>w.kind==="teaching").length,13);
assert.throws(()=>calendar(2027,"S2C"));
const html = `<h1>Example</h1><table id="assessment-table">
<tr><th>Written work</th><td><b>Assignment</b> A report</td><td>10%</td><td>Week 07 Due date : 20 Sep 2026 at 23:59 Closing date : 27 Sep 2026</td><td>report</td></tr>
<tr><th>Quiz</th><td><b>SQL Quiz</b> In tutorial class</td><td>10%</td><td>Week 09</td><td>50 minutes</td></tr>
<tr><th>Exam</th><td><b>Final exam</b></td><td>50%</td><td>Formal exam period</td><td>2 hours</td></tr>
<tr><th>Practice</th><td><b>Practice tasks</b></td><td>5%</td><td>Multiple weeks</td><td>n/a</td></tr>
</table>`;
const unit=parseOutline(html,"TEST1001","https://www.sydney.edu.au/units/TEST1001",parsed.weeks,parsed.classes);
const tasks=scheduleTasks(unit,parsed.classes);
assert.equal(tasks[0].date,"2026-09-20");
assert.equal(tasks[0].time,"23:59");
assert.equal(tasks[1].date,"2026-10-08");
assert.equal(tasks[1].time,"10:00");
assert.equal(tasks[2].date,undefined);
assert.equal(tasks[3].kind,"assessment", "Multiple weeks is not proof of weekly recurrence");
assert.equal(tasks[3].week,undefined);
const fresh:Semester={...parsed,units:[unit],tasks,completed:{},feedUrl:"",importedAt:"",warnings:[]};
const old:Semester={...fresh,tasks:[{...tasks[0],title:"My edit",manual:true,done:true}],completed:{[parsed.classes[0].id]:true}};
const merged=mergeSemester(old,{...fresh});
assert.equal(merged.tasks[0].title,"My edit");
assert.equal(merged.tasks[0].done,true);
assert.equal(merged.completed[parsed.classes[0].id],true);
assert.throws(()=>parseICS(feed.replace("UID:example1","RRULE:FREQ=WEEKLY\nUID:example1")));
console.log("PASS: ICS, teaching weeks, breaks, due vs closing dates, tutorial mapping, undated series and refresh preservation.");

const rulesHtml = `<h1>Example</h1><table id="assessment-table">
<tr><th>Quiz hurdle task</th><td><b>Quiz 2</b> in tutorial</td><td>15%</td><td>Week 09</td><td>30 minutes</td></tr>
<tr><th>Quiz</th><td><b>Weekly quizzes</b> each tutorial</td><td>21%</td><td>Multiple weeks</td><td>20 minutes</td></tr>
<tr><th>Work</th><td><b>Tutorial prework</b> each tutorial</td><td>4%</td><td>Multiple weeks</td><td></td></tr>
</table><div class="assessmentSummary"><p>Quiz 2 (15%) – The quiz covers weeks 4–7. Highest mark of three attempts counting. You must achieve at least 70%.</p><p>Weekly quizzes (21%) [each quiz worth 3 points; total capped at 21]</p><p>Tutorial prework (4%) – Submit before each tutorial. 0.5% per submission.</p></div><div id="assessmentCriteria"></div>`;
const ru=parseOutline(rulesHtml,"TEST1001","",parsed.weeks,parsed.classes);
const rt=scheduleTasks(ru,parsed.classes);
assert.equal(ru.assessments[0].rules?.threshold,70);
assert.equal(ru.assessments[0].rules?.attempts,3);
assert.deepEqual(ru.assessments[0].coverage,[4,5,6,7]);
assert.equal(ru.assessments[1].rules?.perOccurrence,3);
assert.equal(ru.assessments[2].rules?.perOccurrence,0.5);
assert.match(rt.find(t=>t.title === "Tutorial prework")!.timing,/Before/);
assert.equal(needsPlacement({...tasks[3],week:8,warning:"old warning"}),false);
const updated={...fresh,tasks:[{...tasks[0],date:"2026-09-21"}]};
const edited={...fresh,tasks:[{...tasks[0],description:"My notes",manual:true,overrides:["description"],done:true}]};
const merge=mergeSemester(edited,updated);
assert.equal(merge.tasks[0].date,"2026-09-21");
assert.equal(merge.tasks[0].description,"My notes");
assert.equal(merge.tasks[0].done,true);
const base=structuredClone(fresh), local=structuredClone(fresh), remote=structuredClone(fresh);
local.tasks[0].done=true; remote.tasks[1].done=true;
let sync=reconcile(base,local,remote);
assert.equal(sync.conflicts.length,0);
assert.equal(sync.semester.tasks[0].done,true); assert.equal(sync.semester.tasks[1].done,true);
local.tasks[0].title="Local title";remote.tasks[0].title="Remote title";
sync=reconcile(base,local,remote);
assert.ok(sync.conflicts.some(k=>k.endsWith(".title")));
assert.equal(reconcile(base,local,remote,"remote").semester.tasks[0].title,"Remote title");
assert.equal(reconcile(base,local,remote,"remote").semester.tasks[0].done,true);
const upgraded=upgradeSemester(fresh);
assert.deepEqual(upgradeSemester(upgraded),upgraded,"Saved-data upgrade must be idempotent");
assert.equal(isPast({...tasks[0],date:"2026-10-04",time:"10:00"},fresh,new Date("2026-10-04T00:01:00Z")),true);
console.log("PASS: explicit summary rules, coverage, before-class timing, placement, field overrides, concurrent edits, migration and Sydney DST.");
const scoped = withCoverage(tasks[1],[1,2,3,3,99]);
assert.deepEqual(scoped.coverage,[1,2,3]);
const scopeSemester = {...fresh, classes:[1,3].map(w=>({...parsed.classes[0],id:`lecture-${w}`,activity:"Lecture",week:w})), completed:{"lecture-1":true}};
assert.deepEqual(learningScope(scoped,scopeSemester).missing,[2]);
assert.match(learningScope(scoped,scopeSemester).status,/W3 lecture unchecked/);
assert.match(learningScope(scoped,scopeSemester).status,/W2 class data missing/);
assert.deepEqual(mergeSemester({...fresh,tasks:[scoped]},structuredClone(fresh)).tasks.find(t=>t.id===scoped.id)?.coverage,[1,2,3]);
assert.deepEqual(mergeSemester({...fresh,tasks:[withCoverage(scoped,[])]},structuredClone(fresh)).tasks.find(t=>t.id===scoped.id)?.coverage,[]);
console.log("PASS: scope week validation, incomplete lectures, missing timetable data and refresh-safe manual scope.");
const portfolio={...tasks[3],id:"portfolio",title:"Brief Reports",weight:"20%"};
const portfolioSemester={...fresh,tasks:[portfolio]};
const split=splitAssessment(portfolioSemester,portfolio,{count:5,weight:4,label:"Report",weeks:[3,5,7,9,undefined],weekday:6,time:"24:00"});
const reports=split.tasks.filter(t=>t.parentId===portfolio.id);
assert.equal(reports.length,5);
assert.equal(reports[3].date,"2026-10-12");
assert.equal(reports[3].time,"00:00");
assert.equal(reports[3].dueWeek,9);
assert.equal(reports[0].weight,"4%");
assert.equal(needsPlacement(split.tasks.find(t=>t.id===portfolio.id)!),false);
assert.equal(needsPlacement(reports[4]),true);
assert.throws(()=>splitAssessment(split,portfolio,{count:5,weight:4,label:"Report",weeks:[3,5,7,9,11]}),/already/);
assert.throws(()=>splitAssessment(portfolioSemester,portfolio,{count:5,weight:5,label:"Report",weeks:[3,5,7,9,11]}),/add up/);
reports[0].done=true; reports[1].date="2026-09-09";
const splitRefresh=mergeSemester(split,structuredClone(portfolioSemester));
assert.equal(splitRefresh.tasks.find(t=>t.id===portfolio.id)?.splitCount,5);
assert.equal(splitRefresh.tasks.find(t=>t.id===reports[0].id)?.done,true);
assert.equal(splitRefresh.tasks.find(t=>t.id===reports[1].id)?.date,"2026-09-09");
const reportRules=parseOutline('<table id="assessment-table"><tr><th>Portfolio or journal</th><td><b>Brief Reports</b></td><td>20%</td><td>Multiple weeks</td><td></td></tr></table><div class="assessmentSummary">Online Task (5 x Brief Reports; 5 x 4%) - Write-up of experimental work.</div><div id="assessmentCriteria"></div>',"BCMB3004","",fresh.weeks,[]);
assert.equal(reportRules.assessments[0].rules?.count,5);
assert.equal(reportRules.assessments[0].rules?.perOccurrence,4);
console.log("PASS: report splitting, midnight, teaching-week breaks, missing weeks, weights, duplicate protection and refresh preservation.");
const routineParent={...portfolio,id:"manual-routine-test",title:"Weekly reading",weight:"",manual:true};
const routine=splitAssessment({...fresh,tasks:[]},routineParent,{count:3,weight:0,label:"Weekly reading",weeks:[8,9,10],weekday:6,time:"23:59",routine:true});
const routineParts=routine.tasks.filter(t=>t.parentId===routineParent.id);
assert.deepEqual(routineParts.map(t=>t.date),["2026-09-27","2026-10-11","2026-10-18"]);
assert.ok(routineParts.every(t=>t.routine && t.weight==="" && t.time==="23:59" && !t.done));
routineParts[0].done=true;
assert.equal(routineParts[1].done,false);
assert.equal(mergeSemester(routine,{...fresh,tasks:[]}).tasks.filter(t=>t.parentId===routineParent.id).length,3);
console.log("PASS: manual weekly routines, suggested 23:59 deadlines, break skipping and independent completion.");
const flexiblePlan={count:5,weight:4,label:"Report",weeks:[1,4,5,undefined,undefined],schedules:[{date:"2026-08-09",time:"23:59"},{date:"2026-08-28",time:"17:00"},{week:5},{},{}]};
const flexibleSplit=splitAssessment(portfolioSemester,portfolio,flexiblePlan);
const flexParts=flexibleSplit.tasks.filter(t=>t.parentId===portfolio.id);
assert.equal(flexParts[0].week,1);
assert.equal(flexParts[1].week,4);
assert.equal(flexParts[1].time,"17:00");
assert.equal(flexParts[2].date,undefined);
assert.equal(needsPlacement(flexParts[2]),false);
assert.equal(needsPlacement(flexParts[3]),true);
assert.throws(()=>splitAssessment(portfolioSemester,portfolio,{...flexiblePlan,schedules:[{date:"2026-02-30"},{},{},{},{}]}),/valid date/);
assert.throws(()=>splitAssessment(portfolioSemester,portfolio,{...flexiblePlan,schedules:[{week:1,time:"17:00"},{},{},{},{}]}),/exact date/);
assert.deepEqual(fillEmptySchedules([{week:4},{date:"2026-08-28",time:"17:00"},{}],[{week:1},{week:3},{week:5}]),[{week:4},{date:"2026-08-28",time:"17:00"},{week:5}]);
assert.deepEqual(fillEmptySchedules([{week:4},{}],[{week:1},{week:3}],true),[{week:1},{week:3}]);
const flexibleRefresh=mergeSemester(flexibleSplit,structuredClone(portfolioSemester));
assert.equal(flexibleRefresh.tasks.find(t=>t.id===flexParts[1].id)?.time,"17:00");
assert.equal(flexibleRefresh.tasks.find(t=>t.id===flexParts[2].id)?.week,5);
console.log("PASS: individual deadlines, partial schedules, date validation, non-destructive batch fill and refresh preservation.");
assert.equal(monthDays("2026-09")[0],"2026-08-31");
assert.equal(monthDays("2026-09").at(-1),"2026-10-04");
assert.equal(monthDays("2026-11").length,42);
assert.ok(monthDays("2028-02").includes("2028-02-29"));
assert.equal(shiftMonth("2026-12",1),"2027-01");
const monthFixture={...fresh,units:[{...fresh.units[0],code:"TEST1001"}],classes:[{...parsed.classes[0],id:"month-class",unit:"TEST1001",date:"2026-10-08",time:"09:00"}],completed:{"month-class":true},tasks:[{...portfolio,id:"month-task",unit:"TEST1001",date:"2026-10-08",time:"23:59",done:true},{...portfolio,id:"month-parent",unit:"TEST1001",date:"2026-10-08",splitCount:5},{...portfolio,id:"month-unknown",unit:"TEST1001",date:undefined},{...portfolio,id:"other-board",unit:"OTHER1001",date:"2026-10-08"}]};
const monthItems=monthEntries(monthFixture);
assert.equal(monthItems.length,2);
assert.equal(monthItems[0].id,"task:month-task");
assert.equal(monthItems[0].done,true);
assert.equal(monthItems[1].id,"class:month-class");
assert.equal(monthItems[1].done,true);
monthFixture.tasks[0].done=false;
assert.equal(monthEntries(monthFixture)[0].done,false);
assert.equal(monthItems[0].time,"23:59");
console.log("PASS: Monday-first month grids, leap/year boundaries, deadlines before classes, shared completion and aggregate/unknown/other-unit exclusions.");
const activeDeadline={...monthItems[0],id:"deadline",done:false,task:{...monthItems[0].task!,routine:false,hurdle:true,kind:"quiz" as const}};
const activeRoutine={...activeDeadline,id:"routine",task:{...activeDeadline.task,routine:true,hurdle:false}};
const activeClass={...monthItems[1],done:false};
const completedDeadline={...activeDeadline,id:"complete",done:true};
const previewInput=[completedDeadline,activeClass,activeRoutine,activeDeadline];
const preview=dayPreview(previewInput,2,"collapse");
assert.deepEqual(preview.visible.map(e=>e.id),["deadline","routine"]);
assert.deepEqual(preview.overflow.map(e=>e.id),["class:month-class"]);
assert.deepEqual(preview.completed.map(e=>e.id),["complete"]);
assert.equal(previewInput[0].id,"complete"); // Projection does not reorder source data.
assert.equal(dayPreview([completedDeadline],3,"collapse").visible.length,0);
assert.equal(entryBadge(completedDeadline),"Hurdle");
assert.equal(entryBadge({...completedDeadline,task:{...completedDeadline.task,hurdle:false}}),"Quiz");
assert.equal(shortEntryTitle({...activeDeadline,title:"SQL Online Quiz"}),"SQL Quiz");
assert.equal(shortEntryTitle({...activeClass,title:"Tutorial"}),"Tut");
assert.deepEqual(restoreMonthPreferences({month:"2026-09",unit:"TEST1001",classes:false,completed:false},"2026-10","2026-08","2026-11",["TEST1001"]),{month:"2026-09",unit:"TEST1001",classes:false,completedMode:"hide"});
assert.deepEqual(restoreMonthPreferences({month:"2026-99",unit:"OLD1001",classes:"false"},"2026-10","2026-08","2026-11",["TEST1001"]),{month:"2026-10",unit:"all",classes:true,completedMode:"show"});
assert.equal(restoreMonthPreferences({month:"2025-09"},"2026-10","2026-08","2026-11",[]).month,"2026-10");
console.log("PASS: unfinished deadline/routine/class priority, completed grouping, immutable projection, persistent hurdle/quiz labels, compact titles and validated view preferences.");

const stableEntries=[activeClass,activeDeadline,activeRoutine];
const beforeTick=dayPreview(stableEntries).visible.map(e=>e.id);
assert.deepEqual(dayPreview(stableEntries.map(e=>({...e,done:true}))).visible.map(e=>e.id),beforeTick);
assert.equal(dayPreview([completedDeadline]).visible[0].done,true);
assert.equal(dayPreview([completedDeadline],3,"hide").visible.length,0);
assert.equal(dayPreview(previewInput,2,"show").visible.some(e=>e.done),false);
assert.equal(dayPreview(previewInput,2,"show").overflow.some(e=>e.id==="complete"),true);
for(const mode of ["show","collapse","hide"] as const)assert.equal(restoreMonthPreferences({completedMode:mode},"2026-10","2026-08","2026-11",[]).completedMode,mode);
assert.equal(restoreMonthPreferences({completed:true},"2026-10","2026-08","2026-11",[]).completedMode,"show");
assert.equal(restoreMonthPreferences({completedMode:"invalid"},"2026-10","2026-08","2026-11",[]).completedMode,"show");
console.log("PASS: stable completed-item positions, all three display modes, crowded-day priority and legacy preference migration.");
