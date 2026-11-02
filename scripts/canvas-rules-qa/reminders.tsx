// Actual board and delivery hook. Synthetic save/extension adapters only.
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import SemesterBoard from "../../components/semester-board";
import {calendarFixture} from "../fixtures/calendar-visibility";
import {reminderController} from "../../extensions/semester-connect/reminders.js";
import {automaticBatches} from "../../lib/automatic-reminders";
import "../../app/globals.css";
import "../../app/board.css";
let installed=false;
export function RemindersQA(){const [debug,setDebug]=useState("Synthetic test · no real account or OS notifications"),[digest,setDigest]=useState(""),[fail,setFail]=useState(sessionStorage.getItem("qa-reminder-fail")==="true");if(!installed){installed=true;
 const owner="a".repeat(64),automatic=new URLSearchParams(location.search).has("automatic"),timing=new URLSearchParams(location.search).has("timing"),key=automatic?(timing?"qa-timing-board":"qa-automatic-board"):"qa-reminders-board",native=window.fetch.bind(window);
 const fixture=structuredClone(calendarFixture);fixture.tasks=[{...fixture.tasks[0],id:"reminder-report",title:"Synthetic reminder report",date:"2026-11-10",time:"14:00",week:14},{...fixture.tasks[4],id:"unknown-date",title:"Synthetic week-only assignment",week:13}, {...fixture.tasks.at(-2)!,id:"personal-reminder",title:"Synthetic personal task",date:"2026-11-11",time:"15:00"}];
 if(automatic){fixture.tasks=[
  {...fixture.tasks[0],id:"report",title:"Research report",date:"2026-11-06",time:"14:00",week:13,timeBasis:"deadline"},
  {...fixture.tasks[0],id:"project",title:"Project submission",date:"2026-11-06",time:"14:00",week:13,timeBasis:"deadline"},
  {...fixture.tasks[0],id:"quiz",title:"Practice quiz · Attempt 2",kind:"quiz",date:"2026-11-04",time:"12:00",week:13,timeBasis:"class",timing:"In tutorial"},
  {...fixture.tasks[1],title:"Presentation · date to confirm"},
  {...fixture.tasks[2],reminders:[{id:"custom-only",kind:"before",minutes:10}]}
 ];if(timing)fixture.tasks=fixture.tasks.map(t=>["report","project"].includes(t.id)?{...t,time:"23:59"}:t);}
 fixture.classes.push(...[
  {id:"week13-tutorial",unit:"TEST1001",activity:"Tutorial",week:13,date:"2026-11-03",time:"12:00",end:"14:00",location:"Synthetic room"},
  {id:"week13-lecture",unit:"TEST1001",activity:"Lecture",week:13,date:"2026-11-04",time:"09:00",end:"10:00",location:"Synthetic theatre"},
  ...[1,2].map(i=>({id:`week12-tutorial-${i}`,unit:"TEST1001",activity:"Tutorial",week:12,date:"2026-10-27",time:i===1?"10:00":"14:00",end:i===1?"12:00":"16:00",location:"Synthetic room"}))
 ]);
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
  const board=JSON.parse(sessionStorage.getItem(key)!);
  const group=automaticBatches(board,0).find(b=>b.items.length>1);setDigest(group?`reminders.html?automatic${timing?"&timing":""}#reminder=${encodeURIComponent(owner+":"+group.job.taskId)}`:"");
  setDebug(`Synthetic only · saved revision ${sessionStorage.getItem("qa-reminder-revision")||1} · automatic ${board.automaticReminders?.enabled?"on":"off"} · queued ${state.count||0} · desktop ${state.enabled?"on":"off"}`);
  window.postMessage({type:"semester-reminders-state-v1",state},location.origin);
 });
 }
 return <><output aria-label="Synthetic reminder diagnostics" style={{display:"block",padding:8,fontSize:12}}>{debug}</output>{digest&&<a href={digest}>Open grouped notification (synthetic)</a>}<label style={{display:"block",padding:8}}><input type="checkbox" checked={fail} onChange={e=>{setFail(e.target.checked);sessionStorage.setItem("qa-reminder-fail",String(e.target.checked));}}/> Simulate save failure (synthetic only)</label><SemesterBoard/></>;
}
createRoot(document.getElementById("root")!).render(<RemindersQA/>);
