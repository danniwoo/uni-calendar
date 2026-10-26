// Invented portfolio fixture; never load student exports here.
import React,{useState} from "react";
import {CanvasImport} from "../../components/canvas-import";
import {fixtureBoard,fixtureBundle} from "../fixtures/canvas-connect";
import {confirmCanvasImport} from "../../lib/canvas-history";
import {planCanvasImport} from "../../lib/canvas-import";
const board=structuredClone(fixtureBoard),bundle=structuredClone(fixtureBundle);
const course=bundle.courses[3],base=board.tasks[3];
bundle.courses=[course];board.units=[board.units[3]];
board.tasks=[
  {...base,id:"report",title:"Design report",weight:"6%"},
  {...base,id:"talk",title:"Design presentation",weight:"4%"},
  {...base,id:"final-report",title:"Final research report",weight:"40%"},
  {...base,id:"final-demo",title:"Final client demonstration",weight:"10%"},
  {...base,id:"minutes",title:"Weekly progress records",weight:"7%",kind:"recurring"},
];
board.units[0].assessments=board.tasks;
course.groups=[
  {id:"5",name:"Design portfolio (10%)",weight:10,rules:{dropLowest:0,dropHighest:0,neverDrop:[]}},
  {id:"6",name:"Final deliverables",weight:50,rules:{dropLowest:0,dropHighest:0,neverDrop:[]}},
  {id:"7",name:"Weekly progress records",weight:7,rules:{dropLowest:2,dropHighest:0,neverDrop:[]}},
];
const a=course.assignments[0],blank=course.assignments[1];
course.assignments=[
  {...a,id:"1",name:"Design report",pointsPossible:50,submission:{...a.submission!,score:41}},
  {...a,id:"2",name:"Design presentation",pointsPossible:25,submission:{...a.submission!,score:20}},
  {...blank,id:"3",name:"Peer feedback",pointsPossible:0},
  {...blank,id:"4",name:"Final research report (40%)",groupId:"6"},
  {...blank,id:"5",name:"Final client demonstration (10%)",groupId:"6"},
  {...blank,id:"6",name:"Week 2 progress record",groupId:"7"},
  {...blank,id:"7",name:"Week 3 progress record",groupId:"7"},
];
const saved=planCanvasImport(board,bundle,[{courseId:course.course.id,assignmentId:"1",unit:"COMP3888",targetId:"report",mode:"overall"},{courseId:course.course.id,assignmentId:"2",unit:"COMP3888",targetId:"talk",mode:"overall"}]).semester;
bundle.courses[0].assignments[0].submission!.score=43;
bundle.courses[0].fetchedAt=bundle.exportedAt="2026-10-26T06:00:00Z";
export function MatchingQA(){
  const [s,setS]=useState(saved),[open,setOpen]=useState(true),[writes,setWrites]=useState(0);
  const [scenario,setScenario]=useState("update");
  const preview=structuredClone(bundle);
  if(scenario==="unchanged")preview.courses[0].assignments[0].submission!.score=41;
  if(scenario==="new-result")preview.courses[0].assignments[3].submission={released:true,excused:false,score:8,currentAttemptGraded:true,releaseEvidence:"marks-page"};
  return <main style={{maxWidth:1200,margin:"20px auto",padding:24}}><h1>Group matching QA · synthetic only</h1><p>No account connection. All marks are invented. No live data is used.</p><p role="status">Test writes: {writes}</p><button onClick={()=>setOpen(true)}>Reopen preview</button>
    <label>QA scenario<select aria-label="QA scenario" value={scenario} onChange={e=>{setScenario(e.target.value);setOpen(true);}}><option value="update">One changed grade</option><option value="unchanged">No changed grades</option><option value="new-result">New unconnected result</option></select></label>
    {open&&<CanvasImport key={scenario} semester={s} initialRaw={JSON.stringify(preview)} onClose={()=>setOpen(false)} onApply={(b,c,expected)=>{if(s!==expected)throw new Error("Stale");setS(confirmCanvasImport(s,b,c,crypto.randomUUID()).semester);setWrites(writes+1);}}/>}
  </main>;
}
