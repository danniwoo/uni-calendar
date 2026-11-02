import {addDays, calendar, sydneyDate, type Semester, type Task} from "../../../lib/semester.ts";

export function pilotDemo(now = new Date()): Semester {
  const today=sydneyDate(now);
  const due=addDays(today,1);
  if (!today.startsWith("2026-") || !due.startsWith("2026-"))
    throw new Error("This pilot supports the 2026 semester calendar. Choose an existing 2026 export.");
  const session=due < "2026-07-01" ? "S1C" : "S2C";
  const code="DEMO1001";
  const report:Task={id:"pilot-reflection",unit:code,title:"Pilot reflection",kind:"assessment",
    date:due,time:"17:00",timing:"Due by 17:00 Sydney",weight:"20%",hurdle:false,group:false,
    description:"Write a short reflection on your practice session.",source:"Pilot example",sourceText:""};
  const workshop:Task={...report,id:"pilot-workshop",title:"Practice workshop",date:today,time:"12:00",
    kind:"event",timing:"During workshop",weight:"",description:"Practice activity."};
  const undated:Task={...report,id:"pilot-outline",title:"Draft outline",date:undefined,time:undefined,
    timing:"Date to confirm",weight:"",description:"Choose a date for the example outline."};
  return {year:2026,session,importedAt:now.toISOString(),feedUrl:"",classes:[],weeks:calendar(2026,session),
    units:[{code,name:"Pilot practice",session,outline:"",status:"Sample",summary:"Fictional unit for the Semester pilot.",assessments:[report],topics:[]}],
    tasks:[report,workshop,undated],completed:{},warnings:[]};
}
