import React,{useState} from "react";
import {CanvasInbox} from "../../components/canvas-inbox";
import {CanvasImport} from "../../components/canvas-import";
import {fixtureBoard,fixtureBundle,fixtureChoices} from "../fixtures/canvas-connect";
import {planCanvasImport} from "../../lib/canvas-import";
const saved=planCanvasImport(fixtureBoard,fixtureBundle,fixtureChoices).semester;
saved.tasks[2].grade=null;
const fresh=structuredClone(fixtureBundle);
fresh.courses.forEach(c=>c.fetchedAt="2026-10-24T00:00:00Z");
fresh.exportedAt="2026-10-24T00:00:00Z";
fresh.courses[0].assignments[0].submission!.score=9;
fresh.courses[0].assignments.push({...structuredClone(fresh.courses[0].assignments[1]),id:"3",name:"New practice activity"});
const raw=JSON.stringify(fresh);
export function UpdatesQA(){
  const [s,setS]=useState(saved),[open,setOpen]=useState(false),[source,setSource]=useState<string>(),[writes,setWrites]=useState(0);
  function incoming(value=raw){window.postMessage({type:"semester-connect-inbox-v1",inbox:{enabled:true,message:"Synthetic course check complete. Nothing imported.",raw:value}},location.origin);}
  function download(){const url=URL.createObjectURL(new Blob([raw],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download="synthetic-canvas-update.json";a.click();URL.revokeObjectURL(url);}
  return <section><h1>Canvas update QA · synthetic only</h1><p>No Canvas connection, credentials or account API. Buttons simulate the website receiving a pending snapshot. Saves affect this test tab’s memory only.</p>
    <button onClick={()=>incoming()}>Simulate reload check</button><button onClick={()=>{const changed=structuredClone(fresh);changed.courses[0].assignments[0].submission!.score=10;incoming(JSON.stringify(changed));}}>Simulate later result</button>
    <button onClick={()=>{setSource(undefined);setOpen(true);}}>Open JSON test entry</button><button onClick={download}>Download update fixture</button>
    <button onClick={()=>setS({...s,warnings:[...s.warnings,"Concurrent synthetic edit"]})}>Simulate concurrent board edit</button>
    <p role="status">Test writes: {writes} · saved quiz: {s.tasks[0].grade?.earned}/10 · protected grade: {s.tasks[1].grade?.earned}/10 · manual clear: {String(s.tasks[2].grade)}</p>
    <CanvasInbox semester={s} reviewOpen={open} onReview={value=>{setSource(value);setOpen(true);}}/>
    {open&&<CanvasImport semester={s} initialRaw={source} onClose={()=>setOpen(false)} onApply={(b,c,expected)=>{if(s!==expected)throw new Error("Stale preview");setS(planCanvasImport(s,b,c).semester);setWrites(writes+1);}}/>}
  </section>;
}
