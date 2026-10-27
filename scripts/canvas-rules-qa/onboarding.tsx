// Local, in-memory integration fixture. Never calls a real account endpoint.
import React,{useState} from "react";
import {CanvasImport} from "../../components/canvas-import";
import {AssessmentList} from "../../components/assessment-list";
import {onboardingBoard,onboardingBundle} from "../fixtures/canvas-onboarding";
import {fixtureTasks} from "../fixtures/canvas-connect";
import {confirmCanvasImport} from "../../lib/canvas-history";
export function OnboardingQA(){
  const base=structuredClone(onboardingBoard);
  if(location.search.includes("existing"))base.tasks=[{...fixtureTasks[0],kind:"assessment",title:"A1: Data model assignment",grade:undefined}];
  if(location.search.includes("manual"))base.tasks=[{...fixtureTasks[0],kind:"assessment",title:"A1: Data model assignment",grade:{earned:4,possible:20}}];
  const [s,setS]=useState(base),[open,setOpen]=useState(true),[writes,setWrites]=useState(0),[json,setJson]=useState(false);
  return <main style={{maxWidth:1000,margin:"20px auto",padding:24}}><h1>Synthetic first-use test</h1><p>No real account or Canvas data. All writes stay in memory.</p><p>Test writes: {writes}</p><button onClick={()=>setOpen(true)}>Reopen import</button><button onClick={()=>{setJson(true);setOpen(false);}}>Use JSON next time</button><button onClick={()=>setS(old=>({...old,tasks:old.tasks.map(t=>({...t,description:"Concurrent manual note"}))}))}>Simulate concurrent edit</button><p>Saved assessments: {s.tasks.length}</p>
    {open&&<CanvasImport semester={s} initialRaw={json?undefined:JSON.stringify(onboardingBundle)} onClose={()=>setOpen(false)} onApply={(b,c,expected)=>{if(expected!==s)throw new Error("Stale review");setS(confirmCanvasImport(s,b,c,`test-${writes}`).semester);setWrites(writes+1);}}/>}
    {!open&&writes>0&&<AssessmentList semester={s} today="2026-10-27" importedGradeView={writes} onOpen={()=>{}} onToggle={()=>{}} onGrade={()=>{}}/>}
  </main>;
}
