// Exercise the production SQL against a disposable in-memory SQLite database.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
const db=new DatabaseSync(":memory:");
db.exec(readFileSync(new URL("../drizzle/0000_noisy_plazm.sql",import.meta.url),"utf8"));
db.exec(readFileSync(new URL("../drizzle/0001_lyrical_iron_patriot.sql",import.meta.url),"utf8"));
const route=readFileSync(new URL("../app/api/semester/route.ts",import.meta.url),"utf8");
const sql=prefix=>JSON.parse(route.match(new RegExp('"'+prefix+'[^"\\n]+"'))[0]);
const save=db.prepare(sql("INSERT INTO semesters "));
const archive=db.prepare(sql("INSERT INTO semester_recovery "));
const read=owner=>db.prepare("SELECT * FROM semesters WHERE owner = ?").get(owner);
const recovery=owner=>db.prepare("SELECT * FROM semester_recovery WHERE owner = ?").get(owner);
save.run("alice","board-a","now",0);save.run("bob","board-b","now",0);
function switchBoard(owner,revision,data,fail=false){
  db.exec("BEGIN");
  try {archive.run("now",owner,revision);if(fail)throw new Error("simulated failure");
    const result=save.run(owner,data,"now",revision);db.exec("COMMIT");return result.changes;
  }catch(e){db.exec("ROLLBACK");throw e;}
}
assert.equal(switchBoard("alice",1,"new-a"),1);
assert.equal(read("alice").data,"new-a");assert.equal(recovery("alice").data,"board-a");
assert.equal(read("bob").data,"board-b");assert.equal(recovery("bob"),undefined);
assert.equal(switchBoard("alice",1,"stale-a"),0);
assert.equal(read("alice").data,"new-a");assert.equal(recovery("alice").data,"board-a");
assert.throws(()=>switchBoard("alice",2,"failed-a",true));
assert.equal(read("alice").data,"new-a");assert.equal(recovery("alice").data,"board-a");
assert.equal(switchBoard("alice",2,"third-a"),1);assert.equal(recovery("alice").data,"new-a");
const grades={tasks:[{id:"quiz",grade:{earned:14,possible:20}},{id:"exam",grade:{earned:0,possible:100}}]};
assert.equal(save.run("grades",JSON.stringify(grades),"now",0).changes,1);
assert.deepEqual(JSON.parse(read("grades").data),grades,"Grade fractions and explicit zeros survive storage");
assert.equal(save.run("grades",JSON.stringify({tasks:[]}),"now",0).changes,0,"A stale save cannot discard grades");
assert.deepEqual(JSON.parse(read("grades").data),grades);
grades.tasks[0].grade=null;
grades.tasks[0].gradePlan={mode:"parts",method:"points",items:[{id:"p1",name:"Part 1",grade:{earned:2.7,possible:3}},{id:"p2",name:"Part 2",maximum:3,grade:null},{id:"demo",name:"Demo",excluded:true}]};
assert.equal(save.run("grades",JSON.stringify(grades),"now",1).changes,1);
assert.equal(JSON.parse(read("grades").data).tasks[0].grade,null,"Clearing a grade persists independently from zero");
assert.deepEqual(JSON.parse(read("grades").data).tasks[0].gradePlan,grades.tasks[0].gradePlan,"Part scores, ungraded maxima and exclusions survive storage");
db.close();
console.log("PASS: recovery SQL, account isolation, stale-revision safety, transaction rollback and one-step recovery rotation.");
