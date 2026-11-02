// Invented data: two scheduled attempts in a highest-of-two quiz.
import {fixtureBoard,fixtureBundle} from "./canvas-connect";
import {attemptSchedules,newAttemptTask,saveAttempts} from "../../lib/assessment-attempts";
import type {GradePlan} from "../../lib/semester";
export function canvasLocalAttemptsFixture(){
  const board=structuredClone(fixtureBoard),bundle=structuredClone(fixtureBundle);
  const quiz=board.tasks[0],c=bundle.courses[0],a=c.assignments[0];
  quiz.title="Quiz 3";quiz.kind="quiz";quiz.weight="15%";quiz.week=12;
  quiz.date="2026-10-28";quiz.time="12:00";
  const plan:GradePlan={mode:"parts",method:"highest",items:[
    {id:"local-first",name:"Attempt 1"},{id:"local-second",name:"Attempt 2"}]};
  const rows=attemptSchedules(board,quiz,plan);
  rows[0]={...rows[0],existingId:quiz.id,task:{...quiz}};
  rows[1].task={...newAttemptTask(quiz,1),date:"2026-11-04",time:"12:00",week:13,reminders:[{id:"alert",kind:"before",minutes:30}]};
  bundle.courses=[c];c.assignments=[a];a.name="Sample Quiz 3, attempt 1 - Secure browser";a.pointsPossible=15;a.submission!.score=8;
  return {board:saveAttempts(board,quiz.id,plan,rows,board),bundle,quizId:quiz.id};
}
