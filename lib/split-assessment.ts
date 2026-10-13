import { addDays, weekFor, type Semester, type Task } from "./semester";

export type PartSchedule = {week?:number; date?:string; time?:string};
export type SplitPlan = {count:number; weight:number; label:string; weeks:(number | undefined)[]; weekday?:number; time?:string; routine?:boolean; schedules?:PartSchedule[]};
export function fillEmptySchedules(current:PartSchedule[], incoming:PartSchedule[], replace=false):PartSchedule[] {
  return current.map((row,i)=>replace || (!row.week && !row.date && !row.time) ? {...(incoming[i] || {})} : {...row});
}
export function splitAssessment(s:Semester, parent:Task, plan:SplitPlan): Semester {
  const original=s.tasks.find(t=>t.id===parent.id) || parent;
  if (original.splitCount || s.tasks.some(t=>t.parentId===parent.id || t.series===parent.id)) throw new Error("This assessment already has separate parts. Edit those parts below.");
  if (!Number.isInteger(plan.count) || plan.count<2 || plan.count>30 || plan.weeks.length!==plan.count) throw new Error("Choose 2–30 parts.");
  if (!Number.isFinite(plan.weight) || plan.weight<0 || !plan.label.trim()) throw new Error("Enter a name and valid weight for each part.");
  const total=parseFloat(original.weight);
  if (Number.isFinite(total) && Math.abs(total-plan.count*plan.weight)>0.01) throw new Error(`The parts must add up to ${total}%. Adjust the count or weight.`);
  if (plan.weekday !== undefined && (!Number.isInteger(plan.weekday) || plan.weekday<0 || plan.weekday>6)) throw new Error("Choose a valid weekday.");
  if (plan.time && !/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(plan.time)) throw new Error("Enter a valid time.");
  if (plan.time && plan.weekday===undefined) throw new Error("Choose the shared weekday before setting a time.");
  if (plan.schedules && plan.schedules.length!==plan.count) throw new Error("Check the schedule for every part.");
  const parts=plan.weeks.map((number,i):Task=>{
    const week=s.weeks.find(w=>w.kind==="teaching" && w.number===number);
    if (number!==undefined && !week) throw new Error("Choose a teaching week from this semester.");
    const midnight=plan.time==="24:00";
    const date=week && plan.weekday!==undefined ? addDays(week.start,plan.weekday+(midnight?1:0)) : undefined;
    let schedule:PartSchedule={week:number,date,time:date ? midnight ? "00:00" : plan.time : undefined};
    if (plan.schedules) {
      schedule={...plan.schedules[i]};
      if (schedule.date) {
        const parsed=new Date(`${schedule.date}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(schedule.date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==schedule.date || !s.weeks.some(w=>schedule.date!>=w.start && schedule.date!<=w.end)) throw new Error(`Part ${i+1}: choose a valid date in this semester.`);
        schedule.week=weekFor(schedule.date,s.weeks);
      } else if (schedule.week!==undefined && !s.weeks.some(w=>w.kind==="teaching" && w.number===schedule.week)) throw new Error(`Part ${i+1}: choose a teaching week.`);
      if (schedule.time && (!schedule.date || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule.time))) throw new Error(`Part ${i+1}: a time needs an exact date.`);
    }
    return {id:`${parent.id}-part-${i+1}`,unit:original.unit,title:plan.routine ? plan.label.trim() : `${plan.label.trim()} ${i+1}`,weight:plan.routine ? "" : `${plan.weight}%`,routine:plan.routine,
      kind:"assessment",parentId:parent.id,splitPart:i+1,...schedule,dueWeek:schedule.date?schedule.week:undefined,
      timing:"Schedule entered by you",timeBasis:"deadline",description:`Part ${i+1} of ${plan.count}: ${original.title}. Schedule entered by you.`,
      source:original.source,sourceText:original.sourceText,group:original.group,hurdle:false,manual:true,overrides:[],done:false};
  });
  const aggregate:Task={...original,splitCount:plan.count,manual:true,
    overrides:[...new Set([...(original.overrides || []),"splitCount","date","time","week","startWeek"])],date:undefined,time:undefined,week:undefined,startWeek:undefined};
  return {...s,tasks:[...s.tasks.filter(t=>t.id!==parent.id),aggregate,...parts]};
}
