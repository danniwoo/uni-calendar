// Standalone localhost-only fixture. No account API, Canvas data or live database.
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {AssessmentGrades} from "../../components/assessment-grades";
import {assessmentRows,defaultAssessmentFilters} from "../../lib/assessment-list";
import {saveGrade,saveGradePlan} from "../../lib/grades";
import {fixtureBoard,fixtureTasks} from "../fixtures/canvas-connect";
import type {Semester} from "../../lib/semester";
import "../../app/globals.css";
import "../../app/board.css";
const key="semester-synthetic-rule-qa-v1";
const tasks=[{...fixtureTasks[2],id:"quiz",title:"Practice quiz",weight:"10%",kind:"quiz" as const,done:false,grade:undefined},
  {...fixtureTasks[2],id:"prework",title:"Weekly preparation",weight:"4%",kind:"recurring" as const,grade:undefined},
  {...fixtureTasks[2],id:"rest",title:"Remaining assessments",weight:"86%",kind:"exam" as const,grade:undefined}];
const fixture:Semester={...fixtureBoard,units:[{...fixtureBoard.units[2],assessments:tasks}],tasks};
function App(){
  const [board,setBoard]=useState<Semester>(()=>{try{return JSON.parse(localStorage.getItem(key)||"null")||fixture;}catch{return fixture;}});
  const [detail,setDetail]=useState("");
  function save(next:Semester){localStorage.setItem(key,JSON.stringify(next));setBoard(next);}
  return <main style={{maxWidth:1100,margin:"24px auto",padding:24}}>
    <h1>Synthetic grading-rule test</h1><p>No account connection. Invented entries only; saves stay in this localhost browser.</p>
    <button onClick={()=>{localStorage.removeItem(key);setBoard(structuredClone(fixture));}}>Reset synthetic data</button>
    <p role="status">{detail||"Changes below save to this test page only."}</p>
    <AssessmentGrades semester={board} rows={assessmentRows(board,{...defaultAssessmentFilters,hideRecurring:false},"2026-10-21","overview")} unit="ELEC2302"
      onOpen={t=>setDetail(`Opened ${t.title}`)} onToggle={t=>save({...board,tasks:board.tasks.map(x=>x.id===t.id?{...x,done:!x.done}:x)})}
      onGrade={(id,g,expected)=>save(saveGrade(board,id,g,expected))}
      onGradePlan={(id,p,expected)=>save(saveGradePlan(board,id,p,expected))}/>
  </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
