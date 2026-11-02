import {addDays,sydneyDate,type Semester,type Task} from "./semester";
import {reminderJobs,sydneyInstant,type ReminderJob} from "./reminders";

/** Choices travel with the board; permission and delivery receipts stay on the device. */
export type AutomaticReminders={enabled:boolean;enabledAt:number;deadlines:boolean;activities:boolean;missingDates:boolean;quiet:boolean;quietStart:string;quietEnd:string};
export type AutomaticReminderChoice="inherit"|"off"|"on";
export const automaticDefaults:AutomaticReminders={enabled:false,enabledAt:0,deadlines:true,activities:true,missingDates:true,quiet:true,quietStart:"22:00",quietEnd:"08:00"};
const clock=/^([01]\d|2[0-3]):[0-5]\d$/;
export const validAutomaticChoice=(v:unknown)=>v===undefined||["inherit","off","on"].includes(String(v))&&typeof v==="string";
export function automaticReminderError(v:unknown):string|undefined {
  if(v===undefined)return;
  if(!v||typeof v!=="object"||Array.isArray(v))return "Invalid automatic reminder settings.";
  const p=v as AutomaticReminders;
  if([p.enabled,p.deadlines,p.activities,p.missingDates,p.quiet].some(x=>typeof x!=="boolean")||!Number.isSafeInteger(p.enabledAt)||p.enabledAt<0||p.enabledAt>Date.UTC(2100,0,1)||p.enabled&&p.enabledAt===0)return "Invalid automatic reminder settings.";
  if(typeof p.quietStart!=="string"||typeof p.quietEnd!=="string"||!clock.test(p.quietStart)||!clock.test(p.quietEnd)||p.quietStart===p.quietEnd)return "Choose different valid start and end times for quiet hours.";
}
export function saveAutomaticReminders(s:Semester,choice:AutomaticReminders,expected:Semester,now=Date.now()):Semester {
  if(s.boardGeneration!==expected.boardGeneration||s.year!==expected.year||s.session!==expected.session||s.feedUrl!==expected.feedUrl||JSON.stringify(s.automaticReminders)!==JSON.stringify(expected.automaticReminders))throw new Error("Reminder settings changed. Cancel and reopen before saving.");
  const next={...choice,enabledAt:choice.enabled&&!s.automaticReminders?.enabled?now:choice.enabledAt};
  const error=automaticReminderError(next);if(error)throw new Error(error);
  return {...s,automaticReminders:next};
}
export type AutomaticAlert={taskId:string;title:string;unit:string;when:number;reason:string;kind:"deadline"|"activity"|"missing"};
export type AutomaticBatch={job:ReminderJob;items:AutomaticAlert[]};
const timeFormat=new Intl.DateTimeFormat("en-GB",{timeZone:"Australia/Sydney",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const dateLabel=(date:string)=>new Intl.DateTimeFormat("en-AU",{timeZone:"UTC",day:"numeric",month:"short"}).format(new Date(date+"T12:00:00Z"));
/** Shift early, never after a deadline. This affects automatic alerts only. */
export function quietReminderTime(at:number,p:AutomaticReminders):number|undefined {
  if(!p.quiet)return at;
  const date=sydneyDate(new Date(at)),time=timeFormat.format(at),overnight=p.quietStart>p.quietEnd;
  const quiet=overnight?(time>=p.quietStart||time<p.quietEnd):(time>=p.quietStart&&time<p.quietEnd);
  if(!quiet)return at;
  const start=sydneyInstant(overnight&&time<p.quietEnd?addDays(date,-1):date,p.quietStart);
  return start===undefined?undefined:start-60000;
}
export function automaticTaskStatus(t:Task,p?:AutomaticReminders){
  if(t.reminders?.length)return "Custom alerts · automatic alerts replaced";
  if(t.automaticReminder==="off")return "Automatic alerts off for this item";
  if(!p?.enabled)return "Automatic alerts off";
  if(t.done)return "Automatic alerts paused · completed";
  if(t.rules?.optional&&t.automaticReminder!=="on"&&!t.attemptId)return "Optional item · alerts off";
  if(t.kind==="task"||t.kind==="event"||t.routine||t.kind==="recurring")return "Use custom alerts for this item";
  if(t.date){
    const activity=t.timeBasis==="class"&&!/^before\b/i.test(t.timing)||t.kind==="exam";
    if(!(activity?p.activities:p.deadlines))return "Automatic alerts off for this category";
    return !t.time||t.allDay?"Automatic · day before & on the day at 9 am":activity?"Automatic · 1 day & 30 minutes before":"Automatic · 1 day & 2 hours before";
  }
  return (t.week||t.dueWeek)&&p.missingDates?`Automatic · confirm Week ${t.week||t.dueWeek} date`:"Needs a date or teaching week for automatic alerts";
}
export function automaticAlerts(s:Semester|null):AutomaticAlert[]{
  const p=s?.automaticReminders;
  if(!s||!p?.enabled||automaticReminderError(p))return [];
  const units=new Set(s.units.map(u=>u.code)),tasks=new Map(s.tasks.map(t=>[t.id,t])),alerts:AutomaticAlert[]=[];
  for(const t of s.tasks){
    if(!units.has(t.unit)||t.done||t.reminders?.length||t.automaticReminder==="off"||t.kind==="task"||t.kind==="event"||t.routine||t.kind==="recurring")continue;
    const parent=t.parentId?tasks.get(t.parentId):undefined;
    if(parent?.done||parent?.automaticReminder==="off"&&t.automaticReminder!=="on")continue;
    const result=t.attemptId?parent?.gradePlan?.items.find(i=>i.id===t.attemptId):undefined;
    // A saved attempt schedule is participation; an unscheduled opportunity is not.
    if(t.attemptId&&(!result||result.excluded||["not_taken","missed","submitted","awaiting"].includes(result.outcome||"")||result.grade))continue;
    if((t.rules?.optional||parent?.rules?.optional)&&t.automaticReminder!=="on"&&!t.attemptId)continue;
    const push=(at:number|undefined,kind:AutomaticAlert["kind"],reason:string)=>{
      if(at===undefined)return;
      const when=quietReminderTime(at,p);
      if(when===undefined||when<=p.enabledAt)return;
      alerts.push({taskId:t.id,title:t.title,unit:t.unit,when,kind,reason});
    };
    const scheduled=(date:string,time:string|undefined,kind:"deadline"|"activity",label:string)=>{
      if(sydneyInstant(date,"09:00")===undefined)return;
      if(time){const target=sydneyInstant(date,time);if(target===undefined)return;
        push(target-86400000,kind,`${label} ${dateLabel(date)} · ${time}`);
        push(target-(kind==="deadline"?120:30)*60000,kind,`${label} ${dateLabel(date)} · ${time}`);
      }else{
        // No exact time means no relative countdown or invented midnight deadline.
        for(const d of [addDays(date,-1),date])push(sydneyInstant(d,"09:00"),kind,`${label} ${dateLabel(date)} · time not set`);
      }
    };
    const missing=(week:number|undefined,label:string)=>{
      if(!p.missingDates||!week)return;
      const w=s.weeks.find(w=>w.number===week&&w.kind==="teaching");if(!w)return;
      let when=sydneyInstant(w.start,"09:00");if(when===undefined)return;
      const enabledDay=sydneyDate(new Date(p.enabledAt));
      // A fixed activation anchor avoids missed current-week prompts or rolling
      // jobs that would violate Connect's same-revision idempotence check.
      if(when<=p.enabledAt&&enabledDay>=w.start&&enabledDay<=w.end){
        const candidate=p.enabledAt+60000,shifted=quietReminderTime(candidate,p);
        const candidateDay=sydneyDate(new Date(candidate));
        const endDay=timeFormat.format(candidate)<p.quietEnd?candidateDay:addDays(candidateDay,1);
        when=shifted!==undefined&&shifted>p.enabledAt?candidate:sydneyInstant(endDay,p.quietEnd);
        if(when!==undefined&&sydneyDate(new Date(when))>w.end)return;
      }
      push(when,"missing",`Week ${week} · confirm ${label}`);
    };
    if(!t.splitCount){
      const activity=t.timeBasis==="class"&&!/^before\b/i.test(t.timing)||t.kind==="exam";
      if(t.date&&(activity?p.activities:p.deadlines))scheduled(t.date,t.allDay?undefined:t.time,activity?"activity":"deadline",activity?"Scheduled":"Due");
      else if(!t.date)missing(t.week||t.dueWeek,"date & time");
    }
    const a=t.activity;
    if(a){
      if(a.startDate&&(!a.endDate||a.endDate===a.startDate)&&p.activities)scheduled(a.startDate,a.time,"activity",a.label||"Activity");
      else if(!a.startDate)missing(a.week,"activity date & time");
    }
  }
  // Quiet hours can move both alerts to the same instant; send only one per item.
  const unique=new Map<string,AutomaticAlert>();
  for(const a of alerts){const key=JSON.stringify([a.taskId,a.when]);const old=unique.get(key);unique.set(key,old&&old.reason!==a.reason?{...old,reason:`${old.reason}; ${a.reason}`} :a);}
  return [...unique.values()].sort((a,b)=>a.when-b.when||a.taskId.localeCompare(b.taskId));
}
const hash=(text:string)=>{let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36);};
export function automaticBatches(s:Semester|null,now=Date.now()):AutomaticBatch[]{
  if(!s)return [];
  const groups=new Map<number,AutomaticAlert[]>();
  for(const a of automaticAlerts(s).filter(a=>a.when>now))groups.set(a.when,[...(groups.get(a.when)||[]),a]);
  const generation=s.boardGeneration||`${s.year}:${s.session}`;
  return [...groups].map(([when,items])=>{
    const signature=hash(JSON.stringify([generation,items.map(i=>[i.taskId,i.reason])]));
    const taskId=items.length===1?items[0].taskId:`auto-digest:${when}:${signature}`;
    const first=items[0],count=items.length;
    return {items,job:{key:JSON.stringify([generation,"automatic",when,signature]),taskId,when,
      title:(count>1?`Semester · ${count} reminders`:first.kind==="missing"?`Check this week’s date · ${first.title}`:`Coming up · ${first.title}`).slice(0,180),
      unit:count>1?"Semester":first.unit,
      label:(count>1?`${count} items · open to see what’s coming up`:first.reason).slice(0,100)}};
  });
}
export function allReminderJobs(s:Semester|null,now=Date.now()):ReminderJob[]{
  return [...reminderJobs(s,now),...automaticBatches(s,now).map(b=>b.job)].sort((a,b)=>a.when-b.when||a.key.localeCompare(b.key));
}
