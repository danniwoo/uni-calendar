import type {Semester} from "./semester";
import {planCanvasImport,type CanvasBundle,type CanvasChoice} from "./canvas-import";

export type CanvasHistoryEntry={key:string;text:string;kind:"grade"|"mapping"|"added"|"protected"|"attention";changed:boolean;targetId?:string;seen?:boolean};
export type CanvasUpdateBatch={id:string;accountId:string;confirmedAt:string;exportedAt:string;changed:number;skipped:number;omitted:number;entries:CanvasHistoryEntry[]};
const kinds=["grade","mapping","added","protected","attention"];
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
const date=(x:unknown)=>typeof x==="string"&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x));
const count=(x:unknown)=>Number.isInteger(x)&&Number(x)>=0&&Number(x)<=2500;
export function validCanvasHistory(value:unknown,accountId:unknown){
  if(value===undefined)return true;
  return Array.isArray(value)&&value.length<=20&&JSON.stringify(value).length<=300000&&new Set(value.map(b=>b?.id)).size===value.length&&value.every(b=>object(b)&&typeof b.id==="string"&&/^[a-zA-Z0-9-]{1,80}$/.test(b.id)&&b.accountId===accountId&&typeof accountId==="string"&&/^[1-9]\d{0,19}$/.test(accountId)&&date(b.confirmedAt)&&date(b.exportedAt)&&count(b.changed)&&Number(b.changed)>0&&count(b.skipped)&&count(b.omitted)&&Array.isArray(b.entries)&&b.entries.length<=250&&new Set(b.entries.map((e:CanvasHistoryEntry)=>e.key)).size===b.entries.length&&b.entries.every(e=>object(e)&&typeof e.key==="string"&&e.key.startsWith(`${accountId}:`)&&/^\d+:\d+:\d+$/.test(e.key)&&typeof e.text==="string"&&e.text.length<=1500&&kinds.includes(String(e.kind))&&typeof e.changed==="boolean"&&(e.targetId===undefined||typeof e.targetId==="string"&&e.targetId.length<=500)&&(e.seen===undefined||typeof e.seen==="boolean")));
}

// Called only by explicit confirmation, never by the pure preview planner.
// Receipts and grades are one board write; a failed save remains visibly unsaved.
export function confirmCanvasImport(s:Semester,b:CanvasBundle,choices:CanvasChoice[],id:string,now=new Date().toISOString()){
  const result=planCanvasImport(s,b,choices);
  if(!result.changed)return result;
  const relevant=result.actions.filter(a=>a.changed||a.kind==="protected"||a.kind==="attention").sort((a,b)=>Number(b.kind==="grade")-Number(a.kind==="grade"));
  const entries:CanvasHistoryEntry[]=relevant.slice(0,250).map(a=>({key:a.key,text:a.text.slice(0,1500),kind:(a.kind||"mapping") as CanvasHistoryEntry["kind"],changed:a.changed,targetId:result.semester.canvasImports?.find(r=>r.key===a.key)?.targetId}));
  const batch:CanvasUpdateBatch={id,accountId:b.accountId,confirmedAt:now,exportedAt:b.exportedAt,changed:result.changed,skipped:b.courses.reduce((n,c)=>n+c.assignments.length,0)-choices.length,omitted:relevant.length-entries.length,entries};
  const history=[batch,...(s.canvasHistory||[])].slice(0,20);
  while(history.length>1&&JSON.stringify(history).length>300000)history.pop();
  while(batch.entries.length&&JSON.stringify(history).length>300000){batch.entries.pop();batch.omitted++;}
  if(!validCanvasHistory(history,b.accountId))throw new Error("Update record could not be created. Nothing imported.");
  return {...result,semester:{...result.semester,canvasHistory:history}};
}
export function unreadCanvasGrades(s:Semester,targetId?:string){
  const present=new Set([...s.tasks,...s.units.flatMap(u=>u.assessments)].map(t=>t.id));
  return new Set((s.canvasHistory||[]).flatMap(b=>b.entries.filter(e=>e.kind==="grade"&&e.changed&&!e.seen&&e.targetId&&present.has(e.targetId)&&(!targetId||e.targetId===targetId)).map(e=>e.targetId!)));
}
export function markCanvasGradeSeen(s:Semester,targetId:string):Semester{
  if(!unreadCanvasGrades(s,targetId).size)return s;
  return {...s,canvasHistory:s.canvasHistory?.map(b=>({...b,entries:b.entries.map(e=>e.targetId===targetId&&e.kind==="grade"&&e.changed?{...e,seen:true}:e)}))};
}
