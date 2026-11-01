// Invented results and timetable only; never copy a user's course export.
import {calendarFixture} from "./calendar-visibility";
import type {Semester} from "../../lib/semester";
export const attemptsFixture:Semester={...structuredClone(calendarFixture),
  tasks:[{...calendarFixture.tasks[0],id:"practice-quiz",title:"Practice quiz",kind:"quiz",weight:"15%",date:"2026-10-28",time:"12:00",week:12,timeBasis:"class",timing:"During your tutorial",
    rules:{attempts:2,text:"Synthetic rule: highest of two attempts"},grade:{earned:6,possible:15},gradePlan:{mode:"parts",method:"highest",items:[{id:"try-1",name:"Attempt 1",grade:{earned:6,possible:15}},{id:"try-2",name:"Attempt 2",maximum:15}]},reminders:[{id:"existing-alert",kind:"before",minutes:30}]},
    {...calendarFixture.tasks[4],id:"unrelated",title:"Other report"}],
  classes:[{...calendarFixture.classes[0],id:"tutorial-w12",week:12,date:"2026-10-28"},{...calendarFixture.classes[0],id:"tutorial-w13",week:13,date:"2026-11-04"}]};
