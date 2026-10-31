import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
import {READER_VERSION} from "../reader.js";
const source=await readFile(new URL("../semester-bridge.js",import.meta.url),"utf8");
const origin="https://usyd-semester-board.earthy-trout-5263.chatgpt.site";
function fixture() {
  const listeners=new Set(),runtimeListeners=new Set(),posted=[],calls=[];
  const runtime={getManifest:()=>({version:READER_VERSION}),sendMessage:async message=>{calls.push(message);return {enabled:true,raw:null,message:"Connected"};},onMessage:{addListener:f=>runtimeListeners.add(f),removeListener:f=>runtimeListeners.delete(f)}};
  const window={addEventListener:(name,f)=>listeners.add(f),removeEventListener:(name,f)=>listeners.delete(f),postMessage:(value,target)=>posted.push({value,target})};window.top=window;
  const context=vm.createContext({chrome:{runtime},window,location:{origin}});
  const inject=async()=>{vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));};
  return {context,runtime,window,listeners,runtimeListeners,posted,calls,inject};
}
test("bridge reuses a healthy instance and resends status after reinjection",async()=>{
  const m=fixture();await m.inject();const bridge=m.context.__semesterConnectBridge;
  await m.inject();assert.equal(m.context.__semesterConnectBridge,bridge);
  assert.equal(m.listeners.size,1);assert.equal(m.runtimeListeners.size,1);
  assert.equal(m.posted.length,2);assert.ok(m.posted.every(p=>p.target===origin));
});
test("bridge replaces a stale context and stops its old listeners",async()=>{
  const m=fixture();await m.inject();const previous=m.context.__semesterConnectBridge;
  const staleRuntime=m.runtime;
  staleRuntime.getManifest=()=>{throw new Error("Extension context invalidated");};
  m.context.chrome={runtime:{...staleRuntime,getManifest:()=>({version:READER_VERSION})}};
  await m.inject();assert.notEqual(m.context.__semesterConnectBridge,previous);
  assert.equal(previous.alive(),false);assert.equal(m.listeners.size,1);assert.equal(m.runtimeListeners.size,1);
  const before=m.posted.length;await previous.send();assert.equal(m.posted.length,before);
});
test("bridge replaces the old boolean marker and rejects other origins and frames",async()=>{
  const m=fixture();m.context.__semesterConnectBridge=true;await m.inject();assert.equal(m.listeners.size,1);
  for(const mode of ["origin","frame"]){const other=fixture();if(mode==="origin")other.context.location.origin="https://evil.example";else other.window.top={};await other.inject();assert.equal(other.calls.length,0);assert.equal(other.listeners.size,0);}
});
