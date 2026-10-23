import test from "node:test";
import assert from "node:assert/strict";
import {reloadController,bundleFromSnapshots,courseFromUrl,validConfig,senderAccess,ORIGINS,SEMESTER} from "../reload-check.js";
import {READER_VERSION} from "../reader.js";
const config={enabled:true,accountId:"91",courseIds:["12","13"]};
const time=Date.parse("2026-10-24T00:00:00Z");
const source=(courseId="12")=>({ok:true,readerVersion:READER_VERSION,user:{id:"91",name:"Not retained"},fetchedAt:new Date(time).toISOString(),course:{id:courseId,code:"TEST1001"},assignments:[{id:"1",gradingType:"pass_fail",submission:{released:true,grade:"complete",score:null}}],groups:[]});
test("runtime sender boundary rejects other sites, extensions and frames",()=>{
  const runtime={id:"test",getURL:path=>`chrome-extension://test/${path}`};
  assert.equal(senderAccess({id:"test",url:"chrome-extension://test/preview.html?tab=1"},runtime),"preview");
  assert.equal(senderAccess({id:"test",url:"chrome-extension://test/preview.html?tab=1",tab:{id:7}},runtime),"preview");
  const web={id:"test",url:SEMESTER+"/",tab:{url:SEMESTER+"/"},frameId:0};
  assert.equal(senderAccess(web,runtime),"website");
  for(const sender of [{...web,id:"other"},{...web,frameId:1},{...web,url:"https://evil.test"},{...web,tab:{url:"https://evil.test"}},{id:"test",url:"chrome-extension://test/other.html"}])assert.equal(senderAccess(sender,runtime),null);
});
function mock() {
  let clock=time,result=source(),allowed=true,reader=null;
  const local={},session={},reads=[],registrations=[],messages=[];
  const store=data=>({get:async key=>({[key]:structuredClone(data[key])}),set:async obj=>Object.assign(data,structuredClone(obj)),remove:async key=>{delete data[key];}});
  const tabs=new Map([[1,{id:1,url:"https://canvas.sydney.edu.au/courses/12/grades"}],[2,{id:2,url:"https://canvas.sydney.edu.au/courses/13"}]]);
  const api={storage:{local:store(local),session:store(session)},runtime:{getManifest:()=>({version:READER_VERSION})},permissions:{contains:async value=>{assert.deepEqual(value.origins,ORIGINS);return allowed;}},
    tabs:{get:async id=>tabs.get(id),query:async()=>[{id:9,url:SEMESTER}],sendMessage:async(...args)=>messages.push(args)},
    scripting:{unregisterContentScripts:async()=>{},registerContentScripts:async args=>registrations.push(args),executeScript:async args=>{if(args.files)return;reads.push(args);return [{result:reader?await reader(args):structuredClone(result)}];}}};
  const controller=reloadController(api,()=>clock);
  return {controller,api,local,session,reads,registrations,messages,tabs,setResult:r=>result=r,setReader:r=>reader=r,advance:n=>clock+=n,setAllowed:a=>allowed=a,reload:(id=1)=>controller.updated(id,{status:"complete"},tabs.get(id))};
}
test("only selected exact-origin courses, bounded config and optional grants",async()=>{
  assert.equal(validConfig({...config,courseIds:Array(9).fill("12")}),false);
  assert.equal(validConfig({...config,courseIds:["12","12"]}),false);
  assert.equal(courseFromUrl("https://canvas.sydney.edu.au.evil.test/courses/12"),null);
  assert.equal(courseFromUrl("https://canvas.sydney.edu.au/login"),null);
  const m=mock();m.reload();await m.controller.idle();assert.equal(m.reads.length,0);
  m.setAllowed(false);await assert.rejects(m.controller.enable(config),/permissions/);
  m.setAllowed(true);await m.controller.enable(config);
  m.tabs.get(1).url="https://canvas.sydney.edu.au/courses/99/grades";m.reload();await m.controller.idle();assert.equal(m.reads.length,0);
  assert.equal(m.registrations[0][0].matches[0],`${SEMESTER}/*`);
});
test("reload creates pending raw bundle, stable timestamp, no cloud/grade writes, throttled",async()=>{
  const m=mock();await m.controller.enable(config);m.reload();m.reload();await m.controller.idle();
  assert.equal(m.reads.length,1);assert.equal(m.reads[0].world,"ISOLATED");
  assert.deepEqual(m.reads[0].args,[{operation:"course",courseId:"12",expectedUserId:"91",expectedVersion:READER_VERSION}]);
  const one=await m.controller.inbox();assert.equal(JSON.parse(one.raw).courses[0].assignments[0].submission.grade,"complete");
  assert.equal(one.raw.includes("Not retained"),false);assert.deepEqual(m.session.reloadState.snapshots["12"].user,{id:"91"});
  m.advance(2000);assert.equal((await m.controller.inbox()).raw,one.raw,"focus does not create a fake new update");
  assert.deepEqual(Object.keys(m.local),["reloadConfig"],"no grades persisted across browser sessions");
  m.advance(60000);m.reload();await m.controller.idle();assert.equal(m.reads.length,2);
});
test("multiple course loads queue serially; source results retained separately",async()=>{
  const m=mock();await m.controller.enable(config);
  m.setReader(async args=>source(args.args[0].courseId));m.reload(1);m.reload(2);await m.controller.idle();
  assert.equal(m.reads.length,2);assert.equal(JSON.parse((await m.controller.inbox()).raw).courses.length,2);
});
test("account switch stops checks and clears previews; login expiry clears old results",async()=>{
  for(const code of ["ACCOUNT_CHANGED","LOGIN_REQUIRED","FORBIDDEN"]){
    const m=mock();await m.controller.enable(config);m.reload();await m.controller.idle();
    m.advance(60000);m.setResult({ok:false,code});m.reload();await m.controller.idle();
    const inbox=await m.controller.inbox();assert.equal(inbox.raw,null);assert.equal(inbox.enabled,code!=="ACCOUNT_CHANGED");
    if(code==="LOGIN_REQUIRED")assert.match(inbox.message,/login expired/);
  }
});
test("disable and navigation invalidate in-flight reads",async()=>{
  for(const mode of ["disable","navigate","close"]){
    const m=mock();await m.controller.enable(config);
    let release,started;const began=new Promise(r=>started=r);
    m.setReader(()=>{started();return new Promise(r=>release=r);});m.reload();await began;
    if(mode==="disable")await m.controller.disable();
    else if(mode==="close")m.controller.removed(1);
    else m.controller.updated(1,{status:"loading"},m.tabs.get(1));
    release(source());await m.controller.idle();assert.equal((await m.controller.inbox()).raw,null);
  }
});
test("permission removal, wrong result identity, version mismatch cannot deliver grades",async()=>{
  for(const result of [{...source(),user:{id:"92"}},{...source(),readerVersion:"old"},{...source(),course:{id:"99"}}]){
    const m=mock();await m.controller.enable(config);m.setResult(result);m.reload();await m.controller.idle();assert.equal((await m.controller.inbox()).raw,null);
  }
  const m=mock();await m.controller.enable(config);m.reload();await m.controller.idle();m.setAllowed(false);assert.equal((await m.controller.inbox()).raw,null);
});
test("expired, future, wrong-account and old-reader snapshots excluded; transport limits",()=>{
  assert.equal(bundleFromSnapshots(config,{a:source()},time+86400000),null);
  assert.equal(bundleFromSnapshots(config,{a:source()},time-1000),null);
  assert.equal(bundleFromSnapshots(config,{a:{...source(),user:{id:"99"}}},time),null);
  assert.throws(()=>bundleFromSnapshots(config,{a:{...source(),assignments:Array(2501).fill({id:"1"})}},time),/LIMIT/);
  assert.throws(()=>bundleFromSnapshots(config,{a:{...source(),assignments:[{name:"a".repeat(1500000)}]}},time),/LIMIT/);
});
test("worker restart retains consent and throttle; session expiry removes grades",async()=>{
  const m=mock();await m.controller.enable(config);m.reload();await m.controller.idle();
  const restarted=reloadController(m.api,()=>time+1000);
  assert.equal((await restarted.inbox()).enabled,true);
  restarted.updated(1,{status:"complete"},m.tabs.get(1));await restarted.idle();assert.equal(m.reads.length,1);
  m.advance(86400000);assert.equal((await m.controller.inbox()).raw,null);assert.deepEqual(m.session.reloadState.snapshots,{});
});
test("bridge registration failure leaves checks disabled, not half enabled",async()=>{
  const m=mock();m.api.scripting.registerContentScripts=async()=>{throw new Error("registration failure");};
  await assert.rejects(m.controller.enable(config),/remain off/);
  assert.equal((await m.controller.inbox()).enabled,false);assert.equal(m.local.reloadConfig,undefined);
});
