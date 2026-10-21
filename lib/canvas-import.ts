import {type Semester,type Task,type GradePlan,type CanvasRule} from "./semester";
import {applyCanvasRules,validCanvasRule,validRuleRecord} from "./canvas-rule-import";
import {subjectAssessments} from "./subject-view";
import {validGrade,validGradePlan} from "./grade-value";
import {availabilityError} from "./assessment-schedule";

export const CANVAS_SOURCE="https://canvas.sydney.edu.au";
export type CanvasAssignment={id:string;name:string;groupId:string|null;dueAt:string|null;opensAt:string|null;closesAt:string|null;pointsPossible:number|null;omitted:boolean;result?:"complete"|"incomplete";submission:null|{released:boolean;excused:boolean;score:number|null;releaseEvidence:string|null;currentAttemptGraded:boolean|null}};
export type CanvasCourse={course:{id:string;name:string;code:string;term:string;weighted:boolean|null};fetchedAt:string;groupsUnavailable:boolean;marksPageUnavailable:boolean;assignments:CanvasAssignment[];groups:{id:string;name:string;weight:number|null;rules:{dropLowest:number|null;dropHighest:number|null;neverDrop:string[]}}[]};
export type CanvasBundle={format:"semester-connect";schemaVersion:1;source:typeof CANVAS_SOURCE;accountId:string;exportedAt:string;courses:CanvasCourse[]};
export type CanvasChoice={courseId:string;assignmentId:string;unit:string;targetId:string;mode:"overall"|"part";method?:"points"|"equal";rule?:CanvasRule;outcome?:"missed"|"not_taken"};
export type CanvasImportRecord=NonNullable<Semester["canvasImports"]>[number];
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
const id=(x:unknown):x is string=>typeof x==="string"&&/^[1-9]\d{0,19}$/.test(x);
const text=(x:unknown,max=400):x is string=>typeof x==="string"&&x.length<=max;
const date=(x:unknown):x is string=>typeof x==="string"&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x));
const finite=(x:unknown)=>x===null||(typeof x==="number"&&Number.isFinite(x)&&x>=0);
const unique=(xs:string[])=>new Set(xs).size===xs.length;
export function validCanvasRecords(x:unknown):x is CanvasImportRecord[]{return Array.isArray(x)&&x.length<=5000&&x.every(r=>object(r)&&text(r.key,150)&&/^\d+:\d+:\d+$/.test(r.key)&&text(r.targetId,500)&&["overall","part"].includes(String(r.mode))&&(r.lastGrade===undefined||validGrade(r.lastGrade))&&(r.readAt===undefined||date(r.readAt))&&(r.manual===undefined||typeof r.manual==="boolean")&&validRuleRecord(r))&&unique(x.map(r=>r.key));}
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
      const rawGrade=object(a.submission)&&typeof a.submission.grade==="string"?a.submission.grade.toLowerCase():"";
      const result=a.gradingType==="pass_fail"&&submission?.released&&!submission.excused&&submission.releaseEvidence&&["complete","incomplete"].includes(rawGrade)?rawGrade as "complete"|"incomplete":undefined;
      return {id:a.id,name:a.name,groupId:a.groupId as string|null,dueAt:a.dueAt as string|null,opensAt:a.opensAt as string|null,closesAt:a.closesAt as string|null,pointsPossible:a.pointsPossible as number|null,omitted:a.omitted,...(result?{result}:{}),submission};
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
// A warning, not an inferred grading rule. Unknown naming patterns still need
// human review; never infer "highest", "latest" or an average for retakes.
export function isCanvasRetake(a:CanvasAssignment){
  return /\b(?:retake|re[\s-]?attempt|attempt\s*(?:#|no\.?\s*)?\s*\d+)\b/i.test(a.name);
}
export function canvasGroupBlock(c:CanvasCourse,groupId:string){
  const g=c.groups.find(g=>g.id===groupId);
  if(!g||c.groupsUnavailable)return "Group rules unavailable. Review items individually.";
  if(c.assignments.some(a=>a.groupId===groupId&&isCanvasRetake(a)))return "Retake attempts found. Do not average this group. Check the unit rules and choose the applicable result for each assessment.";
  if(g.rules.dropLowest||g.rules.dropHighest||g.rules.neverDrop.length)return "This group has drop rules. Review the unit rules; simple points/equal averaging is not supported here.";
  return "";
}
export function canvasResultLabel(a:CanvasAssignment){
  const g=canvasGrade(a);
  return g?`${g.earned} / ${g.possible}`:a.submission?.excused?"Excused":a.omitted?"Excluded":a.submission?.currentAttemptGraded===false?"Earlier attempt — review":a.result==="complete"?"Complete · text only":a.result==="incomplete"?"Incomplete · text only":"No released numeric grade";
}
// Optional candidates only: selecting one is always a user action. Do not use
// these heuristics in suggestCanvasMatches or save a fuzzy match automatically.
export function canvasCandidates(s:Semester,unit:string,a:CanvasAssignment){
  const normalize=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const label=(v:string)=>normalize(v).match(/\b(?:a|assignment)\s*(\d+)\b/)?.[1];
  const tokens=(v:string)=>new Set(normalize(v).split(" ").filter(w=>w.length>2&&!["the","and","for","due","week","requires","respondus","lockdown","browser","submission"].includes(w)));
  const sourceTokens=tokens(a.name),sourceLabel=label(a.name);
  return canvasTargets(s,unit).map(t=>{
    const sameLabel=!!sourceLabel&&sourceLabel===label(t.title);
    const overlap=[...tokens(t.title)].filter(w=>sourceTokens.has(w)).length;
    const exact=normalize(t.title)===normalize(a.name);
    return {target:t,score:exact?100:sameLabel?50:overlap>=2?overlap:0,reason:exact?"Matching title · review":sameLabel?`Same assignment label A${sourceLabel} · check the full title`:"Similar words · check before selecting"};
  }).filter(c=>c.score>0).sort((a,b)=>b.score-a.score||a.target.title.localeCompare(b.target.title)).slice(0,3);
}

// Suggestions never save data. Reuse confirmed IDs first; only unique, exact
// names or assignment URLs are suggested. Similar titles remain a manual choice.
export function suggestCanvasMatches(s:Semester,b:CanvasBundle){
  const units:Record<string,string>={},choices:Record<string,CanvasChoice>={},reasons:Record<string,string>={};
  if(s.canvasAccountId&&s.canvasAccountId!==b.accountId)return {units,choices,reasons};
  const normalize=(value:string)=>value.toLocaleLowerCase().trim().replace(/\s+/g," ");
  for(const c of b.courses){
    const codes:string[]=c.course.code.toUpperCase().match(/[A-Z]{4}\d{4}/g)||[];
    const matched=s.units.filter(u=>codes.includes(u.code));
    const remembered=(s.canvasImports||[]).filter(r=>r.key.startsWith(`${b.accountId}:${c.course.id}:`));
    const rememberedUnits=s.units.filter(u=>canvasTargets(s,u.code).some(t=>remembered.some(r=>r.targetId===t.id)));
    const unit=rememberedUnits.length===1?rememberedUnits[0].code:matched.length===1?matched[0].code:"";
    units[c.course.id]=unit;if(!unit)continue;
    const targets=canvasTargets(s,unit);
    for(const a of c.assignments){
      const key=`${c.course.id}:${a.id}`,prior=remembered.find(r=>r.key===canvasKey(b,c.course.id,a.id)),target=targets.find(t=>t.id===prior?.targetId);
      if(prior){
        if(target){if(prior.rule){choices[key]={courseId:c.course.id,assignmentId:a.id,unit,targetId:target.id,mode:"part",rule:prior.rule};reasons[key]="Saved rule mapping · review";continue;}const method=target.gradePlan?.method;if(prior.mode==="part"&&method!=="points"&&method!=="equal")continue;
          choices[key]={courseId:c.course.id,assignmentId:a.id,unit,targetId:target.id,mode:prior.mode,...(prior.mode==="part"?{method:method as "points"|"equal"}:{})};reasons[key]="Saved mapping";
        }continue;
      }
      const available=targets.filter(t=>!t.gradePlan&&!s.canvasImports?.some(r=>r.targetId===t.id));
      if(isCanvasRetake(a))continue;
      const source=available.filter(t=>t.source===`${CANVAS_SOURCE}/courses/${c.course.id}/assignments/${a.id}`);
      const exact=available.filter(t=>normalize(t.title)===normalize(a.name));
      const found=source.length===1?source:exact.length===1?exact:[];
      if(found.length===1){choices[key]={courseId:c.course.id,assignmentId:a.id,unit,targetId:found[0].id,mode:"overall"};reasons[key]=source.length===1?"Same Canvas assignment link · review":"Exact title match · review";}
    }
  }
  // Ambiguous many-to-one guesses must not silently become an overall grade.
  const candidates=Object.values(choices);
  for(const [key,choice] of Object.entries(choices))if(!choice.rule&&reasons[key]!=="Saved mapping"&&candidates.filter(v=>v.targetId===choice.targetId).length>1){delete choices[key];delete reasons[key];}
  return {units,choices,reasons};
}
function localDate(value:string|null){if(!value)return {};const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value));const v=(key:string)=>p.find(p=>p.type===key)?.value;return {date:`${v("year")}-${v("month")}-${v("day")}`,time:`${v("hour")}:${v("minute")}`};}

// Only source-owned, unchanged grades may update. Manual values and all other
// assessment fields stay untouched. Review computes the exact same result
// as confirmation, against the current board (not a stale preview snapshot).
export function planCanvasImport(s:Semester,b:CanvasBundle,choices:CanvasChoice[]){
  const next=structuredClone(s),actions:{key:string;text:string;changed:boolean}[]=[];
  if(s.canvasAccountId&&s.canvasAccountId!==b.accountId)throw new Error("This board is linked to a different Canvas account. Import stopped; use the correct account.");
  if(!unique(choices.map(c=>`${c.courseId}:${c.assignmentId}`)))throw new Error("An assignment was selected twice.");
  const records=new Map((s.canvasImports||[]).map(r=>[r.key,r]));
  const ruleChoices=choices.filter(c=>c.rule);
  if(ruleChoices.some(c=>!validCanvasRule(c.rule)||c.mode!=="part"||c.targetId==="new"))throw new Error("Choose an existing assessment and valid grading rule.");
  if(ruleChoices.some(c=>choices.some(v=>v.targetId===c.targetId&&!v.rule)))throw new Error("Do not mix overall, ordinary parts and rule imports for one assessment.");
  applyCanvasRules(next,b,ruleChoices,records,actions);
  const usedOverall=new Set<string>();
  const partConfigs=new Map<string,string>();
  function put(t:Task){const i=next.tasks.findIndex(x=>x.id===t.id);if(i>=0)next.tasks[i]=t;else next.tasks.push(t);}
  for(const choice of choices){
    if(choice.rule)continue;
    const c=b.courses.find(c=>c.course.id===choice.courseId),a=c?.assignments.find(a=>a.id===choice.assignmentId);
    if(!c||!a||!next.units.some(u=>u.code===choice.unit)||!["overall","part"].includes(choice.mode))throw new Error("Course or assessment mapping changed. Review again.");
    const key=canvasKey(b,c.course.id,a.id),prior=records.get(key),grade=canvasGrade(a);
    const newId=`canvas-${b.accountId}-${c.course.id}-${a.id}`;
    const targetId=choice.targetId==="new"?newId:choice.targetId;
    const record=(value=grade)=>records.set(key,{key,targetId,mode:choice.mode,readAt:c.fetchedAt,...(value?{lastGrade:value}:{})});
    const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
    const ownedGrade=(value:unknown)=>!!prior?.readAt&&!prior.manual&&same(value,prior.lastGrade);
    const stale=!!prior?.readAt&&Date.parse(c.fetchedAt)<Date.parse(prior.readAt);
    const keep=(message:string)=>{const linked=!prior;if(linked)records.set(key,{key,targetId,mode:choice.mode,readAt:c.fetchedAt,...(choice.mode==="overall"?{manual:true}:{})});actions.push({key,text:`${message}${linked?" · mapping saved for next time":""}`,changed:linked});};
    if(prior&&(prior.targetId!==targetId||prior.mode!==choice.mode))throw new Error("This Canvas item is already linked elsewhere. Existing mapping was preserved.");
    if(choice.targetId==="new"){
      if(choice.mode!=="overall")throw new Error("Choose an existing assessment for individual parts.");
      if(prior&&!next.tasks.some(t=>t.id===newId)){actions.push({key,text:`${a.name}: previously imported then removed; not recreated`,changed:false});continue;}
      if(!next.tasks.some(t=>t.id===newId)){
      const due=localDate(a.dueAt),from=localDate(a.opensAt),until=localDate(a.closesAt);
      if(due.date&&!s.weeks.some(w=>due.date!>=w.start&&due.date!<=w.end))throw new Error(`${a.name}: due date is outside this board’s semester. Skip or map only its grade to an existing assessment.`);
      const task:Task={id:newId,unit:choice.unit,title:a.name||"Canvas assignment",weight:"",kind:"assessment",timing:"Deadline",description:"",source:`${CANVAS_SOURCE}/courses/${c.course.id}/assignments/${a.id}`,sourceText:"Imported from Semester Connect",hurdle:false,group:false,manual:true,...due,week:s.weeks.find(w=>due.date&&due.date>=w.start&&due.date<=w.end)?.number,availableFrom:from.date,availableFromTime:from.time,availableUntil:until.date,availableUntilTime:until.time,warning:"Canvas source item: confirm its assessment weight. Group weight is not an individual assignment weight.",...(grade?{grade}:{})};
      if(availabilityError(task))throw new Error(`${a.name}: Canvas availability dates need review. Skip or map its grade to an existing assessment.`);
      put(task);record();actions.push({key,text:`Add ${a.name}${grade?` · ${grade.earned}/${grade.possible}`:" · no released numeric grade"} · weight needs review`,changed:true});continue;
      }
    }
    const t=canvasTargets(next,choice.unit).find(t=>t.id===targetId);if(!t)throw new Error("Choose an existing assessment in the selected unit.");
    if([...records.values()].some(r=>r.targetId===t.id&&r.key!==key&&(choice.mode==="overall"||r.mode==="overall")))throw new Error("Several Canvas items target one overall grade. Choose one applicable result. Only independent components—not retakes—belong in individual parts.");
    if(choice.mode==="overall"){
      if(usedOverall.has(t.id)||partConfigs.has(t.id))throw new Error("Several Canvas items target one overall grade. Choose one applicable result. Only independent components—not retakes—belong in individual parts.");usedOverall.add(t.id);
      if(t.gradePlan!==undefined||(prior?!ownedGrade(t.grade):t.grade!==undefined)){keep(`${t.title}: manual / existing grade kept (${t.grade?`${t.grade.earned}/${t.grade.possible}`:"blank or individual grades"}); Canvas ${grade?`${grade.earned}/${grade.possible}`:"unavailable"} not applied`);continue;}
      if(stale){keep(`${a.name}: older Canvas read ignored`);continue;}
      if(!grade){if(!prior){record();actions.push({key,text:`${a.name}: link saved; waiting for a released grade`,changed:true});}else keep(`${a.name}: no released grade; existing value kept`);continue;}
      if(same(t.grade,grade)){keep(`${t.title}: ${grade.earned}/${grade.possible} unchanged`);continue;}
      put({...t,grade});record();actions.push({key,text:`${a.name} → ${t.title}: ${t.grade?`${t.grade.earned}/${t.grade.possible}`:"blank grade"} → ${grade.earned}/${grade.possible}; all details kept`,changed:true});
    }else{
      if(!["points","equal"].includes(choice.method||""))throw new Error("Confirm how these individual results are combined (points or equal weighting).");
      const config=`${c.course.id}:${a.groupId}:${choice.method}`;
      if(usedOverall.has(t.id)||(partConfigs.has(t.id)&&partConfigs.get(t.id)!==config))throw new Error("Use one Canvas group and one calculation method per assessment.");partConfigs.set(t.id,config);
      const blocked=canvasGroupBlock(c,a.groupId||"");
      if(blocked)throw new Error(blocked);
      if(t.grade!==undefined){actions.push({key,text:`${t.title}: existing overall grade kept`,changed:false});continue;}
      const itemId=`canvas:${key}`,item=t.gradePlan?.items.find(i=>i.id===itemId);
      const owned=(next.canvasImports||[]).some(r=>r.targetId===t.id&&r.mode==="part")||[...records.values()].some(r=>r.targetId===t.id&&r.mode==="part");
      if(t.gradePlan!==undefined&&(!t.gradePlan||t.gradePlan.mode!=="parts"||t.gradePlan.method!==choice.method||!owned)){
        actions.push({key,text:`${t.title}: existing individual-grade setup kept`,changed:false});continue;
      }
      if(item?.excluded||prior&&!item||item?.grade!==undefined&&!ownedGrade(item.grade)||prior?.manual){actions.push({key,text:`${a.name}: manual / removed part preserved`,changed:false});continue;}
      if(stale){keep(`${a.name}: older Canvas read ignored`);continue;}
      if(item?.maximum!==undefined&&grade&&item.maximum!==grade.possible){actions.push({key,text:`${a.name}: existing maximum ${item.maximum} differs from Canvas ${grade.possible}; review manually`,changed:false});continue;}
      if(item&&!grade){actions.push({key,text:`${a.name}: still ungraded; no change`,changed:false});continue;}
      if(item&&same(item.grade,grade)){keep(`${a.name}: grade unchanged`);continue;}
      const entry={id:itemId,name:(a.name||"Canvas item").slice(0,300),...(a.pointsPossible&&a.pointsPossible>0?{maximum:a.pointsPossible}:{}),...(grade?{grade}:{}),...(a.omitted||a.submission?.excused?{excluded:true}:{})};
      const plan:GradePlan=t.gradePlan?{...t.gradePlan,canvasPendingReview:true,items:item?t.gradePlan.items.map(i=>i.id===itemId?{...i,grade:grade!}:i):[...t.gradePlan.items,entry]}:{mode:"parts",method:choice.method!,canvasPendingReview:true,items:[entry]};
      if(!validGradePlan(plan))throw new Error("Individual grade plan is too large or invalid. Nothing imported.");
      put({...t,gradePlan:plan});record();actions.push({key,text:`${t.title} → ${a.name}: ${item?.grade?`${item.grade.earned}/${item.grade.possible} → `:""}${grade?`${grade.earned}/${grade.possible}`:"ungraded / excluded part"}; dates and weight kept`,changed:true});
    }
  }
  next.canvasImports=[...records.values()];
  const changed=actions.filter(a=>a.changed).length;
  if(changed)next.canvasAccountId=b.accountId;
  if(next.tasks.length>2500||!validCanvasRecords(next.canvasImports))throw new Error("Import exceeds this board’s record limit.");
  const unitByKey=new Map(choices.map(c=>[canvasKey(b,c.courseId,c.assignmentId),c.unit]));
  return {semester:next,actions:actions.map(a=>({...a,text:unitByKey.has(a.key)?`${unitByKey.get(a.key)} · ${a.text}`:a.text})),changed};
}
