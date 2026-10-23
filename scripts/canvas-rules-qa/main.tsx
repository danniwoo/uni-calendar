// Isolated synthetic data; no account API or live Canvas connection.
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {CanvasImport} from "../../components/canvas-import";
import {fixtureBoard,fixtureBundle} from "../fixtures/canvas-connect";
import {planCanvasImport} from "../../lib/canvas-import";
import {partGrade} from "../../lib/grades";
import "../../app/globals.css";
import "../../app/board.css";
import {UpdatesQA} from "./updates";
const board=structuredClone(fixtureBoard),bundle=structuredClone(fixtureBundle);
board.tasks=[{...board.tasks[2],id:"quiz",title:"Practice quiz"},{...board.tasks[2],id:"prep",title:"Preparation",weight:"4%"}];
board.units=[{...board.units[2],assessments:board.tasks}];bundle.courses=[bundle.courses[2]];
const course=bundle.courses[0];course.assignments[0].name="Practice attempt 1";course.assignments[1].name="Practice attempt 2";
course.assignments.push({...structuredClone(course.assignments[0]),id:"3",name:"Preparation 1",result:"complete",submission:{...course.assignments[0].submission!,score:null}},
  {...structuredClone(course.assignments[1]),id:"4",name:"Preparation 2"});
function download(){const raw={...bundle,courses:bundle.courses.map(c=>({...c,assignments:c.assignments.map(a=>a.result?{...a,gradingType:"pass_fail",submission:{...a.submission,grade:a.result}}:a)}))};const blob=new Blob([JSON.stringify(raw)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="synthetic-canvas-rules.json";a.click();URL.revokeObjectURL(url);}
function App(){const [s,setS]=useState(board),[open,setOpen]=useState(true),[writes,setWrites]=useState(0);
  return <main style={{maxWidth:1000,margin:"20px auto",padding:24}}><h1>Synthetic Canvas rule import</h1><p>No account connection. Invented results; test saves stay in memory.</p>
    <button onClick={download}>Download synthetic file</button><button onClick={()=>setOpen(true)}>Open import</button><p role="status">Test writes: {writes}</p>
    {s.tasks.map(t=><p key={t.id}>{t.title}: {t.gradePlan?`${partGrade(t.gradePlan).earned}/${partGrade(t.gradePlan).possible} · ${partGrade(t.gradePlan).finished?"settled":"in progress"}`:"no grade"}</p>)}
    {open&&<CanvasImport semester={s} onClose={()=>setOpen(false)} onApply={(b,c,expected)=>{if(s!==expected)throw new Error("Stale preview");setS(planCanvasImport(s,b,c).semester);setWrites(writes+1);}}/>}
  </main>;
}
createRoot(document.getElementById("root")!).render(location.search.includes("updates")?<main style={{maxWidth:1100,margin:"20px auto",padding:24}}><UpdatesQA/></main>:<App/>);
