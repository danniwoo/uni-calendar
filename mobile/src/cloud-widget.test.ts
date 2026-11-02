import test from "node:test";
import assert from "node:assert/strict";
import { CLOUD_WIDGET_CACHE_KEY, CLOUD_WIDGET_MAX_AGE, CLOUD_WIDGET_URL, CloudWidgetBridge,
  cloudWidgetProps, cloudWidgetTimeline, makeCloudSnapshot, readCloudSnapshot,
  type CloudTimeline, type CloudWidgetState } from "./cloud-widget";
import type { StagingSemester } from "./staging-core";

const now=Date.parse("2026-11-02T06:00:00Z"), scope="test-auth|test-api";
const board:StagingSemester={revision:3,semester:{id:"board",title:"Test semester",weekLabel:"Sample week 11",
  assessments:[
    {id:"a",unitCode:"SOFT2412",title:"Sample report",dueAt:"2026-11-02T14:00:00Z",weightLabel:"30%"},
    {id:"b",unitCode:"ISYS2120",title:"Sample quiz",dueAt:"2026-11-03T05:00:00Z",weightLabel:"10%"}],
  tasks:[{id:"task",title:"Do private preparation",unitCode:"SOFT2412",completed:true}]}};
const snapshot=()=>makeCloudSnapshot(scope,"alice","account-a",board,now);
function memory() {
  const values=new Map<string,string>();
  return {values,getItem:async(key:string)=>values.get(key)??null,
    setItem:async(key:string,value:string)=>{values.set(key,value);},removeItem:async(key:string)=>{values.delete(key);}};
}
function harness(storage=memory()) {
  let state:CloudWidgetState|undefined;const timelines:CloudTimeline[]=[];
  const bridge=new CloudWidgetBridge(scope,storage,t=>timelines.push(t),s=>{state=s;},()=>now);
  return {bridge,storage,timelines,state:()=>state!};
}
function deferred() {let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};}

test("projection excludes credentials, emails, task text and owner IDs from all native timeline props",()=>{
  const value={...board,access_token:"secret",email:"private@example.test"};
  const s=makeCloudSnapshot(scope,"alice","account-a",value,now);
  const text=JSON.stringify(cloudWidgetTimeline(s,now));
  for(const forbidden of ["secret","private@","alice","account-a","Do private preparation","weightLabel","boardId","revision"])
    assert.ok(!text.includes(forbidden),forbidden);
  assert.equal(s.completed,1);assert.equal(s.total,1);
  assert.equal(cloudWidgetProps(s,now).url,CLOUD_WIDGET_URL);
});

test("restored cache must match both authenticated subject and staging environment",()=>{
  const raw=JSON.stringify({...snapshot(),access_token:"discard-me"});
  assert.equal(readCloudSnapshot(raw,scope,"bob",now),undefined);
  assert.equal(readCloudSnapshot(raw,"other-api","alice",now),undefined);
  assert.equal(readCloudSnapshot("broken",scope,"alice",now),undefined);
  assert.equal(readCloudSnapshot(raw,scope,"alice",now+CLOUD_WIDGET_MAX_AGE),undefined);
  assert.equal(readCloudSnapshot(raw,scope,"alice",now-120000),undefined);
  assert.ok(!JSON.stringify(readCloudSnapshot(raw,scope,"alice",now)).includes("discard-me"));
});

test("Sydney midnight and deadlines have scheduled entries; expiry removes dated content",()=>{
  const timeline=cloudWidgetTimeline(snapshot(),now);
  const midnight=Date.parse("2026-11-02T13:00:00Z");
  const before=timeline[0].props, after=timeline.find(e=>e.date.getTime()===midnight)!.props;
  assert.match(before.when,/Tomorrow/);assert.match(after.when,/Today/);
  const passed=timeline.find(e=>e.date.getTime()===Date.parse(board.semester.assessments[0].dueAt))!.props;
  assert.match(passed.unit,/ISYS2120/);assert.match(passed.progress,/1 past date/);
  const final=timeline.at(-1)!;
  assert.equal(final.date.getTime(),now+CLOUD_WIDGET_MAX_AGE);
  assert.equal(final.props.title,"Refresh your deadlines");assert.equal(final.props.second,"");
  assert.ok(!JSON.stringify(final.props).includes("SOFT2412"));
});

test("stale/failed-sync states retain original sync time and never assume past work was submitted",()=>{
  const s=snapshot();
  assert.match(cloudWidgetProps(s,now+6*3600000).freshness,/Refresh/);
  assert.match(cloudWidgetProps(s,now+3600000,true).freshness,/Sync failed/);
  assert.equal(s.syncedAt,now);
  const past={...s,deadlines:s.deadlines.map(d=>({...d,due:now-1000}))};
  assert.match(cloudWidgetProps(past,now).title,/2 past dates · check/);
  assert.ok(!cloudWidgetProps(past,now).title.includes("No upcoming"));
});

test("sign-out immediately replaces every scheduled entry and removes the persisted snapshot",async()=>{
  const h=harness();await h.bridge.changeSubject("alice");await h.bridge.accept("alice","account-a",board);
  assert.ok(h.timelines.at(-1)!.length>1);
  const clearing=h.bridge.changeSubject(null);
  assert.equal(h.timelines.at(-1)!.length,1);
  assert.equal(h.state().props.title,"Sign in to Semester");
  await clearing;assert.equal(h.storage.values.has(CLOUD_WIDGET_CACHE_KEY),false);
});

test("a delayed write cannot resurrect account A after sign-out and account B sign-in",async()=>{
  const storage=memory(), block=deferred(), started=deferred();const original=storage.setItem;
  storage.setItem=async(key,value)=>{started.resolve();await block.promise;await original(key,value);};
  const h=harness(storage);await h.bridge.changeSubject("alice");
  const saving=h.bridge.accept("alice","account-a",board);await started.promise;
  const out=h.bridge.changeSubject(null), switched=h.bridge.changeSubject("bob");
  assert.ok(!h.state().props.unit.includes("SOFT2412"));
  block.resolve();await Promise.all([saving,out,switched]);
  assert.equal(storage.values.has(CLOUD_WIDGET_CACHE_KEY),false);
  assert.equal(h.state().snapshot,undefined);
  await h.bridge.accept("alice","account-a",board);
  assert.equal(h.state().snapshot,undefined);
});

test("a delayed cache read cannot publish the previous account after switching",async()=>{
  const storage=memory();storage.values.set(CLOUD_WIDGET_CACHE_KEY,JSON.stringify(snapshot()));
  const block=deferred(),started=deferred(),original=storage.getItem;
  storage.getItem=async key=>{const result=await original(key);started.resolve();await block.promise;return result;};
  const h=harness(storage),first=h.bridge.changeSubject("alice");await started.promise;
  const second=h.bridge.changeSubject("bob");block.resolve();await Promise.all([first,second]);
  assert.equal(h.state().snapshot,undefined);
  assert.ok(h.timelines.every(t=>!JSON.stringify(t).includes("Sample report")));
});

test("older responses cannot roll a widget back within the same board",async()=>{
  const h=harness();await h.bridge.changeSubject("alice");await h.bridge.accept("alice","account-a",board);
  await h.bridge.accept("alice","account-a",{...board,revision:2});
  assert.equal(h.state().snapshot?.revision,3);
});

test("cache write failure does not claim a newer successful snapshot",async()=>{
  const h=harness();await h.bridge.changeSubject("alice");await h.bridge.accept("alice","account-a",board);
  h.storage.setItem=async()=>{throw Error("disk full");};
  await assert.rejects(h.bridge.accept("alice","account-a",{...board,revision:4}));
  assert.equal(h.state().snapshot?.revision,3);
});

test("API rejection clears cached content; same signed-in account can reconnect",async()=>{
  const h=harness();await h.bridge.changeSubject("alice");await h.bridge.accept("alice","account-a",board);
  await h.bridge.clear("Sign in to reconnect");
  assert.equal(h.state().snapshot,undefined);assert.equal(h.storage.values.size,0);
  await h.bridge.accept("alice","account-a",{...board,revision:4});
  assert.equal(h.state().snapshot?.revision,4);
});

test("native publication failure is visible and can be retried",async()=>{
  let fail=true,state:CloudWidgetState|undefined;
  const bridge=new CloudWidgetBridge(scope,memory(),()=>{if(fail)throw Error("native unavailable");},s=>{state=s;},()=>now);
  await bridge.changeSubject(null);assert.match(state!.error!,/Widget refresh failed/);
  fail=false;bridge.refreshDisplay();assert.equal(state!.error,undefined);
});
