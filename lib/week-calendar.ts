import {addDays,type ClassEvent,type Task,type Semester} from "./semester";
import {awaitingExamDate} from "./month-calendar";
import {isPersonal,calendarOwns} from "./personal-items";

export function mondayOf(date:string){return addDays(date,-((new Date(date+"T12:00:00Z").getUTCDay()+6)%7));}
export function locationForDate(location:string,date?:string){
  const parts=location.split(/,\s*(?=[A-Z]\d+\.\d+\.)/i).map(p=>p.trim());
  const short=(part:string)=>{const code=part.match(/^([A-Z]\d+)\.\d+\.([A-Z\d]+)\./i);return code?`${code[1]} · ${code[2]}`:part;};
  const variable=parts.length>1||/\([^)]*\d+\s*\/\s*\d+/.test(location);
  const fallback={label:parts.map(short).join(" / ")+(variable?" · room unconfirmed":""),matched:false,variable};
  if(!variable||!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return fallback;
  const year=+date.slice(0,4);
  function stamp(day:string,month:string){
    const d=+day,m=+month;
    if(m<1||m>12||d<1||d>new Date(Date.UTC(year,m,0)).getUTCDate())return null;
    return `${year}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  if(stamp(date.slice(8,10),date.slice(5,7))!==date)return fallback;
  // A trailing date list applies to this room. Other parentheses, e.g. (PC2),
  // are room metadata. Unknown clauses must not silently become a match.
  const matches:boolean[]=[];
  for(const part of parts){
    const dates=part.match(/\(([^()]*)\)\s*$/)?.[1];
    if(!dates)return fallback;
    let matchesDate=false;
    for(const token of dates.split(",")){
      const m=token.trim().match(/^(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*[-–—]\s*(\d{1,2})\s*\/\s*(\d{1,2}))?$/);
      if(!m)return fallback;
      const first=stamp(m[1],m[2]),last=m[3]?stamp(m[3],m[4]):first;
      if(!first||!last||first>last)return fallback;
      if(date>=first&&date<=last)matchesDate=true;
    }
    matches.push(matchesDate);
  }
  if(matches.filter(Boolean).length!==1)return fallback;
  return {label:short(parts[matches.indexOf(true)]),matched:true,variable:true};
}
export function shortLocation(location:string,date?:string){return locationForDate(location,date).label;}
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
  const tasks=s.tasks.filter(t=>calendarOwns(s,t)&&(unit==="all"||unit===t.unit)&&!t.splitCount);
  const dated=tasks.filter(t=>t.date&&t.date>=start&&t.date<=end);
  const linked=new Map<string,Task[]>();
  const events=dated.filter(t=>t.kind==="event"&&!t.allDay&&minutes(t.time)!==null&&minutes(t.endTime)!==null&&minutes(t.endTime)!>minutes(t.time)!);
  const due=dated.filter(t=>{if(events.includes(t))return false;const c=matchedClass(t,classes);if(!c)return true;linked.set(c.id,[...(linked.get(c.id)||[]),t]);return false;});
  const weekOnly=tasks.filter(t=>!t.date&&!awaitingExamDate(t)&&t.week&&s.weeks.some(w=>w.number===t.week&&w.start<=end&&w.end>=start));
  const unknown=tasks.filter(t=>!isPersonal(t)&&!t.date&&!t.week&&!awaitingExamDate(t));
  const unscheduled=tasks.filter(t=>isPersonal(t)&&!t.date);
  const awaitingExams=tasks.filter(awaitingExamDate);
  return {classes,due,events,linked,weekOnly,unknown,unscheduled,awaitingExams};
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
