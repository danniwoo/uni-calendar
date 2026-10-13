import assert from "node:assert/strict";
import {readBackup,backupText,replaceBoard,sameUnits,activeTasks} from "../lib/backup";
import {calendar,mergeSemester,type Semester,type Task} from "../lib/semester";
import {reconcile} from "../lib/sync";
import {upgradeSemester} from "../lib/importer";

const task:Task={id:"shared-task",unit:"TEST1001",title:"Report",weight:"20%",timing:"Week 10",week:10,
  description:"",source:"",sourceText:"",kind:"assessment",hurdle:false,group:false,manual:true,done:true};
const a:Semester={year:2026,session:"S2C",weeks:calendar(2026,"S2C"),
  units:[{code:"TEST1001",name:"Test unit",session:"S2C",outline:"",summary:"",status:"ready",assessments:[task],topics:[]}],
  tasks:[task],classes:[{id:"a-class",unit:"TEST1001",activity:"Lecture",date:"2026-10-12",time:"10:00",end:"11:00",location:"Test room",week:10}],
  completed:{"a-class":true},feedUrl:"https://example.invalid/feed-a",importedAt:"2026-10-01",warnings:[]};
const b:Semester={...structuredClone(a),units:[{...a.units[0],code:"TEST2002",assessments:[]}],
  tasks:[{...task,id:"b-task",unit:"TEST2002",done:false}],classes:[{...a.classes[0],id:"b-class",unit:"TEST2002"}],completed:{"b-class":false},feedUrl:"https://example.invalid/feed-b"};
const restored=replaceBoard(readBackup(backupText(b)),"restore-1");
assert.deepEqual(restored.units,b.units);assert.deepEqual(restored.classes,b.classes);
assert.deepEqual(restored.tasks,b.tasks);assert.deepEqual(restored.completed,b.completed);
assert.equal(restored.feedUrl,"");assert.equal(restored.boardGeneration,"restore-1");
assert.equal(backupText(a).includes("example.invalid"),false);
assert.equal(a.tasks[0].done,true,"Restoration must not mutate its previous board");
assert.deepEqual(mergeSemester(a,structuredClone(b)),b,"Different feeds must not inherit tasks or completion");
const sameCodeDifferentFeed={...structuredClone(a),feedUrl:b.feedUrl,tasks:[{...task,done:false}],completed:{}};
assert.equal(mergeSemester(a,sameCodeDifferentFeed).tasks[0].done,false,"Matching unit/task IDs cannot establish student identity");
const refreshed=mergeSemester({...a,boardGeneration:"old"},{...structuredClone(a),completed:{},tasks:[{...task,done:false}]});
assert.equal(refreshed.tasks[0].done,true);assert.equal(refreshed.boardGeneration,"old");
assert.equal(sameUnits(a,b),false);assert.equal(sameUnits(a,sameCodeDifferentFeed),true);
const s1={...a,session:"S1C",weeks:calendar(2026,"S1C")};
assert.equal(readBackup(backupText(s1)).session,"S1C","Restore another supported semester without merging");
assert.deepEqual(mergeSemester(a,structuredClone(s1)),s1);
const stale={...structuredClone(a),tasks:[{...task,title:"Other tab edit"}]};
for(const base of [a,null]){
  const conflict=reconcile(base,replaceBoard(a,"new"),stale);
  assert.match(conflict.conflicts[0],/Whole board/);
  assert.deepEqual(reconcile(base,replaceBoard(a,"new"),stale,"remote").semester,stale);
}
const roundTrip=readBackup(backupText(restored));
assert.equal(roundTrip.boardGeneration,"restore-1");
assert.equal(upgradeSemester(restored).boardGeneration,"restore-1");
const mixed={...b,tasks:[...b.tasks,...a.tasks]};
assert.deepEqual(activeTasks(mixed),b.tasks,"Inactive tasks must not pollute semester summaries");
assert.equal(mixed.tasks.length,2,"Retained records remain available in export");
for(const invalid of [{...a,units:null},{...a,completed:[]},{...a,tasks:[{id:"bad",title:"Bad"}]},{...a,tasks:[task,task]},
  {...a,classes:null},{...a,weeks:[]},{...a,tasks:[{...task,rules:{text:7}}]},{...a,year:2027}])
  assert.throws(()=>readBackup(JSON.stringify(invalid)));
assert.throws(()=>readBackup("not json"));assert.throws(()=>readBackup(" ".repeat(1_500_001)));
console.log("PASS: full snapshot restore, link privacy, different-feed isolation (including shared units), refresh preservation, semester switching, stale-tab replacement conflicts, upgrade/reload generation and validation.");
