import {addDays,type ClassEvent,type Task,type Semester} from "./semester";

export function mondayOf(date:string){return addDays(date,-((new Date(date+"T12:00:00Z").getUTCDay()+6)%7));}
export function shortLocation(location:string){
  if(!location)return "";
  // Timetable alternatives can be date-dependent; never pick one at random.
  if(/\([^)]*\d+\s*\/\s*\d+/.test(location)||location.split(/,\s*(?=[A-Z]\d+\.)/).length>1)return "Room varies · see details";
  const code=location.match(/^([A-Z]\d+)\.\d+\.([A-Z\d]+)\./i);
  return code?`${code[1]} · ${code[2]}`:location;
}
export function minutes(time?:string){
  const m=time?.match(/^(\d{2}):(\d{2})$/);
  return m&&+m[1]<24&&+m[2]<60?+m[1]*60 + +m[2]:null;
}
export function classRange(c:ClassEvent){
  const start=minutes(c.time),end=minutes(c.end);
  return start!==null&&end!==null&&end>start?{start,end}:null;
}
// Only explicit, uniquely matched in-class tasks belong inside a class.
// Before-class work remains a deadline; a similar title is not sufficient evidence.
export function matchedClass(t:Task,classes:ClassEvent[]){
  if(t.timeBasis!=="class" || !/^During\b/i.test(t.timing) || !t.date || !t.time)return undefined;
  const candidates=classes.filter(c=>c.unit===t.unit&&c.date===t.date&&c.time===t.time&&classRange(c));
  return candidates.length===1?candidates[0]:undefined;
}
export function weekData(s:Semester,start:string,unit="all",showClasses=true){
  const end=addDays(start,6),active=new Set(s.units.map(u=>u.code));
  const own=(code:string)=>active.has(code)&&(unit==="all"||unit===code);
  const classes=showClasses?s.classes.filter(c=>own(c.unit)&&c.date>=start&&c.date<=end):[];
  const tasks=s.tasks.filter(t=>own(t.unit)&&!t.splitCount);
  const dated=tasks.filter(t=>t.date&&t.date>=start&&t.date<=end);
  const linked=new Map<string,Task[]>();
  const due=dated.filter(t=>{const c=matchedClass(t,classes);if(!c)return true;linked.set(c.id,[...(linked.get(c.id)||[]),t]);return false;});
  const weekOnly=tasks.filter(t=>!t.date&&t.week&&s.weeks.some(w=>w.number===t.week&&w.start<=end&&w.end>=start));
  const unknown=tasks.filter(t=>!t.date&&!t.week);
  return {classes,due,linked,weekOnly,unknown};
}
export type PositionedClass={event:ClassEvent;start:number;end:number;lane:number;lanes:number};
export function positionClasses(classes:ClassEvent[]):PositionedClass[]{
  const sorted=classes.flatMap(event=>{const range=classRange(event);return range?[{event,...range,lane:0,lanes:1}]:[];}).sort((a,b)=>a.start-b.start||b.end-a.end||a.event.id.localeCompare(b.event.id));
  const output:PositionedClass[]=[];let group:PositionedClass[]=[],groupEnd=-1;
  function flush(){if(!group.length)return;const lanes=Math.max(...group.map(c=>c.lane))+1;output.push(...group.map(c=>({...c,lanes})));group=[];}
  for(const c of sorted){
    if(c.start>=groupEnd){flush();groupEnd=-1;}
    const occupied=new Set(group.filter(p=>p.end>c.start).map(p=>p.lane));
    while(occupied.has(c.lane))c.lane++;
    group.push(c);groupEnd=Math.max(groupEnd,c.end);
  }
  flush();return output;
}
export function sydneyMinute(now:Date){
  const parts=new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Sydney",hourCycle:"h23",hour:"2-digit",minute:"2-digit"}).formatToParts(now);
  return Number(parts.find(p=>p.type==="hour")?.value)*60+Number(parts.find(p=>p.type==="minute")?.value);
}
