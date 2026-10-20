import assert from "node:assert/strict";
import {calendar,mergeSemester,type Semester,type Task} from "../lib/semester";
import {activityError,activityRange,activityLabel,activitiesInRange} from "../lib/assessment-activity";
import {assessmentRows,assessmentOverviewSchedule,defaultAssessmentFilters} from "../lib/assessment-list";
import {weekData} from "../lib/week-calendar";
import {monthEntries} from "../lib/month-calendar";
import {readBackup,backupText} from "../lib/backup";
import {reconcile} from "../lib/sync";

const t:Task={id:"demo",unit:"TEST1001",title:"Final delivery",kind:"assessment",weight:"10%",date:"2026-11-01",time:"23:59",week:12,timing:"Deadline",description:"",source:"",sourceText:"",hurdle:false,group:true,grade:{earned:8,possible:10}};
const s:Semester={year:2026,session:"S2C",weeks:calendar(2026,"S2C"),units:[{code:t.unit,name:"Test",session:"S2C",outline:"",summary:"",status:"ready",assessments:[t],topics:[]}],tasks:[t],classes:[],completed:{},feedUrl:"",importedAt:"2026-10-20",warnings:[]};
const a={...t,activity:{label:"Client demo",startDate:"2026-10-26",endDate:"2026-10-30"},manual:true,overrides:["activity"]};
const withActivity={...s,tasks:[a]};
assert.equal(activityError(a.activity,s),"");
assert.deepEqual(activityRange(a,s),{start:"2026-10-26",end:"2026-10-30"});
assert.equal(activityLabel(a),"Client demo · 26 Oct – 30 Oct");
assert.equal(activityLabel({...a,activity:{label:"",week:12}}),"Activity · W12");
assert.equal(activitiesInRange(s,[a],"2026-10-19","2026-10-25").length,0);
assert.equal(activitiesInRange(s,[a],"2026-10-26","2026-11-01").length,1);
const weekly=weekData(withActivity,"2026-10-26");
assert.equal(weekly.activities.length,1);
assert.equal(weekly.due.length,1);
assert.equal(weekly.events.length,0); // Range is not a five-day booking.
assert.equal(weekly.due[0].date,"2026-11-01");
assert.equal(weekData(withActivity,"2026-10-26","OTHER").activities.length,0);
assert.equal(monthEntries(withActivity).length,1); // Only one due entry, no daily copies.
const rows=assessmentRows(withActivity,defaultAssessmentFilters,"2026-10-20","overview");
assert.equal(rows.length,1);assert.equal(rows[0].total,1);
assert.deepEqual(assessmentOverviewSchedule(withActivity,rows[0]),{label:"Due 1 Nov · 23:59",detail:"Client demo · 26 Oct – 30 Oct"});
assert.deepEqual(rows[0].task.grade,t.grade);assert.equal(rows[0].task.weight,"10%");
const weekOnly={...a,activity:{label:"Demo",week:12}};
assert.equal(activityError(weekOnly.activity,s),"");
assert.deepEqual(activityRange(weekOnly,s),{start:"2026-10-26",end:"2026-11-01"});
const confirmed={...a,activity:{label:"Demo",startDate:"2026-10-28",time:"11:00"}};
assert.equal(activityError(confirmed.activity,s),"");
assert.equal(activityLabel(confirmed),"Demo · 28 Oct · 11:00");
assert.equal(confirmed.date,"2026-11-01");
for(const invalid of [[],"bad",{}, {label:"Demo",week:0},{label:"Demo",week:1.5},{label:"Demo",week:14},{label:"Demo",startDate:"2026-02-30"},{label:"Demo",startDate:"2026-10-30",endDate:"2026-10-26"},{label:"Demo",startDate:"2026-10-30",time:"25:00"},{label:"Demo",startDate:"2026-10-26",endDate:"2026-10-30",time:"11:00"},{label:"Demo",week:12,startDate:"2026-10-26"}]) {
  assert.ok(activityError(invalid,s),JSON.stringify(invalid));
  assert.throws(()=>readBackup(backupText({...s,tasks:[{...t,activity:invalid as Task["activity"]}]})),/invalid/);
}
assert.ok(activityError({label:"Demo",startDate:"2027-01-01"},s));
assert.equal(activityError(null,s),"");assert.equal(activityError(undefined,s),"");
assert.deepEqual(readBackup(backupText(withActivity)).tasks[0].activity,a.activity);
assert.deepEqual(mergeSemester(withActivity,structuredClone(s)).tasks[0].activity,a.activity);
const cleared={...withActivity,tasks:[{...a,activity:null}]};
assert.equal(mergeSemester(cleared,structuredClone(s)).tasks[0].activity,null);
const local={...withActivity,tasks:[confirmed]},remote={...withActivity,tasks:[{...a,description:"Separate notes edit",done:true}]};
const merged=reconcile(withActivity,local,remote);
assert.deepEqual(merged.conflicts,[]);assert.deepEqual(merged.semester.tasks[0].activity,confirmed.activity);
assert.equal(merged.semester.tasks[0].description,"Separate notes edit");assert.equal(merged.semester.tasks[0].done,true);
assert.equal(s.tasks[0].activity,undefined); // No automatic mutation of source records.
console.log("PASS: optional activity week/range/date, validation, calendar reminders, one assessment/grade, unchanged deadlines, backup, refresh, removal and concurrent edits.");
