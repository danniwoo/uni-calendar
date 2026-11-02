import test from "node:test";
import assert from "node:assert/strict";
import { importedMonth } from "./imported-month";
import type { ImportedAssessments } from "./imported-work";
import {monthCells,shiftMonth} from "./experience";

const row:ImportedAssessments["rows"][number]={id:"a",unit:"A",title:"Report",date:"2026-11-04",time:"16:00",timing:"",weight:"",done:false,deadlineMode:"due",scheduledActivity:false};
const board:ImportedAssessments={version:1,year:2026,session:"S2C",units:[],weeks:[],overview:[],grades:[],rows:[
  row,{...row,id:"b",unit:"B",time:"12:00",deadlineMode:null,scheduledActivity:true,done:true},
  {...row,id:"c",date:"2026-10-31"}, {...row,id:"d",date:"2026-12-01"},
  {...row,id:"u-a",date:null,deadlineMode:null}, {...row,id:"u-b",unit:"B",date:null,deadlineMode:null,done:true},
  {...row,id:"other",date:"2026-11-25",time:null,deadlineMode:null}
]};
test("month markers count each dated occurrence once, retain completed activities and keep unknown dates outside the grid",()=>{
 const result=importedMonth(board,"2026-11",null);
 assert.deepEqual(result.totals,{deadlines:1,activities:1,other:1});
 assert.deepEqual([...result.days.keys()],["2026-11-04","2026-11-25"]);
 assert.deepEqual(result.days.get("2026-11-04")?.items.map(x=>x.id),["b","a"]);
 assert.equal(result.days.get("2026-11-04")?.items[0].done,true);
 assert.equal(result.undated,2);
});
test("unit selection, adjacent months, leap days and empty months preserve the undated count",()=>{
 const filtered=importedMonth(board,"2026-11","B");
 assert.deepEqual(filtered.totals,{deadlines:0,activities:1,other:0});
 assert.equal(filtered.undated,1);
 assert.equal(importedMonth(board,shiftMonth("2026-11",-1),"A").days.get("2026-10-31")?.items[0].id,"c");
 const empty=importedMonth(board,shiftMonth("2026-12",1),null);
 assert.equal(empty.days.size,0);
 assert.equal(empty.undated,2);
 assert.ok(monthCells("2028-02").includes("2028-02-29"));
});
