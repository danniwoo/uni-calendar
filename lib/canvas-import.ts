import {type Semester,type Task,type GradePlan} from "./semester";
import {subjectAssessments} from "./subject-view";
import {validGrade,validGradePlan} from "./grade-value";
import {availabilityError} from "./assessment-schedule";

export const CANVAS_SOURCE="https://canvas.sydney.edu.au";
export type CanvasAssignment={id:string;name:string;groupId:string|null;dueAt:string|null;opensAt:string|null;closesAt:string|null;pointsPossible:number|null;omitted:boolean;submission:null|{released:boolean;excused:boolean;score:number|null;releaseEvidence:string|null;currentAttemptGraded:boolean|null}};
export type CanvasCourse={course:{id:string;name:string;code:string;term:string;weighted:boolean|null};fetchedAt:string;groupsUnavailable:boolean;marksPageUnavailable:boolean;assignments:CanvasAssignment[];groups:{id:string;name:string;weight:number|null;rules:{dropLowest:number|null;dropHighest:number|null;neverDrop:string[]}}[]};
export type CanvasBundle={format:"semester-connect";schemaVersion:1;source:typeof CANVAS_SOURCE;accountId:string;exportedAt:string;courses:CanvasCourse[]};
export type CanvasChoice={courseId:string;assignmentId:string;unit:string;targetId:string;mode:"overall"|"part";method?:"points"|"equal"};
export type CanvasImportRecord={key:string;targetId:string;mode:"overall"|"part"};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
const id=(x:unknown):x is string=>typeof x==="string"&&/^[1-9]\d{0,19}$/.test(x);
const text=(x:unknown,max=400):x is string=>typeof x==="string"&&x.length<=max;
const date=(x:unknown):x is string=>typeof x==="string"&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x));
const finite=(x:unknown)=>x===null||(typeof x==="number"&&Number.isFinite(x)&&x>=0);
const unique=(xs:string[])=>new Set(xs).size===xs.length;
export function validCanvasRecords(x:unknown):x is CanvasImportRecord[]{return Array.isArray(x)&&x.length<=5000&&x.every(r=>object(r)&&text(r.key,150)&&/^\d+:\d+:\d+$/.test(r.key)&&text(r.targetId,500)&&["overall","part"].includes(String(r.mode)))&&unique(x.map(r=>r.key));}
export function validCanvasMetadata(s:{canvasAccountId?:unknown;canvasImports?:unknown}) {
  return (s.canvasAccountId===undefined||id(s.canvasAccountId))&&(s.canvasImports===undefined||(validCanvasRecords(s.canvasImports)&&s.canvasImports.every(r=>id(s.canvasAccountId)&&r.key.startsWith(`${s.canvasAccountId}:`))));
}

export function readCanvasBundle(raw:string):CanvasBundle{
  if(raw.length>1500000)throw new Error("Connect file is too large (maximum 1.5 MB).");
  let b:unknown;try{b=JSON.parse(raw);}catch{throw new Error("Choose a Semester Connect JSON file.");}
  const bad=()=>{throw new Error("Invalid or unsupported Connect file. No data was changed.");};
  if(!object(b)||b.format!=="semester-connect"||b.schemaVersion!==1||b.source!==CANVAS_SOURCE||!id(b.accountId)||!date(b.exportedAt)||!Array.isArray(b.courses)||!b.courses.length||b.courses.length>8)return bad();
  const courses:CanvasCourse[]=b.courses.map(c=>{
    if(!object(c)||!object(c.course)||!id(c.course.id)||!text(c.course.name)||!text(c.course.code,120)||!text(c.course.term,120)||![true,false,null].includes(c.course.weighted as boolean|null)||!date(c.fetchedAt)||!Array.isArray(c.assignments)||c.assignments.length>2500||!Array.isArray(c.groups)||c.groups.length>500)return bad();
    const assignments:CanvasAssignment[]=c.assignments.map(a=>{
      if(!object(a)||!id(a.id)||!text(a.name)||!(a.groupId===null||id(a.groupId))||![a.dueAt,a.opensAt,a.closesAt].every(d=>d===null||date(d))||!finite(a.pointsPossible)||typeof a.omitted!=="boolean")return bad();
      let submission:CanvasAssignment["submission"]=null;
      if(a.submission!==null){const s=a.submission;if(!object(s)||typeof s.released!=="boolean"||typeof s.excused!=="boolean"||!finite(s.score)||![true,false,null].includes(s.currentAttemptGraded as boolean|null)||!(s.releaseEvidence===null||["posted-api","marks-page"].includes(String(s.releaseEvidence))))return bad();
        // Reject hidden numbers rather than trusting a tampered released flag.
        if(s.score!==null&&(!s.released||s.excused||!s.releaseEvidence))return bad();
        submission={released:s.released,excused:s.excused,score:s.score as number|null,releaseEvidence:s.releaseEvidence as string|null,currentAttemptGraded:s.currentAttemptGraded as boolean|null};
      }
      return {id:a.id,name:a.name,groupId:a.groupId as string|null,dueAt:a.dueAt as string|null,opensAt:a.opensAt as string|null,closesAt:a.closesAt as string|null,pointsPossible:a.pointsPossible as number|null,omitted:a.omitted,submission};
    });
    const groups:CanvasCourse["groups"]=c.groups.map(g=>{if(!object(g)||!id(g.id)||!text(g.name)||!finite(g.weight)||!object(g.rules)||![g.rules.dropLowest,g.rules.dropHighest].every(finite)||!Array.isArray(g.rules.neverDrop)||!g.rules.neverDrop.every(id))return bad();return {id:g.id,name:g.name,weight:g.weight as number|null,rules:{dropLowest:g.rules.dropLowest as number|null,dropHighest:g.rules.dropHighest as number|null,neverDrop:g.rules.neverDrop as string[]}};});
    if(!unique(assignments.map(a=>a.id))||!unique(groups.map(g=>g.id)))return bad();
    return {course:{id:c.course.id,name:c.course.name,code:c.course.code,term:c.course.term,weighted:c.course.weighted as boolean|null},fetchedAt:c.fetchedAt,groupsUnavailable:c.groupsUnavailable===true,marksPageUnavailable:c.marksPageUnavailable===true,assignments,groups};
  });
  if(!unique(courses.map(c=>c.course.id))||courses.reduce((n,c)=>n+c.assignments.length,0)>2500)return bad();
  return {format:"semester-connect",schemaVersion:1,source:CANVAS_SOURCE,accountId:b.accountId,exportedAt:b.exportedAt,courses};
}
export const canvasKey=(b:CanvasBundle,c:string,a:string)=>`${b.accountId}:${c}:${a}`;
export function canvasGrade(a:CanvasAssignment){const s=a.submission,g={earned:s?.score,possible:a.pointsPossible};return s?.released&&!s.excused&&s.currentAttemptGraded!==false&&!a.omitted&&validGrade(g)?g:null;}
export function canvasTargets(s:Semester,unit:string){return subjectAssessments(s,unit).filter(t=>t.kind!=="task"&&t.kind!=="event");}
function localDate(value:string|null){if(!value)return {};const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value));const v=(key:string)=>p.find(p=>p.type===key)?.value;return {date:`${v("year")}-${v("month")}-${v("day")}`,time:`${v("hour")}:${v("minute")}`};}

// Additive only. Existing scalar fields, grade values, completion and manual
// grade-plan items are never overwritten. Review computes the exact same result
// as confirmation, against the current board (not a stale preview snapshot).
export function planCanvasImport(s:Semester,b:CanvasBundle,choices:CanvasChoice[]){
  const next=structuredClone(s),actions:{key:string;text:string;changed:boolean}[]=[];
  if(s.canvasAccountId&&s.canvasAccountId!==b.accountId)throw new Error("This board is linked to a different Canvas account. Import stopped; use the correct account.");
  if(!unique(choices.map(c=>`${c.courseId}:${c.assignmentId}`)))throw new Error("An assignment was selected twice.");
  const records=new Map((s.canvasImports||[]).map(r=>[r.key,r]));
  const usedOverall=new Set<string>();
  const partConfigs=new Map<string,string>();
  function put(t:Task){const i=next.tasks.findIndex(x=>x.id===t.id);if(i>=0)next.tasks[i]=t;else next.tasks.push(t);}
  for(const choice of choices){
    const c=b.courses.find(c=>c.course.id===choice.courseId),a=c?.assignments.find(a=>a.id===choice.assignmentId);
    if(!c||!a||!next.units.some(u=>u.code===choice.unit)||!["overall","part"].includes(choice.mode))throw new Error("Course or assessment mapping changed. Review again.");
    const key=canvasKey(b,c.course.id,a.id),prior=records.get(key),grade=canvasGrade(a);
    const newId=`canvas-${b.accountId}-${c.course.id}-${a.id}`;
    const targetId=choice.targetId==="new"?newId:choice.targetId;
    if(prior&&(prior.targetId!==targetId||prior.mode!==choice.mode))throw new Error("This Canvas item is already linked elsewhere. Existing mapping was preserved.");
    if(choice.targetId==="new"){
      if(choice.mode!=="overall")throw new Error("Choose an existing assessment for individual parts.");
      if(next.tasks.some(t=>t.id===newId)){actions.push({key,text:`${a.name}: already added; preserved`,changed:false});continue;}
      if(prior){actions.push({key,text:`${a.name}: previously imported then removed; not recreated`,changed:false});continue;}
      const due=localDate(a.dueAt),from=localDate(a.opensAt),until=localDate(a.closesAt);
      if(due.date&&!s.weeks.some(w=>due.date!>=w.start&&due.date!<=w.end))throw new Error(`${a.name}: due date is outside this board’s semester. Skip or map only its grade to an existing assessment.`);
      const task:Task={id:newId,unit:choice.unit,title:a.name||"Canvas assignment",weight:"",kind:"assessment",timing:"Deadline",description:"",source:`${CANVAS_SOURCE}/courses/${c.course.id}/assignments/${a.id}`,sourceText:"Imported from Semester Connect",hurdle:false,group:false,manual:true,...due,week:s.weeks.find(w=>due.date&&due.date>=w.start&&due.date<=w.end)?.number,availableFrom:from.date,availableFromTime:from.time,availableUntil:until.date,availableUntilTime:until.time,warning:"Canvas source item: confirm its assessment weight. Group weight is not an individual assignment weight.",...(grade?{grade}:{})};
      if(availabilityError(task))throw new Error(`${a.name}: Canvas availability dates need review. Skip or map its grade to an existing assessment.`);
      put(task);records.set(key,{key,targetId:newId,mode:"overall"});actions.push({key,text:`Add ${a.name}${grade?` · ${grade.earned}/${grade.possible}`:" · no released numeric grade"} · weight needs review`,changed:true});continue;
    }
    const t=canvasTargets(next,choice.unit).find(t=>t.id===targetId);if(!t)throw new Error("Choose an existing assessment in the selected unit.");
    if(choice.mode==="overall"){
      if(usedOverall.has(t.id)||partConfigs.has(t.id))throw new Error("Several Canvas items target one overall grade. Use individual parts instead.");usedOverall.add(t.id);
      if(t.grade!==undefined||t.gradePlan!==undefined||prior){actions.push({key,text:`${t.title}: ${t.grade?`${t.grade.earned}/${t.grade.possible}`:t.grade===null?"manually cleared grade":"existing grade setup"} kept; Canvas ${grade?`${grade.earned}/${grade.possible}`:"unavailable"} not applied`,changed:false});continue;}
      if(!grade){actions.push({key,text:`${a.name}: no current released numeric grade to import`,changed:false});continue;}
      put({...t,grade});records.set(key,{key,targetId:t.id,mode:"overall"});actions.push({key,text:`${t.title}: blank grade → ${grade.earned}/${grade.possible}; all details kept`,changed:true});
    }else{
      if(!["points","equal"].includes(choice.method||""))throw new Error("Confirm how these individual results are combined (points or equal weighting).");
      const config=`${c.course.id}:${a.groupId}:${choice.method}`;
      if(usedOverall.has(t.id)||(partConfigs.has(t.id)&&partConfigs.get(t.id)!==config))throw new Error("Use one Canvas group and one calculation method per assessment.");partConfigs.set(t.id,config);
      const group=c.groups.find(g=>g.id===a.groupId);
      if(!group||c.groupsUnavailable||group.rules.dropLowest||group.rules.dropHighest||group.rules.neverDrop.length)throw new Error("This group has unknown or drop rules. Import individual items separately; do not assume a simple average.");
      if(t.grade!==undefined){actions.push({key,text:`${t.title}: existing overall grade kept`,changed:false});continue;}
      const itemId=`canvas:${key}`,item=t.gradePlan?.items.find(i=>i.id===itemId);
      const owned=(next.canvasImports||[]).some(r=>r.targetId===t.id&&r.mode==="part")||[...records.values()].some(r=>r.targetId===t.id&&r.mode==="part");
      if(t.gradePlan!==undefined&&(!t.gradePlan||t.gradePlan.mode!=="parts"||t.gradePlan.method!==choice.method||!owned)){
        actions.push({key,text:`${t.title}: existing individual-grade setup kept`,changed:false});continue;
      }
      if(item?.grade!==undefined||item?.excluded||prior&&!item){actions.push({key,text:`${a.name}: existing / removed part preserved`,changed:false});continue;}
      if(item?.maximum!==undefined&&grade&&item.maximum!==grade.possible){actions.push({key,text:`${a.name}: existing maximum ${item.maximum} differs from Canvas ${grade.possible}; review manually`,changed:false});continue;}
      if(item&&!grade){actions.push({key,text:`${a.name}: still ungraded; no change`,changed:false});continue;}
      const entry={id:itemId,name:a.name||"Canvas item",...(a.pointsPossible&&a.pointsPossible>0?{maximum:a.pointsPossible}:{}),...(grade?{grade}:{}),...(a.omitted||a.submission?.excused?{excluded:true}:{})};
      const plan:GradePlan=t.gradePlan?{...t.gradePlan,canvasPendingReview:true,items:item?t.gradePlan.items.map(i=>i.id===itemId?{...i,grade:grade!}:i):[...t.gradePlan.items,entry]}:{mode:"parts",method:choice.method!,canvasPendingReview:true,items:[entry]};
      if(!validGradePlan(plan))throw new Error("Individual grade plan is too large or invalid. Nothing imported.");
      put({...t,gradePlan:plan});records.set(key,{key,targetId:t.id,mode:"part"});actions.push({key,text:`${t.title} → ${a.name}: ${grade?`${grade.earned}/${grade.possible}`:"ungraded / excluded part"}; dates and weight kept`,changed:true});
    }
  }
  next.canvasImports=[...records.values()];
  const changed=actions.filter(a=>a.changed).length;
  if(changed)next.canvasAccountId=b.accountId;
  if(next.tasks.length>2500||!validCanvasRecords(next.canvasImports))throw new Error("Import exceeds this board’s record limit.");
  const unitByKey=new Map(choices.map(c=>[canvasKey(b,c.courseId,c.assignmentId),c.unit]));
  return {semester:next,actions:actions.map(a=>({...a,text:`${unitByKey.get(a.key)} · ${a.text}`})),changed};
}
