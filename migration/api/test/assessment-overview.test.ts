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
