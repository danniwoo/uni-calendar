import {addDays, weekFor, type Semester, type Task} from "./semester";

export const validDate = (value:string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+"T00:00:00Z")) && new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
const validTime = (value:string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export function availabilityError(t:Task):string {
  for(const [name,date,time] of [["Available from",t.availableFrom,t.availableFromTime],["Available until",t.availableUntil,t.availableUntilTime]]) {
    if(date && !validDate(date)) return `${name}: enter a valid date.`;
    if(time && (!date || !validTime(time))) return `${name}: a valid time needs a date.`;
  }
  const after=(a?:string,at?:string,b?:string,bt?:string)=>!!a&&!!b&&(a>b || a===b&&!!at&&!!bt&&at>bt);
  if(after(t.availableFrom,t.availableFromTime,t.availableUntil,t.availableUntilTime)) return "Available until must not be before available from.";
  if(after(t.availableFrom,t.availableFromTime,t.date,t.time)) return "Available from must not be after the due date.";
  if(after(t.date,t.time,t.availableUntil,t.availableUntilTime)) return "Available until must not be before the due date. Check the Canvas dates.";
  return "";
}

export type AssessmentStep = {title:string; weight?:string; mode:"unknown"|"week"|"date"|"tutorial"; week?:number; date?:string; time?:string; classId?:string};
export function tutorialChoices(s:Semester,unit:string,week?:number) {
  return s.classes.filter(c=>c.unit===unit && c.week===week && /tut/i.test(c.activity));
}
export function stepTiming(s:Semester,unit:string,row:AssessmentStep):Pick<Task,"week"|"date"|"time"|"endTime"|"timeBasis"|"timing"> {
  if(row.mode==="unknown") return {timing:"Schedule not confirmed"};
  if(row.mode==="date") {
    if(!row.date || !validDate(row.date) || !s.weeks.some(w=>row.date!>=w.start && row.date!<=w.end)) throw new Error("Choose a valid date in this semester.");
    if(row.time && !validTime(row.time)) throw new Error("Enter a valid time.");
    return {date:row.date,time:row.time||undefined,week:weekFor(row.date,s.weeks),timeBasis:"deadline",timing:"Deadline entered by you"};
  }
  if(!s.weeks.some(w=>w.kind==="teaching" && w.number===row.week)) throw new Error("Choose a teaching week.");
  if(row.mode==="tutorial") {
    const choices=tutorialChoices(s,unit,row.week);
    const c=row.classId?choices.find(c=>c.id===row.classId):choices.length===1?choices[0]:undefined;
    if(row.classId&&!c) throw new Error("That tutorial is no longer in this week. Select it again.");
    if(c) {
      if(!validDate(c.date)||!validTime(c.time)||!validTime(c.end)||c.end<=c.time) throw new Error("Check this tutorial's date and time before linking it.");
      return {week:row.week,date:c.date,time:c.time,endTime:c.end,timeBasis:"class",timing:"During tutorial"};
    }
    return {week:row.week,timeBasis:"class",timing:"During tutorial · date/time unconfirmed"};
  }
  return {week:row.week,timing:"Teaching week entered by you"};
}
export function sprintSteps(s:Semester,count:number,first:number):AssessmentStep[] {
  if(!Number.isInteger(count)||count<1||count>15) throw new Error("Choose 1–15 sprints.");
  return Array.from({length:count},(_,i)=>{
    const w=s.weeks.find(w=>w.kind==="teaching"&&w.number===first+i);
    if(!w) throw new Error("Choose sprint weeks within this semester.");
    return [{title:`Sprint ${i+1} · Demo`,mode:"tutorial" as const,week:w.number},{title:`Sprint ${i+1} · Report & code`,mode:"date" as const,week:w.number,date:addDays(w.start,6),time:"23:59"}];
  }).flat();
}
// Steps are actionable requirements, not inferred marks. The parent's weight
// remains the assessment total; blank step weights do not mean zero marks.
export function createAssessmentSteps(s:Semester,parent:Task,rows:AssessmentStep[]):Semester {
  const original=s.tasks.find(t=>t.id===parent.id);
  if(!original) throw new Error("Save the assessment before adding steps.");
  if(original.splitCount || s.tasks.some(t=>t.parentId===parent.id || t.series===parent.id)) throw new Error("This assessment already has parts. Edit its existing parts instead.");
  if(rows.length<2 || rows.length>30) throw new Error("Add 2–30 steps.");
  const weights=rows.map(r=>r.weight?.trim()||"");
  if(weights.some(w=>w!==""&&(!/^\d+(?:\.\d+)?$/.test(w)||Number(w)>100))) throw new Error("Enter a percentage from 0 to 100, or leave the step weight unknown.");
  const total=parseFloat(original.weight),sum=weights.reduce((n,w)=>n+Number(w),0);
  if(Number.isFinite(total) && (sum>total+0.01 || weights.every(Boolean)&&Math.abs(sum-total)>0.01)) throw new Error(`Step weights must total ${total}%, or leave unconfirmed weights blank.`);
  const children=rows.map((r,i):Task=>{
    if(!r.title.trim()) throw new Error(`Step ${i+1}: enter a name.`);
    let timing;try{timing=stepTiming(s,original.unit,r);}catch(e){throw new Error(`Step ${i+1}: ${(e as Error).message}`);}
    return {id:`${original.id}-part-${i+1}`,unit:original.unit,title:r.title.trim(),kind:"assessment",weight:weights[i]?`${weights[i]}%`:"",parentId:original.id,splitPart:i+1,
      ...timing,description:`Part of ${original.title}. Schedule entered by you.`,source:original.source,sourceText:original.sourceText,group:original.group,hurdle:false,manual:true,overrides:[],done:false};
  });
  const aggregate:Task={...original,splitCount:rows.length,date:undefined,time:undefined,week:undefined,dueWeek:undefined,startWeek:undefined,manual:true,
    overrides:[...new Set([...(original.overrides||[]),"splitCount","date","time","week","dueWeek","startWeek"])]};
  return {...s,tasks:[...s.tasks.map(t=>t.id===parent.id?aggregate:t),...children]};
}
