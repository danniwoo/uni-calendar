import React,{useEffect,useState} from "react";
import {CanvasInbox} from "../../components/canvas-inbox";
import {CanvasImport} from "../../components/canvas-import";
import {fixtureBoard,fixtureBundle,fixtureChoices} from "../fixtures/canvas-connect";
import {planCanvasImport} from "../../lib/canvas-import";
import {confirmCanvasImport,markCanvasGradeSeen} from "../../lib/canvas-history";
import {CanvasHistory} from "../../components/canvas-history";
import {AssessmentList} from "../../components/assessment-list";
import {saveGrade,saveGradePlan} from "../../lib/grades";
let saved=planCanvasImport(fixtureBoard,fixtureBundle,fixtureChoices).semester;
saved.tasks[2].grade=null;
saved.tasks.push({...fixtureBoard.tasks[2],id:"prep",title:"Preparation",weight:"4%",grade:undefined});
const prepBundle=structuredClone(fixtureBundle);
prepBundle.courses[2].assignments.push({...structuredClone(prepBundle.courses[2].assignments[1]),id:"80",name:"Preparation 1"});
saved=planCanvasImport(saved,prepBundle,[{courseId:prepBundle.courses[2].course.id,assignmentId:"80",unit:"ELEC2302",targetId:"prep",mode:"part",rule:{method:"completion",count:10,bestCount:8,completionPoints:.5}}]).semester;
const fresh=structuredClone(fixtureBundle);
fresh.courses.forEach(c=>c.fetchedAt="2026-10-24T00:00:00Z");
fresh.exportedAt="2026-10-24T00:00:00Z";
fresh.courses[0].assignments[0].submission!.score=9;
fresh.courses[0].assignments.push({...structuredClone(fresh.courses[0].assignments[1]),id:"3",name:"New practice activity"});
fresh.courses[2].assignments.push({...structuredClone(fresh.courses[2].assignments[1]),id:"81",name:"Preparation 8"});
const raw=JSON.stringify(fresh);
export function UpdatesQA(){
  const [s,setS]=useState(saved),[open,setOpen]=useState(false),[source,setSource]=useState<string>(),[writes,setWrites]=useState(0),[checks,setChecks]=useState(0);
  const [history,setHistory]=useState(false),[focusGrade,setFocusGrade]=useState<{id:string;request:number}>();
  function incoming(value=raw){window.postMessage({type:"semester-connect-inbox-v1",inbox:{enabled:true,canCheckAll:true,checking:false,courseCount:4,message:"Synthetic course check complete. Nothing imported.",raw:value}},location.origin);}
  useEffect(()=>{const listener=(e:MessageEvent)=>{if(e.origin===location.origin&&e.data?.type==="semester-connect-check-all-v1"){setChecks(n=>n+1);incoming();}};window.addEventListener("message",listener);return()=>window.removeEventListener("message",listener);},[]);
  function download(){const url=URL.createObjectURL(new Blob([raw],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download="synthetic-canvas-update.json";a.click();URL.revokeObjectURL(url);}
  return <section><h1>Canvas update QA · synthetic only</h1><p>No Canvas connection, credentials or account API. Buttons simulate the website receiving a pending snapshot. Saves affect this test tab’s memory only.</p>
    <button onClick={()=>incoming()}>Simulate reload check</button><button onClick={()=>{const changed=structuredClone(fresh);changed.courses[0].assignments[0].submission!.score=10;incoming(JSON.stringify(changed));}}>Simulate later result</button>
    <button onClick={()=>{setSource(undefined);setOpen(true);}}>Open JSON test entry</button><button onClick={download}>Download update fixture</button>
    <button onClick={()=>setS({...s,warnings:[...s.warnings,"Concurrent synthetic edit"]})}>Simulate concurrent board edit</button>
    <p role="status">Test writes: {writes} · batch requests: {checks} · saved quiz: {s.tasks[0].grade?.earned}/10 · protected grade: {s.tasks[1].grade?.earned}/10 · manual clear: {String(s.tasks[2].grade)}</p>
    <CanvasInbox semester={s} reviewOpen={open} onReview={value=>{setSource(value);setOpen(true);}}/>
    {open&&<CanvasImport semester={s} initialRaw={source} onClose={()=>setOpen(false)} onApply={(b,c,expected)=>{if(s!==expected)throw new Error("Stale preview");setS(confirmCanvasImport(s,b,c,crypto.randomUUID()).semester);setWrites(writes+1);}}/>}
    <button onClick={()=>setHistory(!history)}>Canvas update history</button>
    {history&&<CanvasHistory semester={s} onOpenGrade={id=>{setHistory(false);setFocusGrade({id,request:Date.now()});}}/>}
    {!open&&!history&&<AssessmentList semester={s} today="2026-10-26" focusGrade={focusGrade} onOpen={()=>{}} onToggle={()=>{}} onGrade={(id,g,expected)=>setS(saveGrade(s,id,g,expected))} onGradePlan={(id,g,expected)=>setS(saveGradePlan(s,id,g,expected))} onGradeSeen={id=>setS(old=>markCanvasGradeSeen(old,id))}/>}
  </section>;
}
