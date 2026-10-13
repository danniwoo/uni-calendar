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
db.close();
console.log("PASS: recovery SQL, account isolation, stale-revision safety, transaction rollback and one-step recovery rotation.");
