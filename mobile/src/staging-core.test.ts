import test from "node:test";
import assert from "node:assert/strict";
import { AccountRequestGate, callbackCode, readStagingSemester, stagingConfig, stagingRequest, StagingApiError } from "./staging-core";
import { chunkedSessionStorage } from "./secure-session-storage";

const config={supabaseUrl:"https://test.supabase.co",publishableKey:"sb_publishable_test",apiUrl:"https://test.workers.dev"};
const payload={semester:{id:"test",title:"Synthetic semester",weekLabel:"Sample week",assessments:[{id:"a",unitCode:"UNIT1000",title:"Assignment",dueAt:"2026-11-20T12:00:00Z",weightLabel:"20%"}],tasks:[{id:"task",unitCode:"UNIT1000",title:"Prepare",completed:false}]},revision:1};

test("config fails closed on missing values, secrets and unsafe origins",()=>{
  assert.equal(stagingConfig({}).config,undefined);
  assert.deepEqual(stagingConfig(config).config,config);
  for(const change of [{publishableKey:"sb_secret_private"},{supabaseUrl:"http://test.supabase.co"},{apiUrl:"https://user:pass@test.workers.dev"},{apiUrl:"https://test.workers.dev/redirect"},{apiUrl:"http://192.168.1.1"}]) assert.equal(stagingConfig({...config,...change}).config,undefined);
});

test("callback accepts a code only at the exact native route, never URL tokens",()=>{
  assert.equal(callbackCode("semester-preview://auth/callback?code=one"),"one");
  for(const url of ["https://auth/callback?code=one","semester-preview://auth/other?code=one","semester-preview://evil/callback?code=one","semester-preview://auth/callback#access_token=secret","semester-preview://auth/callback?code=a&code=b","semester-preview://auth/callback?error=access_denied","semester-preview://auth/callback?code="]) assert.throws(()=>callbackCode(url));
});

test("DTO requires valid dates, unique task IDs and typed progress",()=>{
  assert.deepEqual(readStagingSemester(payload),payload);
  assert.throws(()=>readStagingSemester({...payload,revision:0}));
  assert.throws(()=>readStagingSemester({...payload,semester:{...payload.semester,tasks:[{...payload.semester.tasks[0],completed:"true"}]}}));
  assert.throws(()=>readStagingSemester({...payload,semester:{...payload.semester,tasks:[...payload.semester.tasks,...payload.semester.tasks]}}));
  assert.throws(()=>readStagingSemester({...payload,semester:{...payload.semester,assessments:[{...payload.semester.assessments[0],dueAt:"invalid"}]}}));
});

test("API uses bearer session token and narrow revision-checked task mutation",async()=>{
  let observed:RequestInit|undefined;
  const result=await stagingRequest(config,"supabase-access","/v1/tasks/task",{method:"PATCH",body:{completed:true,expectedRevision:1},fetcher:async(url,init)=>{
    assert.equal(url,"https://test.workers.dev/v1/tasks/task"); observed=init;
    return Response.json(payload);
  }});
  assert.deepEqual(result,payload);
  assert.equal(new Headers(observed?.headers).get("Authorization"),"Bearer supabase-access");
  assert.equal(observed?.redirect,"error");
  assert.deepEqual(JSON.parse(observed?.body as string),{completed:true,expectedRevision:1});
  await assert.rejects(stagingRequest(config,"token","https://other.test/",{}));
  await assert.rejects(stagingRequest(config,"token","/v1/semester",{fetcher:async()=>Response.json({error:{message:"private server details"}},{status:409})}),error=>error instanceof StagingApiError && error.status===409 && !error.message.includes("private"));
});

test("sign-out, account switch and unmount invalidate outstanding account responses",()=>{
  const gate=new AccountRequestGate(); gate.change("alice"); const first=gate.start();
  assert.equal(first.current(),true);
  gate.change("bob"); assert.equal(first.current(),false); assert.equal(first.signal.aborted,true);
  const second=gate.start(); gate.change(null); assert.equal(second.current(),false);
  gate.change("alice"); const third=gate.start(); gate.invalidate(); assert.equal(third.current(),false);
  assert.equal(first.current(),false,"returning to an earlier account cannot revive its old requests");
});

test("secure storage chunks Unicode sessions and removes all current chunks on logout",async()=>{
  const values=new Map<string,string>();let generation=0;
  const storage=chunkedSessionStorage({getItem:async key=>values.get(key)??null,setItem:async(key,value)=>{assert.ok(Buffer.byteLength(value)<=2048);values.set(key,value);},removeItem:async key=>{values.delete(key);}},()=>`generation-${++generation}`);
  const value=JSON.stringify({access_token:"x".repeat(6000),name:"📚作業".repeat(500)});
  await storage.setItem("auth",value);assert.equal(await storage.getItem("auth"),value);
  await storage.setItem("auth","replacement");assert.equal(await storage.getItem("auth"),"replacement");assert.equal(values.size,2);
  await storage.removeItem("auth");assert.equal(await storage.getItem("auth"),null);assert.equal(values.size,0);
});

test("failed refresh storage write preserves the prior complete session",async()=>{
  const values=new Map<string,string>();let generation=0,fail=false;
  const storage=chunkedSessionStorage({getItem:async key=>values.get(key)??null,setItem:async(key,value)=>{if(fail&&key.endsWith(".1"))throw Error("Keychain error");values.set(key,value);},removeItem:async key=>{values.delete(key);}},()=>`g-${++generation}`);
  await storage.setItem("auth","previous");fail=true;
  await assert.rejects(storage.setItem("auth","x".repeat(1500)));
  assert.equal(await storage.getItem("auth"),"previous");assert.equal(values.size,2);
});
