import test from "node:test";
import assert from "node:assert/strict";
import { importedAssessments } from "../../lib/imported-assessments";
import type { Task, Semester } from "../../lib/semester";
import { findFocusRow, focusTimeline, focusURL, IMPORTED_URL, ownsFocusTimeline, readFocusURL } from "./deadline-focus";

const scope = "a".repeat(32), other = "b".repeat(32);
const now = Date.parse("2026-11-02T06:00:00Z");
const item:Task = {id:"tut/wed #2?",title:"Prework",unit:"TEST1000",kind:"recurring",date:"2026-11-04",
 time:"12:00",timeBasis:"class",timing:"Before your tutorial",weight:"",source:"",sourceText:"",description:"",group:false,hurdle:false};
const board:Semester={year:2026,session:"S2C",feedUrl:"",importedAt:"example",weeks:[],classes:[],warnings:[],completed:{},
 units:[{code:item.unit,name:"Test",session:"S2C",outline:"",status:"",summary:"",topics:[],assessments:[]}],
 tasks:[{...item,id:"activity",date:"2026-11-03",timing:"During workshop"},
  {...item,id:"done",date:"2026-11-03",done:true},{...item,id:"unknown",date:undefined},{...item,id:"past",date:"2026-11-01"},
  {...item,id:"exam",kind:"exam"},{...item,id:"event",kind:"event"},{...item,id:"retired",unit:"OTHER"},
  item,{...item,id:"next",time:"16:00"},{...item,id:"untimed",time:undefined,timeBasis:"deadline",timing:"Day only"}]};
const view=importedAssessments(board);
test("choose the first actual unfinished deadline and switch at Sydney time to the exact occurrence",()=>{
 const list=focusTimeline(view.rows,scope,now);
 assert.equal(list[0].props.url,focusURL({scope,id:item.id}));
 assert.match(list[0].props.meta,/before 12:00/);
 const noon=Date.parse("2026-11-04T01:00:00Z"), four=Date.parse("2026-11-04T05:00:00Z");
 const next=list.find(e=>e.date.getTime()===noon)!;
 assert.equal(readFocusURL(next.props.url)?.id,"next");
 const dateOnly=list.find(e=>e.date.getTime()===four)!;
 assert.equal(readFocusURL(dateOnly.props.url)?.id,"untimed");
 assert.match(dateOnly.props.meta,/time TBC/);
 assert.equal(list.find(e=>e.date.getTime()===Date.parse("2026-11-04T13:00:00Z"))?.props.title,"No upcoming deadline");
 assert.equal(list.at(-1)?.props.url,IMPORTED_URL);
 assert.equal(list.at(-1)?.props.title,"Refresh deadlines");
});
test("a stale item link cannot resolve a same-ID row in another account or a missing item",()=>{
 const link=focusURL({scope,id:item.id});
 const parsed=readFocusURL(link)!;
 assert.equal(findFocusRow(view,scope,parsed)?.id,item.id);
 assert.equal(findFocusRow(view,other,parsed),undefined);
 assert.equal(findFocusRow(view,scope,{scope,id:"absent"}),undefined);
 for(const bad of [link+"?id=wrong",link+"#bad",link+"/more",link.replace(scope,"foreign"),link.replace(/\/[^/]+$/,"/%zz")])assert.equal(readFocusURL(bad),null);
 const exported=focusTimeline(view.rows,scope,now);
 assert.equal(ownsFocusTimeline(exported,other),false);
 assert.equal(ownsFocusTimeline(exported,scope),true);
 assert.ok(exported.every(e=>!('grade' in e.props) && !('subject' in e.props)));
});
test("date-only deadlines survive Sydney DST until the next local midnight",()=>{
 const dateOnly={...view.rows[0],deadlineMode:"due" as const,date:"2026-10-04",time:null};
 const list=focusTimeline([dateOnly],scope,Date.parse("2026-10-03T12:00:00Z"));
 assert.equal(list.find(e=>e.date.getTime()===Date.parse("2026-10-04T13:00:00Z"))?.props.url,IMPORTED_URL);
});
