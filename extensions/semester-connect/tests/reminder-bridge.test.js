import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../reminder-bridge.js",import.meta.url),"utf8"),origin="https://usyd-semester-board.earthy-trout-5263.chatgpt.site";
function fixture(){
 const listeners=new Set(),changes=new Set(),calls=[],posted=[];
 const runtime={getManifest:()=>({version:"0.5.1"}),sendMessage:async m=>{calls.push(m);return {available:true,enabled:false};},onMessage:{addListener:f=>changes.add(f),removeListener:f=>changes.delete(f)}};
 const window={addEventListener:(_,f)=>listeners.add(f),removeEventListener:(_,f)=>listeners.delete(f),postMessage:(value,target)=>posted.push({value,target})};window.top=window;
 const context=vm.createContext({chrome:{runtime},window,location:{origin}});
 const inject=async()=>{vm.runInContext(source,context);await new Promise(r=>setImmediate(r));};
 const send=async data=>{for(const f of listeners)await f({source:window,origin,data});};
 return {context,runtime,window,listeners,changes,calls,posted,inject,send};
}
test("reminder bridge only forwards same-origin top-frame status, sync and settings",async()=>{
 const m=fixture();await m.inject();const n=m.calls.length;
 for(const f of m.listeners){await f({source:{},origin,data:{type:"semester-reminders-v1",action:"sync"}});await f({source:m.window,origin:"https://evil.example",data:{type:"semester-reminders-v1",action:"sync"}});}
 for(const action of ["enable","disable","test","connect","unknown"])await m.send({type:"semester-reminders-v1",action});
 await m.send({type:"other",action:"sync"});assert.equal(m.calls.length,n);
 const snapshot={owner:"a".repeat(64),revision:1,jobs:[]};await m.send({type:"semester-reminders-v1",action:"sync",snapshot});
 assert.equal(m.calls.at(-1).type,"reminders-sync");assert.equal(m.calls.at(-1).snapshot,snapshot);
 for(const action of ["status","settings"])await m.send({type:"semester-reminders-v1",action});
 assert.ok(m.posted.every(p=>p.target===origin&&p.value.type==="semester-reminders-state-v1"));
 for(const mode of ["origin","frame"]){const other=fixture();if(mode==="origin")other.context.location.origin="https://evil.example";else other.window.top={};await other.inject();assert.equal(other.calls.length,0);}
});
test("reinjection keeps one listener and disposes invalidated extension contexts",async()=>{
 const m=fixture();await m.inject();const old=m.context.__semesterReminderBridge;await m.inject();assert.equal(old,m.context.__semesterReminderBridge);assert.equal(m.listeners.size,1);
 m.runtime.getManifest=()=>{throw Error("invalidated");};m.context.chrome={runtime:{...m.runtime,getManifest:()=>({version:"0.5.1"})}};
 await m.inject();assert.notEqual(old,m.context.__semesterReminderBridge);assert.equal(m.listeners.size,1);assert.equal(m.changes.size,1);
 const n=m.posted.length;await old.send();assert.equal(m.posted.length,n);
});
