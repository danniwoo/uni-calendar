// Invented calendar only. No Canvas exports, account data or real marks.
import {calendar,type Semester,type Task} from "../../lib/semester";
const task=(id:string,title:string,extra:Partial<Task>={}):Task=>({id,unit:"TEST1001",title,kind:"assessment",weight:"10%",timing:"Week 11",description:"Synthetic notes",source:"",sourceText:"",hurdle:false,group:false,done:false,...extra});
export const calendarFixture:Semester={year:2026,session:"S2C",feedUrl:"",importedAt:"2026-10-19T00:00:00Z",weeks:calendar(2026,"S2C"),warnings:[],
 units:[{code:"TEST1001",name:"Synthetic calendar course",session:"S2C",outline:"",status:"ready",summary:"",topics:[],assessments:[]}],
 completed:{"test-class":false},classes:[{id:"test-class",unit:"TEST1001",activity:"Tutorial",date:"2026-10-20",week:11,time:"12:00",end:"14:00",location:"Synthetic room"}],
 tasks:[task("week-report","Week-only report",{week:11}),task("week-exam","Week-only test",{week:11,kind:"exam"}),task("later","Later week report",{week:12}),task("exam","Final exam",{kind:"exam"}),task("unknown","Date unknown"),
 ...[1,2,3,4].map(n=>task(`due-${n}`,`Deadline ${n}`,{date:"2026-10-21",week:11,time:`${15+n}:00`,timeBasis:"deadline",grade:n===1?{earned:6,possible:8}:undefined})),
 task("class-quiz","In-class quiz",{kind:"quiz",date:"2026-10-20",week:11,time:"12:00",timeBasis:"class",timing:"During your tutorial"}),
 task("personal","Collect parcel",{kind:"task",unit:"",date:"2026-10-22",weight:"",manual:true}),
 task("personal-event","Coffee with a friend",{kind:"event",unit:"",date:"2026-10-22",time:"10:00",endTime:"11:00",allDay:false,weight:"",manual:true})]};
