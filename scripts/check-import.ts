// Synthetic fixtures only: no personal timetable, locations or subscription URL.
import assert from "node:assert/strict";
import { parseICS, parseOutline, scheduleTasks, upgradeSemester } from "../lib/importer";
import { calendar, mergeSemester, weekFor, needsPlacement, isPast, type Semester } from "../lib/semester";
import { reconcile } from "../lib/sync";
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
