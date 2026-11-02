import assert from "node:assert/strict";
import test from "node:test";
import { importedAssessments } from "../../../lib/imported-assessments.ts";
import type { Semester, Task } from "../../../lib/semester.ts";

test("grade overview includes unmarked quizzes and displays recurring completion points separately", () => {
  const base: Task = {id:"quiz", unit:"TEST1000", title:"Quiz", kind:"quiz", date:"2026-09-03",
    weight:"10%", timing:"", description:"", source:"", sourceText:"", hurdle:false, group:false};
  const group: Task = {...base, id:"prework", title:"Prework", date:undefined, kind:"recurring", weight:"4%",
    gradePlan:{mode:"parts", method:"completion", bestCount:2, completionPoints:2, items:[
      {id:"one",name:"One",outcome:"submitted"}, {id:"two",name:"Two",outcome:"missed"}, {id:"three",name:"Three"},
    ]}};
  const child = (id:string,date:string): Task => ({...base,id,date,series:group.id});
  const board: Semester = {year:2026,session:"S2C",importedAt:"example",classes:[],weeks:[],feedUrl:"",warnings:[],completed:{},
    units:[{code:base.unit,name:"Test",session:"S2C",outline:"",status:"",summary:"",topics:[],assessments:[base,group]}],
    tasks:[group,child("first","2026-08-05"),child("last","2026-10-07")]};
  const {overview,grades,units} = importedAssessments(board);
  assert.deepEqual(overview.map(row=>row.id),["prework","quiz"]);
  assert.deepEqual(overview[0],{id:"prework",unit:base.unit,title:"Prework",weight:"4% total",schedule:"Recurring · 5 Aug – 7 Oct"});
  assert.equal(grades.some(row=>row.id==="quiz"),false);
  assert.equal(grades[0].score,"2 / 4 points secured so far");
  assert.equal(grades[0].progress,"Best 2 of 3 · completion · 2 / 3 confirmed");
  assert.equal(units[0].average,null);
  assert.equal(units[0].securedCompletionPoints,2);
});

test("attempt dates belong to the specific result slot and only fully scheduled parents can leave date confirmation", () => {
  const base:Task={id:"q",unit:"A",title:"Quiz",kind:"quiz",timing:"During tutorial",weight:"15%",description:"",source:"",sourceText:"",hurdle:false,group:false,
    gradePlan:{mode:"parts",method:"highest",items:[{id:"one",name:"Attempt 1",grade:{earned:0,possible:15}},{id:"two",name:"Attempt 2"}]}};
  const child=(id:string,parentId:string,attemptId:string,date?:string):Task=>({...base,id,parentId,attemptId,date,gradePlan:undefined,weight:""});
  const board:Semester={year:2026,session:"S2C",importedAt:"example",classes:[],weeks:[],feedUrl:"",warnings:[],completed:{},units:[],
    tasks:[base,{...base,id:"other"},child("later","q","two","2026-11-04"),child("earlier","q","one","2026-10-28"),
      child("unconfirmed","other","one"),child("other-later","other","two","2026-11-05")]};
  const projection=importedAssessments(board);
  assert.equal(projection.rows.find(r=>r.id==="q")?.datesOnAttempts,true);
  assert.equal(projection.rows.find(r=>r.id==="other")?.datesOnAttempts,undefined);
  assert.deepEqual(projection.grades.find(g=>g.id==="q")?.parts.map(p=>[p.occurrenceId,p.mark?.earned]),[["earlier",0],["later",undefined]]);
  assert.deepEqual(projection.grades.find(g=>g.id==="other")?.parts.map(p=>p.occurrenceId),["unconfirmed","other-later"]);
});
