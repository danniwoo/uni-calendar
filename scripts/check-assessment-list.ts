import assert from "node:assert/strict";
import { calendar, type Semester, type Task } from "../lib/semester";
import { assessmentRows, assessmentListDate, assessmentListWeight, defaultAssessmentFilters as defaults, assessmentDateMatches, assessmentDateSections, assessmentStepLabel } from "../lib/assessment-list";

const task:Task={id:"report",unit:"TEST1001",title:"Report",kind:"assessment",weight:"10%",date:"2026-10-23",time:"23:59",timing:"Due",description:"",source:"",sourceText:"",hurdle:false,group:false};
const quiz:Task={...task,id:"quiz",title:"Weekly quizzes",kind:"recurring",date:undefined,weight:"21%",rules:{text:"Best seven",perOccurrence:3,total:21,bestOf:7}};
const project={...task,id:"project",title:"Group project",date:undefined,splitCount:2};
const s:Semester={year:2026,session:"S2C",weeks:calendar(2026,"S2C"),feedUrl:"",importedAt:"",completed:{},classes:[],warnings:[],
  units:[{code:"TEST1001",name:"Test",session:"S2C",outline:"",status:"",summary:"",topics:[],assessments:[task,quiz,project]}, {code:"TEST1002",name:"Test 2",session:"S2C",outline:"",status:"",summary:"",topics:[],assessments:[]}],
  tasks:[{...task,title:"Edited report"},project,{...task,id:"demo",title:"Demo",parentId:"project",splitPart:1,weight:"",timeBasis:"class",timing:"In tutorial",date:"2026-10-15",time:"16:00",endTime:"18:00",done:true},
    {...task,id:"submission",title:"Final hand-in",parentId:"project",splitPart:2,weight:"",date:undefined,week:12},
    {...quiz,id:"q1",title:"Quiz week 1",series:"quiz",date:"2026-08-07",done:true},
    {...quiz,id:"q2",title:"Quiz week 11",series:"quiz",date:"2026-10-23",week:11,timeBasis:"class",timing:"In tutorial"},
    {...task,id:"exam",title:"Final exam",kind:"exam",date:undefined,week:14,weight:"50%"},
    {...task,id:"unknown",title:"Undated report",date:undefined,weight:""},
    {...task,id:"other",unit:"TEST1002",title:"Other unit",weight:"20%"},
    {...task,id:"inactive",unit:"OLD1001"},{...task,id:"personal",kind:"task"},{...task,id:"meeting",kind:"event"},
  ]};
const before=JSON.stringify(s);
const rows=assessmentRows(s,defaults,"2026-10-18");
assert.equal(rows.length,6);
assert.equal(rows.find(r=>r.task.id==="report")?.task.title,"Edited report");
assert.equal(rows.some(r=>["personal","meeting","inactive","q1","demo"].includes(r.task.id)),false);
const group=rows.find(r=>r.task.id==="project")!;
assert.equal(group.completed,1);assert.equal(group.total,2);assert.equal(group.done,false);
assert.equal(group.next?.id,"submission");
assert.equal(assessmentListWeight(group.task,true),"10% total");
assert.equal(assessmentListWeight(group.children[0]),"—","unknown child weight is not inferred from parent");
assert.equal(assessmentListWeight(s.tasks.find(t=>t.id==="q2")!),"3% each · 21% cap");
assert.match(assessmentListDate(s.tasks.find(t=>t.id==="demo")!),/Tutorial/);
assert.match(assessmentListDate(task),/^Due/);
assert.match(assessmentListDate(group.next!),/W12.*TBC/);
assert.equal(assessmentListDate(s.tasks.find(t=>t.id==="exam")!),"Awaiting exam date");
assert.deepEqual(assessmentRows(s,{...defaults,dates:"exams"},"2026-10-18").map(r=>r.task.id),["exam"]);
assert.deepEqual(new Set(assessmentRows(s,{...defaults,dates:"unknown"},"2026-10-18").map(r=>r.task.id)),new Set(["project","unknown"]));
assert.equal(assessmentDateMatches(s,{...task,date:undefined,week:10},"past","2026-10-18"),false);
assert.equal(assessmentDateMatches(s,{...task,date:undefined,week:10},"past","2026-10-19"),true);
assert.equal(assessmentRows(s,{...defaults,query:" final HAND-in "},"2026-10-18")[0].task.id,"project");
assert.equal(assessmentRows(s,{...defaults,status:"done"},"2026-10-18").length,2);
assert.equal(assessmentRows(s,{...defaults,dates:"past",status:"open"},"2026-10-18").length,0);
assert.equal(assessmentRows(s,{...defaults,unit:"TEST1002"},"2026-10-18").length,1);
assert.equal(assessmentRows(s,{...defaults,query:"not there"},"2026-10-18").length,0);
assert.equal(assessmentRows(s,{...defaults,sort:"weight",descending:true},"2026-10-18")[0].task.id,"exam");
assert.equal(assessmentRows(s,{...defaults,sort:"weight",descending:true},"2026-10-18").at(-1)?.task.id,"unknown");
for (const descending of [false,true]) assert(assessmentRows(s,{...defaults,descending},"2026-10-18").slice(-2).every(r=>!r.next?.date&&!r.next?.week||r.task.kind==="exam"));
const completed={...s,tasks:s.tasks.map(t=>t.parentId==="project"?{...t,done:true}:t)};
assert.equal(assessmentRows(completed,defaults,"2026-10-18").find(r=>r.task.id==="project")?.done,true);
assert.equal(assessmentRows(completed,{...defaults,status:"open"},"2026-10-18").some(r=>r.task.id==="project"),false);
const moved={...s,tasks:s.tasks.map(t=>t.id==="report"?{...t,unit:"TEST1002"}:t)};
assert.equal(assessmentRows(moved,defaults,"2026-10-18").filter(r=>r.task.id==="report").length,1);
assert.equal(assessmentRows(moved,{...defaults,unit:"TEST1001"},"2026-10-18").some(r=>r.task.id==="report"),false);
const orphan={...s,tasks:[...s.tasks,{...task,id:"orphan",parentId:"missing"}]};
assert(assessmentRows(orphan,defaults,"2026-10-18").some(r=>r.task.id==="orphan"),"orphan steps remain findable");
assert.equal(JSON.stringify(s),before,"inventory must not modify saved records");
const sections=assessmentDateSections(s,rows,"2026-10-18");
assert.equal(sections.find(g=>g.key==="2026-10-19")?.label,"Next week · Week 11");
assert.equal(sections.find(g=>g.key==="2026-10-26")?.label,"Week 12");
assert.equal(sections.find(g=>g.key==="exams")?.label,"Awaiting exam dates");
assert.equal(sections.find(g=>g.key==="unknown")?.rows[0].task.id,"unknown");
assert.equal(sections.flatMap(g=>g.rows).length,rows.length);
assert.equal(assessmentStepLabel(s,group,"2026-10-18"),"Next step");
assert.equal(assessmentStepLabel(s,{...group,next:group.children[0]},"2026-10-18"),"Recorded step");
assert.equal(assessmentStepLabel(s,{...group,next:{...group.children[0],done:false}},"2026-10-18"),"Past step · unrecorded");
const makeRow=(date:string,week?:number)=>({...group,task:{...task,date,week},next:{...task,date,week}});
assert.equal(assessmentDateSections(s,[makeRow("2026-10-18",3)],"2026-10-18")[0].label,"This week · Week 10","exact date wins over stale week");
assert.equal(assessmentDateSections(s,[makeRow("2026-10-18")],"2026-10-19")[0].label,"Past · Week 10","Monday boundary uses Sydney date passed in");
assert.equal(assessmentDateSections(s,[makeRow("2026-09-30")],"2026-09-27")[0].label,"Next week · Midsemester break");
assert.equal(assessmentDateSections(s,[makeRow("2026-11-23")],"2026-11-18")[0].label,"Next week · Exam period","two-week exam period has separate calendar weeks");
assert.equal(assessmentDateSections(s,[makeRow("2027-01-01")],"2026-12-31")[0].label,"This week · Week of 28 Dec");
const reverseSections=assessmentDateSections(s,assessmentRows(s,{...defaults,descending:true},"2026-10-18"),"2026-10-18");
assert.deepEqual(reverseSections.filter(g=>g.start).map(g=>g.key),["2026-10-26","2026-10-19"]);
assert.equal(JSON.stringify(s),before,"date sections must not modify saved records");
console.log("PASS: assessment inventory isolation, grouping, status/date/search filters, stable sorting, honest weights, unknown exams and shared records.");
