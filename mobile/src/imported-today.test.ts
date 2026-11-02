import test from "node:test";
import assert from "node:assert/strict";
import { todaySuggestions } from "./imported-today";
import type { ImportedAssessments } from "./imported-work";
const now=Date.parse("2026-11-02T07:00:00Z");
const row:ImportedAssessments["rows"][number]={id:"demo",unit:"TEST",title:"Demo",date:"2026-11-03",time:"12:00",timing:"During workshop",weight:"",done:false,deadlineMode:null,scheduledActivity:true};
const board:ImportedAssessments={version:1,year:2026,session:"S2C",weeks:[],units:[],grades:[],overview:[],rows:[
  {...row,id:"finished",done:true}, {...row,id:"past",date:"2026-11-02",time:"12:00"},row,
  {...row,id:"w1",title:"Prework",date:"2026-11-04",deadlineMode:"before",scheduledActivity:false},
  {...row,id:"w2",title:"Prework",date:"2026-11-05",deadlineMode:"before",scheduledActivity:false},
  {...row,id:"later",date:"2026-12-01"}, {...row,id:"unknown",date:null}]};
test("Today suggests real future occurrences in order, even with no personal plan",()=>{
 const suggestions=todaySuggestions(board,now);
 assert.deepEqual(suggestions.map(s=>s.id),["demo","w1","w2"]);
 assert.equal(suggestions[0].title,"Rehearse Demo");
 assert.match(suggestions[1].context,/before 12:00/);
 assert.notEqual(suggestions[1].sourceKey,suggestions[2].sourceKey);
});
test("with no upcoming work Today can suggest checking an unknown date without inventing a deadline",()=>{
 const suggestions=todaySuggestions({...board,rows:[board.rows.at(-1)!]},now);
 assert.match(suggestions[0].title,/Check the date/);assert.equal(suggestions[0].context,"Exact date unconfirmed");
 assert.deepEqual(todaySuggestions({...board,rows:[]},now),[]);
});
