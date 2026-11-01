// Actual board and delivery hook. Synthetic save/extension adapters only.
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import SemesterBoard from "../../components/semester-board";
import {calendarFixture} from "../fixtures/calendar-visibility";
import {reminderController} from "../../extensions/semester-connect/reminders.js";
import "../../app/globals.css";
import "../../app/board.css";
let installed=false;
export function RemindersQA(){const [debug,setDebug]=useState("Synthetic test · no real account or OS notifications"),[fail,setFail]=useState(sessionStorage.getItem("qa-reminder-fail")==="true");if(!installed){installed=true;
 const owner="a".repeat(64),key="qa-reminders-board",native=window.fetch.bind(window);
 const fixture=structuredClone(calendarFixture);fixture.tasks=[{...fixture.tasks[0],id:"reminder-report",title:"Synthetic reminder report",date:"2026-11-10",time:"14:00",week:14},{...fixture.tasks[4],id:"unknown-date",title:"Synthetic week-only assignment",week:13}, {...fixture.tasks.at(-2)!,id:"personal-reminder",title:"Synthetic personal task",date:"2026-11-11",time:"15:00"}];
 if(!sessionStorage.getItem(key))sessionStorage.setItem(key,JSON.stringify(fixture));
 localStorage.setItem("semester-view","assessments");
 window.fetch=async(input,init)=>{const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url,location.href);
  if(url.origin!==location.origin)throw new Error("QA blocked external request");
  if(url.pathname.startsWith("/api/")){
   if(url.pathname!=="/api/semester")throw new Error("QA blocked another API");
   const method=init?.method||"GET",revision=Number(sessionStorage.getItem("qa-reminder-revision")||1);
   if(method==="PUT"){
    if(sessionStorage.getItem("qa-reminder-fail")==="true")return Response.json({error:"Synthetic save failure"},{status:503});
    const body=JSON.parse(String(init?.body));sessionStorage.setItem(key,JSON.stringify(body.semester));sessionStorage.setItem("qa-reminder-revision",String(revision+1));return Response.json({revision:revision+1});
   }
   if(method!=="GET")throw new Error("QA blocked other write");
   return Response.json({semester:JSON.parse(sessionStorage.getItem(key)!),revision,reminderOwner:owner});
  }return native(input,init);
 };
 // Real scheduler with a device-local fake API; never sends an OS notification.
 const storage:any={};const alarms=new Map();
 const api:any={runtime:{getURL:(p:string)=>p},storage:{local:{get:async(k:string)=>({[k]:structuredClone(storage[k])}),set:async(v:any)=>Object.assign(storage,structuredClone(v))}},permissions:{contains:async()=>true},alarms:{clear:async(n:string)=>alarms.delete(n),create:async(n:string,v:any)=>alarms.set(n,v)},notifications:{create:async()=>{},getAll:async()=>({}),clear:async()=>{}},tabs:{query:async()=>[],sendMessage:async()=>{}},scripting:{registerContentScripts:async()=>{},unregisterContentScripts:async()=>{}}};
 const controller=reminderController(api);
 window.addEventListener("message",async e=>{if(e.source!==window||e.origin!==location.origin||e.data?.type!=="semester-reminders-v1")return;
  if(e.data.action==="sync"){await controller.sync(e.data.snapshot);sessionStorage.setItem("qa-reminder-jobs",JSON.stringify(e.data.snapshot.jobs));}
  else if(e.data.action==="settings"){await controller.enable(owner);}
  const state=await controller.state();
  setDebug(`Synthetic test · saved revision ${sessionStorage.getItem("qa-reminder-revision")||1} · scheduled ${state.count||0} · ${state.enabled?"enabled":"off"}`);
  window.postMessage({type:"semester-reminders-state-v1",state},location.origin);
 });
 }
 return <><output aria-label="Synthetic reminder diagnostics" style={{display:"block",padding:8,fontSize:12}}>{debug}</output><label style={{display:"block",padding:8}}><input type="checkbox" checked={fail} onChange={e=>{setFail(e.target.checked);sessionStorage.setItem("qa-reminder-fail",String(e.target.checked));}}/> Simulate save failure (synthetic only)</label><SemesterBoard/></>;
}
createRoot(document.getElementById("root")!).render(<RemindersQA/>);
