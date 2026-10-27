// Invented four-course batch: one numeric update, one Complete update, one
// unchanged Complete, and one manually protected outcome. No real exports.
import {fixtureBoard,fixtureBundle} from "./canvas-connect";
import {planCanvasImport,type CanvasChoice} from "../../lib/canvas-import";
export function mixedUpdatesFixture(){
  const base=structuredClone(fixtureBoard),older=structuredClone(fixtureBundle);
  base.tasks.forEach(t=>delete t.grade);
  base.tasks[0]={...base.tasks[0],kind:"assessment",title:"Data modelling assignment"};
  base.tasks[2].title="Tutorial preparation";
  older.courses.forEach(c=>c.assignments=[]);
  const numeric={...structuredClone(fixtureBundle.courses[0].assignments[0]),name:"Data modelling assignment",pointsPossible:20,submission:{released:true,excused:false,score:13,releaseEvidence:"marks-page" as const,currentAttemptGraded:true}};
  const prep=older.courses[2];
  prep.assignments=[1,2,3,4].map(n=>({...structuredClone(numeric),id:String(n),name:`Preparation ${n}`,pointsPossible:0,submission:{...numeric.submission,score:null,released:n===2},...(n===2?{result:"complete" as const}:{})}));
  const rule={method:"completion" as const,count:4,bestCount:3,completionPoints:.5};
  const links:CanvasChoice[]=prep.assignments.slice(0,3).map(a=>({courseId:prep.course.id,assignmentId:a.id,unit:"ELEC2302",targetId:"root-2",mode:"part",rule}));
  const board=planCanvasImport(base,older,links).semester;
  // User-edited outcome deliberately differs from the Canvas source baseline.
  board.tasks.find(t=>t.id==="root-2")!.gradePlan!.items[2].outcome="missed";
  const bundle=structuredClone(older);
  bundle.exportedAt="2026-10-21T00:00:00Z";bundle.courses.forEach(c=>c.fetchedAt=bundle.exportedAt);
  bundle.courses[0].assignments=[numeric];
  for(const a of bundle.courses[2].assignments.slice(0,3)){a.result="complete";a.submission!.released=true;}
  const raw=JSON.stringify({...bundle,courses:bundle.courses.map(c=>({...c,assignments:c.assignments.map(a=>({...a,...(a.result?{gradingType:"pass_fail",submission:{...a.submission,grade:a.result}}:{})}))}))});
  return {board,bundle,raw};
}
