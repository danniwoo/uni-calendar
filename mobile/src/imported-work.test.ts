import test from "node:test";
import assert from "node:assert/strict";
import { readImportedAssessments, selectImportedWork } from "./imported-work";

test("filtering keeps completed, week-only and unscheduled work, including zero marks", () => {
  const row = {id:"unknown",unit:"A",title:"Quiz",date:null,time:null,timing:"Week 4",weight:"",done:true};
  const units = ["A","B"].map(code=>({code,name:code,average:null,currentWeight:0}));
  const grades = ["A","B"].map(unit=>({id:unit,unit,title:"Quiz",weight:"",mark:{earned:0,possible:10},ratio:0,
    finished:true,recorded:1,total:1,error:null,source:"overall",rule:null,parts:[]}));
  const data = readImportedAssessments({version:1,year:2026,session:"S2C",units,grades,rows:[
    row,{...row,id:"past",date:"2026-11-01"},{...row,id:"today",date:"2026-11-02",time:"16:00"},
    {...row,id:"also-unknown",unit:"B",timing:"",done:false}]});
  const all = selectImportedWork(data,null,"2026-11-02");
  assert.deepEqual(all.undated.map(item=>item.id),["unknown","also-unknown"]);
  const onlyA = selectImportedWork(data,"A","2026-11-02");
  assert.deepEqual(onlyA.undated.map(item=>item.id),["unknown"]);
  assert.deepEqual(onlyA.upcoming.map(item=>item.id),["today"]);
  assert.deepEqual(onlyA.earlier.map(item=>item.id),["past"]);
  assert.deepEqual(onlyA.grades.map(item=>item.mark?.earned),[0]);
  assert.throws(()=>readImportedAssessments({...data,rows:[{...row,date:12}]}));
});
