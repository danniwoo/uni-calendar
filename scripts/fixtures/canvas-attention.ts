// Entirely invented results and IDs. Never load a student's export here.
import {fixtureBoard,fixtureBundle,fixtureTasks} from "./canvas-connect";
import {planCanvasImport,type CanvasChoice} from "../../lib/canvas-import";
export function attentionFixture(){
  const base=structuredClone(fixtureBoard),old=structuredClone(fixtureBundle);
  const unit="TEST1001";
  base.tasks=[4,5,6].map(n=>({...structuredClone(fixtureTasks[0]),id:`quiz-${n}`,unit,kind:"assessment" as const,title:`Quiz ${n}`,grade:undefined}));
  base.units=[{...base.units[0],code:unit,name:"Synthetic course",assessments:base.tasks}];
  old.courses=[old.courses[0]];
  const c=old.courses[0];c.course.code=unit;c.course.name="Synthetic course";
  const source=structuredClone(c.assignments[0]);
  c.assignments=[4,4,5].map((n,i)=>({...structuredClone(source),id:String(i+1),name:`TEST1001 Quiz ${n}, attempt ${i===1?2:1}`,pointsPossible:25,submission:{...source.submission!,score:11+i*2}}));
  const choices:CanvasChoice[]=c.assignments.map((a,i)=>({courseId:c.course.id,assignmentId:a.id,unit,targetId:i<2?"quiz-4":"quiz-5",mode:"part",rule:{method:"highest",count:3}}));
  const board=planCanvasImport(base,old,choices).semester;
  const bundle=structuredClone(old);bundle.exportedAt="2026-10-31T00:00:00Z";bundle.courses[0].fetchedAt=bundle.exportedAt;
  bundle.courses[0].groups[0].rules.dropLowest=1;
  bundle.courses[0].assignments.unshift({...structuredClone(source),id:"8",name:"TEST1001 Quiz 6, attempt 1",pointsPossible:25,submission:{...source.submission!,score:11}});
  return {board,bundle,old,raw:JSON.stringify(bundle)};
}
