import type {Semester,Task} from "./semester";
import {canvasGrade,canvasKey,canvasTargets,isCanvasRetake,planCanvasImport,suggestCanvasMatches,type CanvasAssignment,type CanvasBundle,type CanvasChoice} from "./canvas-import";
import {simpleCanvasDestination} from "./canvas-match-view";

const words=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const label=(s:string)=>words(s).match(/\b(?:assignment|a)\s*(\d+)\b/)?.[1];
const week=(s:string)=>words(s).match(/\bweek\s*(\d+)\b/)?.[1];
const roles=(s:string):string[]=>words(s).match(/\b(?:report|presentation|demo|quiz|exam)\b/g)||[];
const tokens=(s:string)=>new Set(words(s).split(" ").filter(w=>w.length>2&&!/^(the|and|for|due|week|submission|requires|respondus|lockdown|browser)$/.test(w)));
export const canvasDay=(s:string|null)=>s?new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(s)):"";
// Suggest placement only. A matching quiz number never chooses a calculation rule.
export function canvasAttemptTargets(s:Semester,unit:string,a:CanvasAssignment){
  if(!isCanvasRetake(a))return [];
  const number=a.name.match(/\bquiz\s*(\d+)\b/i)?.[1];
  return number?canvasTargets(s,unit).filter(t=>t.title.match(/\bquiz\s*(\d+)\b/i)?.[1]===number):[];
}
// Only an explicit percentage in the item title is evidence. Points possible
// and a category's weight are NOT the assessment's weight.
const percent=(s:string)=>{const all=[...s.matchAll(/\b(\d+(?:\.\d+)?)\s*%/g)].map(m=>Number(m[1]));return all.length===1&&all[0]<=100?all[0]:undefined;};

export function preparedCandidates(s:Semester,unit:string,a:CanvasAssignment){
  const source=tokens(a.name),sourceRole=roles(a.name),sourceLabel=label(a.name),sourceWeek=week(a.name),weight=percent(a.name);
  return canvasTargets(s,unit).flatMap(target=>{
    if(!simpleCanvasDestination(target,s.tasks)||isCanvasRetake(a))return [];
    const targetLabel=label(target.title),targetWeek=week(target.title),targetRole=roles(target.title);
    if(sourceLabel&&targetLabel&&sourceLabel!==targetLabel||sourceWeek&&targetWeek&&sourceWeek!==targetWeek)return [];
    if(sourceRole.length&&targetRole.length&&!sourceRole.some(r=>targetRole.includes(r)))return [];
    const dest=tokens(target.title),overlap=[...dest].filter(w=>source.has(w)).length;
    const exact=words(a.name)===words(target.title),sameLabel=!!sourceLabel&&sourceLabel===targetLabel;
    const similar=overlap>=2&&overlap/Math.min(source.size||1,dest.size||1)>=0.5;
    const sameDate=!!a.dueAt&&canvasDay(a.dueAt)===target.date;
    const sameWeight=weight!==undefined&&weight===percent(target.weight);
    const datedAssignment=sameDate&&!!sourceLabel&&/\bassignment\b/i.test(target.title);
    // Dates may be shared and personally extended; never use date or weight alone.
    if(!exact&&!sameLabel&&!similar&&!datedAssignment&&!(sameDate&&sameWeight))return [];
    const evidence=[exact?"Same title":sameLabel?`Assignment ${sourceLabel}`:similar?"Similar title":datedAssignment?"Both assignments":"",sameDate?"Same due date":"",sameWeight?`Item title and assessment both ${weight}%`:""].filter(Boolean);
    const score=(exact?100:sameLabel?60:similar?35+Math.min(20,overlap*4):datedAssignment?10:0)+(sameDate?18:0)+(sameWeight?15:0);
    return [{target,score,reason:evidence.join(" · ")}];
  }).sort((a,b)=>b.score-a.score||a.target.id.localeCompare(b.target.id));
}

export type PreparedCanvas=ReturnType<typeof prepareCanvasImport>;
// Drafts only. The same pure planner validates JSON and extension proposals;
// nothing is persisted until the single Import action. Saved IDs always win.
export function prepareCanvasImport(s:Semester,b:CanvasBundle){
  const base=suggestCanvasMatches(s,b),choices={...base.choices},reasons={...base.reasons},units={...base.units};
  const issues:Record<string,string>={};
  if(s.canvasAccountId&&s.canvasAccountId!==b.accountId)return {units,choices,reasons,issues};
  const saved=new Map((s.canvasImports||[]).map(r=>[r.key,r]));
  const proposals:{key:string;choice:CanvasChoice;score:number;reason:string}[]=[];
  for(const c of b.courses){
    const codes=[...new Set(c.course.code.toUpperCase().match(/[A-Z]{4}\d{4}/g)||[])];
    if(!units[c.course.id]&&codes.length===1)units[c.course.id]=codes[0];
    const unit=units[c.course.id];
    for(const a of c.assignments){
      const key=`${c.course.id}:${a.id}`,prior=saved.get(canvasKey(b,c.course.id,a.id));
      if(prior)continue; // Never recreate a removed item or redirect a saved link.
      const term=c.course.term.match(/Semester\s*([12])\D+(20\d{2})/i);
      if(term&&(Number(term[2])!==s.year||`S${term[1]}C`!==s.session)){
        delete choices[key];issues[key]="This Canvas course is from another semester. Check the course before connecting.";continue;
      }
      const targets=canvasTargets(s,unit),existing=targets.find(t=>t.id===choices[key]?.targetId);
      if(existing&&!simpleCanvasDestination(existing,s.tasks)){delete choices[key];issues[key]="Individual results need their assessment’s calculation rule.";}
      if(choices[key])continue;
      if(!canvasGrade(a))continue; // No 50-item ungraded onboarding backlog.
      if(!unit){issues[key]="Choose the Semester unit for this shared Canvas course.";continue;}
      if(isCanvasRetake(a)){issues[key]="Result found · not yet included in your total. Confirm which assessment and calculation to use.";continue;}
      const allCandidates=preparedCandidates(s,unit,a);
      const candidates=allCandidates.filter(v=>!s.canvasImports?.some(r=>r.targetId===v.target.id));
      if(allCandidates.length&&!candidates.length){issues[key]="The similar assessment already has another Canvas connection. Review it before creating a duplicate.";continue;}
      if(candidates.length){
        const [first,second]=candidates;
        if(second&&first.score-second.score<12){issues[key]="Two similar assessments — choose which one below.";continue;}
        proposals.push({key,choice:{courseId:c.course.id,assignmentId:a.id,unit,targetId:first.target.id,mode:"overall"},score:first.score,reason:`Suggested · ${first.reason}`});
      }else{
        // A related recurring parent needs a rule, not duplicate weekly tasks.
        const related=targets.find(t=>!simpleCanvasDestination(t,s.tasks)&&[...tokens(t.title)].filter(w=>tokens(a.name).has(w)).length>=2);
        if(related){issues[key]=`Choose how individual results belong to ${related.title}.`;continue;}
        proposals.push({key,choice:{courseId:c.course.id,assignmentId:a.id,unit,targetId:"new",mode:"overall"},score:0,reason:"New assessment · weight stays unknown"});
      }
    }
  }
  // Resolve the entire batch, not greedily by source order. Two equally plausible
  // sources never grab the same overall grade or silently become two duplicates.
  for(const p of proposals){
    if(p.choice.targetId!=="new"){
      const rivals=proposals.filter(q=>q!==p&&q.choice.targetId===p.choice.targetId);
      if(Object.values(choices).some(v=>v.targetId===p.choice.targetId)||rivals.some(q=>q.score>=p.score-12)){
        issues[p.key]="More than one Canvas item could belong here. Choose one or set up individual results.";continue;
      }
    }
    choices[p.key]=p.choice;reasons[p.key]=p.reason;
  }
  // Isolate bad dates/unsupported new units rather than blocking every good row.
  for(const [key,choice] of Object.entries(choices)){
    try{planCanvasImport(s,b,[choice]);}catch(e){delete choices[key];issues[key]=(e as Error).message;}
  }
  return {units,choices,reasons,issues};
}

export function preparedTargetLabel(t:Task){return `${t.title} · ${t.weight||"weight unknown"}`;}
