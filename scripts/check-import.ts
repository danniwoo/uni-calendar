// Synthetic fixtures only: no personal timetable, locations or subscription URL.
import assert from "node:assert/strict";
import { parseICS, parseOutline, scheduleTasks } from "../lib/importer";
import { calendar, mergeSemester, weekFor, type Semester } from "../lib/semester";
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
assert.equal(tasks[3].kind,"recurring");
assert.equal(tasks[3].week,undefined);
const fresh:Semester={...parsed,units:[unit],tasks,completed:{},feedUrl:"",importedAt:"",warnings:[]};
const old:Semester={...fresh,tasks:[{...tasks[0],title:"My edit",manual:true,done:true}],completed:{[parsed.classes[0].id]:true}};
const merged=mergeSemester(old,{...fresh});
assert.equal(merged.tasks[0].title,"My edit");
assert.equal(merged.tasks[0].done,true);
assert.equal(merged.completed[parsed.classes[0].id],true);
assert.throws(()=>parseICS(feed.replace("UID:example1","RRULE:FREQ=WEEKLY\nUID:example1")));
console.log("PASS: ICS, teaching weeks, breaks, due vs closing dates, tutorial mapping, undated series and refresh preservation.");
