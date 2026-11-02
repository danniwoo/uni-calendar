import test from "node:test";
import assert from "node:assert/strict";
import { importedAssessments } from "../../lib/imported-assessments";
import type { Semester, Task } from "../../lib/semester";
import { homeSummary } from "./imported-home";

const task:Task = {id:"before",unit:"TEST",kind:"quiz",title:"Prework",date:"2026-11-02",time:"12:00",
  timeBasis:"class",timing:"Before tutorial",weight:"",description:"",source:"",sourceText:"",hurdle:false,group:false};
const backup:Semester = {year:2026,session:"S2C",importedAt:"sample",classes:[],feedUrl:"",warnings:[],completed:{},
  weeks:[{id:"13",kind:"teaching",label:"Week 13",start:"2026-11-02",end:"2026-11-08"},
    {id:"study",kind:"study",label:"Study vacation",start:"2026-11-09",end:"2026-11-15"}],
  units:[{code:"TEST",name:"Example",session:"S2C",outline:"",status:"",summary:"",assessments:[],topics:[]}],
  tasks:[task,{...task,id:"inclass",timing:"During tutorial",date:"2026-11-03"},
    {...task,id:"closed",done:true},{...task,id:"no-date",date:undefined,done:true},
    {...task,id:"sun",date:"2026-11-08",time:undefined},{...task,id:"next",date:"2026-11-09"},
    {...task,id:"retired",unit:"OLD"},{...task,id:"parent",splitCount:3}]};
test("Sydney Home uses imported weeks and separate deadline/activity counts, including the Sunday/Monday boundary",()=>{
  // Monday in Sydney, still Sunday in UTC.
  const view = homeSummary(importedAssessments(backup),Date.parse("2026-11-01T13:15:00Z"));
  assert.equal(view.today,"2026-11-02");
  assert.equal(view.currentPeriod,"Week 13");
  assert.equal(view.nextPeriod,"Study vacation");
  assert.deepEqual(view.day.rows.map(r=>r.id),["before"]);
  assert.deepEqual(view.week.rows.map(r=>r.id),["before","inclass","sun"]);
  assert.equal(view.week.deadlines,2);
  assert.equal(view.week.activities,1);
  assert.deepEqual(view.nextWeek.rows.map(r=>r.id),["next"]);
  assert.equal(view.nextDeadline?.id,"before");
  assert.equal(view.undated,1);
});
test("today keeps unfinished past-time items visible while the next deadline advances; weeks outside the term are labelled honestly",()=>{
  const data = importedAssessments(backup);
  const after = homeSummary(data,Date.parse("2026-11-02T02:00:00Z"));
  assert.equal(after.day.deadlines,1);
  assert.equal(after.nextDeadline?.id,"sun");
  assert.equal(homeSummary(data,Date.parse("2026-11-09T05:00:00Z")).currentPeriod,"Study vacation");
  assert.equal(homeSummary(data,Date.parse("2026-11-16T05:00:00Z")).currentPeriod,"Semester finished");
  assert.equal(homeSummary(data,Date.parse("2026-10-31T05:00:00Z")).currentPeriod,"Before semester");
});
