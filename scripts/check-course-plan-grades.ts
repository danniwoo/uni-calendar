import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import {coursePlanTestDb} from "./course-plan-test-db";
import {planDraft,wamSummary,wamExclusion,type PlanDraft,type PlanEntry} from "../lib/course-plan";
import {changeCoursePlan,readCoursePlan} from "../lib/course-plan-store";
import {coursePlanResponse} from "../lib/course-plan-api";

const base:PlanDraft={university:"usyd",code:"COMP1001",name:"Synthetic result",year:2026,session:"S1C",status:"completed",credits:6,finalMark:null,finalGrade:null,wamExcluded:false};
const make=(patch:Partial<PlanEntry>):PlanEntry=>({...base,id:crypto.randomUUID(),revision:1,updatedAt:"2026-11-02T00:00:00.000Z",...patch});
assert.equal(wamSummary([]).average,null);
assert.equal(wamSummary([make({finalMark:null,finalGrade:"HD"})]).average,null,"a letter grade never invents a numeric mark");
const first=make({finalMark:80,credits:6}),second=make({code:"COMP1002",finalMark:70,credits:12});
assert.ok(Math.abs(wamSummary([first,second]).average!-73.33333333333333)<1e-10,"credit weighting, not equal unit weighting");
const failure=make({finalMark:0,finalGrade:"FA",year:2025});
assert.equal(wamSummary([first,second,failure]).average,55,"explicit zero/failure counts with its attempted credits");
const retake=make({finalMark:100,year:2027});
assert.equal(wamSummary([first,second,failure,retake]).average,64,"same code in other semesters remains a separate attempt");
assert.equal(wamSummary([first,make({finalMark:null,credits:12})]).average,80,"unreleased marks do not add denominator weight");
assert.equal(wamSummary([first,make({finalMark:99,wamExcluded:true})]).average,80,"explicit transfer/exchange exclusions");
assert.equal(wamSummary([make({finalMark:100,credits:null})]).average,null);
assert.equal(wamSummary([make({finalMark:100,credits:0})]).average,null);
for(const grade of ["SR","FR","CN","DC","DF","IC","RI","UC","J2","WD","NE"," sr "]) {
  const p=make({finalMark:0,finalGrade:grade});
  assert.equal(wamSummary([p]).average,null,`${grade} must not turn a placeholder zero into a failure`);
  assert.ok(wamExclusion(p));
}
for(const patch of [{finalMark:-1},{finalMark:100.1},{finalMark:"85"},{finalMark:NaN},{finalGrade:23},{finalGrade:"X".repeat(25)},{wamExcluded:"yes"}])assert.throws(()=>planDraft({...base,...patch}));
assert.equal(planDraft({...base,finalMark:0}).finalMark,0);
assert.equal(planDraft({...base,finalGrade:"  "}).finalGrade,null);

const {db,sqlite}=coursePlanTestDb();
const change=(owner:string,body:unknown)=>changeCoursePlan(db,owner,body);
const read=(owner:string)=>readCoursePlan(db,owner);
for(const owner of ["owner","friend"])await change(owner,{action:"save-profile",name:`Sample ${owner}`,sharing:true,revision:0});
await change("owner",{action:"save-plan",id:null,revision:0,plan:{...base,finalMark:83.625,finalGrade:"PRIVATE-RESULT",wamExcluded:true}});
let row=(await read("owner")).plans[0];
assert.equal(row.finalMark,83.625);assert.equal(row.finalGrade,"PRIVATE-RESULT");assert.equal(row.wamExcluded,true);
const invite=await change("owner",{action:"create-invite"});
await change("friend",{action:"request-friend",code:invite.inviteCode});
const request=(await read("owner")).friends[0];
await change("owner",{action:"friend-action",friendId:request.id,connectionId:request.connectionId,revision:request.revision,operation:"accept"});
const friendRead=await read("friend");
assert.equal(friendRead.sharedPlans.length,1);
assert.deepEqual(Object.keys(friendRead.sharedPlans[0]).sort(),["university","code","name","year","session","status","credits","updatedAt","friendId","friendName"].sort(),"friend DTO is an explicit public allowlist");
const friendResponse=await coursePlanResponse(new Request("https://semester.example/api/course-plan"),"friend",()=>db);
const json=await friendResponse.text();
for(const secret of ["83.625","PRIVATE-RESULT","finalMark","finalGrade","wamExcluded","final_mark","final_grade","wam_excluded","average"])assert.equal(json.includes(secret),false,`${secret} must never reach a friend's browser`);
await assert.rejects(()=>change("friend",{action:"save-plan",id:row.id,revision:row.revision,plan:{...base,finalMark:10}}),/changed/);
// An old client editing public fields cannot erase newer private fields.
const {finalMark:_m,finalGrade:_g,wamExcluded:_e,...legacy}=base;
await change("owner",{action:"save-plan",id:row.id,revision:row.revision,plan:{...legacy,year:2027}});
row=(await read("owner")).plans[0];
assert.equal(row.finalMark,83.625);assert.equal(row.finalGrade,"PRIVATE-RESULT");assert.equal(row.wamExcluded,true);
const before=row;
await change("owner",{action:"save-plan",id:row.id,revision:row.revision,plan:{...base,status:"enrolled",finalMark:0,finalGrade:"FA",wamExcluded:false}});
row=(await read("owner")).plans[0];
assert.equal(row.finalMark,0);assert.equal(row.status,"enrolled","saving grades does not infer completion");
assert.equal(wamSummary([row]).average,0);
await assert.rejects(()=>change("owner",{action:"save-plan",id:row.id,revision:before.revision,plan:{...base,finalMark:99}}),/changed/);
await change("owner",{action:"save-plan",id:row.id,revision:row.revision,plan:base});
row=(await read("owner")).plans[0];
assert.equal(row.finalMark,null);assert.equal(row.finalGrade,null);assert.equal(wamSummary([row]).average,null,"explicit clears remove prior results");
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM semesters").get()!.n,0,"existing assessment-grade board is untouched");
sqlite.close();

// Verify the appended migration preserves populated pre-result plans.
const migrationDb=new DatabaseSync(":memory:"),dir=new URL("../drizzle/",import.meta.url);
const files=readdirSync(dir).filter(f=>f.endsWith(".sql")).sort();
for(const f of files.filter(f=>f<"0003"))migrationDb.exec(readFileSync(new URL(f,dir),"utf8"));
migrationDb.prepare("INSERT INTO course_plans (id,owner,university,code,name,year,session,status,credits,revision,updated_at) VALUES ('legacy','owner','usyd','COMP1001','Keep this plan',2026,'S1C','completed',6,4,'now')").run();
for(const f of files.filter(f=>f>="0003"))migrationDb.exec(readFileSync(new URL(f,dir),"utf8"));
const migrated=migrationDb.prepare("SELECT * FROM course_plans WHERE id='legacy'").get()!;
assert.equal(migrated.name,"Keep this plan");assert.equal(migrated.revision,4);
assert.equal(migrated.final_mark,null);assert.equal(migrated.final_grade,null);assert.equal(migrated.wam_excluded,0);
migrationDb.close();
console.log("PASS: WAM weighting, zero/failures/repeats, blank and non-numeric results, exclusions, private API projection, ownership, stale saves, legacy-field preservation, explicit clearing and populated-data migration.");
