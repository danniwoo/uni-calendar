import { readBackup } from "../lib/backup.ts";
import { parsePlanSnapshot, type PlanSnapshot } from "../lib/today-plan.ts";
import type { Semester } from "../lib/semester.ts";

export const recoveryFormat = "semester-staging-recovery";
export const maxRecoveryBytes = 8_000_000;
type Snapshot = {originalJson:string; sha256:string; importedAt:string};
export type Completion = {taskId:string; done:0|1; revision:number};
export type Recovery = {format:typeof recoveryFormat; version:1; owner:string; snapshot:Snapshot; todayPlan:PlanSnapshot|null; completion:Completion[]};
export type Current = {version:number; backup:Recovery|null};
const object = (v:unknown): v is Record<string,unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

async function digest(text:string) {
  const bytes = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
}

function readSemester(text:string) {
  const semester = readBackup(text);
  if (JSON.parse(text).feedUrl !== "") throw new Error("Export the semester with its private timetable feed removed.");
  return semester;
}

function checkLinks(board:Semester, plan:PlanSnapshot|null, changes:Completion[]) {
  const ids = new Set(board.tasks.map(t=>t.id));
  const sources = new Set(board.tasks.map(t=>JSON.stringify([board.year,board.session,t.id])));
  if (changes.some(row=>!ids.has(row.taskId))) throw new Error("A completion refers to an item missing from this semester. Your saved data has been kept.");
  if (plan?.tasks.some(task=>task.sourceKey && !sources.has(task.sourceKey))) throw new Error("A Today task links to an item missing from this semester. Your saved data has been kept.");
}

function readCompletion(value:unknown):Completion[] {
  if (!Array.isArray(value) || value.length>2500) throw new Error("Invalid completion list.");
  const ids=new Set<string>();
  return value.map(row=>{
    if (!object(row) || typeof row.taskId!=="string" || !row.taskId || ids.has(row.taskId)
      || (row.done!==0 && row.done!==1) || !Number.isSafeInteger(row.revision) || Number(row.revision)<1)
      throw new Error("Invalid or duplicate completion record.");
    ids.add(row.taskId);
    return {taskId:row.taskId,done:row.done,revision:Number(row.revision)};
  });
}

export async function prepareRecovery(file:string, owner:string, current:Recovery|null) {
  if (typeof file!=="string" || new TextEncoder().encode(file).length>maxRecoveryBytes) throw new Error("Choose a JSON backup under 8 MB.");
  let input:unknown;
  try {input=JSON.parse(file);} catch {throw new Error("Choose a valid JSON backup.");}
  if (!object(input)) throw new Error("Choose a saved semester or full Semester backup.");
  const full=input.format===recoveryFormat || input.format==="semester-staging-recovery-drill";
  let snapshot:Snapshot, todayPlan:PlanSnapshot|null, completion:Completion[], board:Semester;
  if (full) {
    if (input.version!==1 || !object(input.snapshot) || typeof input.snapshot.originalJson!=="string"
      || typeof input.snapshot.importedAt!=="string" || !Number.isFinite(Date.parse(input.snapshot.importedAt))) throw new Error("Invalid or unsupported full backup.");
    if (input.owner!==owner) throw new Error("This backup belongs to a different staging account.");
    const text=input.snapshot.originalJson;
    board=readSemester(text);
    const sha256=await digest(text);
    if (input.snapshot.sha256!==sha256) throw new Error("The semester checksum differs from the backup.");
    snapshot={originalJson:text,sha256,importedAt:input.snapshot.importedAt};
    todayPlan=input.todayPlan===null ? null : parsePlanSnapshot(input.todayPlan);
    if (todayPlan && todayPlan.revision<1) throw new Error("Invalid saved Today revision.");
    completion=readCompletion(input.completion);
  } else {
    if (input.format!==undefined) throw new Error("Choose a saved-semester JSON or full Semester backup.");
    board=readSemester(file);
    const previous=current && readBackup(current.snapshot.originalJson);
    if (previous && (previous.year!==board.year || previous.session!==board.session)) throw new Error("Choose a website export for the same semester to keep its linked progress.");
    const sha256=await digest(file);
    snapshot={originalJson:file,sha256,importedAt:current?.snapshot.sha256===sha256 ? current.snapshot.importedAt : new Date().toISOString()};
    todayPlan=current?.todayPlan ?? null;
    completion=current?.completion ?? [];
  }
  checkLinks(board,todayPlan,completion);
  const backup:Recovery={format:recoveryFormat,version:1,owner,snapshot,todayPlan,completion};
  return {full,backup,board};
}

export function recoveryCounts(backup:Recovery|null) {
  if (!backup) return {units:0,work:0,undated:0,grades:0,attempts:0,today:0,todayDone:0,workDone:0,overrides:0};
  const board=readBackup(backup.snapshot.originalJson);
  const changes=new Map(backup.completion.map(row=>[row.taskId,Boolean(row.done)]));
  const tasks=backup.todayPlan?.tasks ?? [];
  return {units:board.units.length, work:board.tasks.length, undated:board.tasks.filter(t=>!t.date).length,
    grades:board.tasks.filter(t=>t.grade!=null || t.gradePlan!=null).length,
    attempts:board.tasks.filter(t=>t.attemptId).length, today:tasks.length, todayDone:tasks.filter(t=>t.completedAt!==undefined).length,
    workDone:board.tasks.filter(t=>changes.get(t.id) ?? t.done).length, overrides:changes.size};
}
