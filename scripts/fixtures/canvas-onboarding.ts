// Invented onboarding dataset: four courses, new identity, no saved links.
import {fixtureBoard,fixtureBundle} from "./canvas-connect";
import type {CanvasAssignment} from "../../lib/canvas-import";
export const onboardingBoard=structuredClone(fixtureBoard);
onboardingBoard.units.forEach(u=>u.assessments=[]);
onboardingBoard.tasks=[];
export const onboardingBundle=structuredClone(fixtureBundle);
onboardingBundle.courses.forEach((c,i)=>{
  const source=c.assignments[0];
  const names=["Assignment 1","Final project report (40%)","Laboratory practical","Research presentation"];
  c.assignments=Array.from({length:16},(_,n):CanvasAssignment=>({...structuredClone(source),id:String(n+1),name:n===0?names[i]:`Week ${n+1} activity`,pointsPossible:n===0?20:0,submission:n===0?{released:true,excused:false,score:12+i,releaseEvidence:"marks-page",currentAttemptGraded:true}:{released:false,excused:false,score:null,releaseEvidence:null,currentAttemptGraded:true}}));
});
