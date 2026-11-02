import { parseCloudTasks, type PlanSnapshot } from "../../../lib/today-plan.ts";
import { ApiError } from "./auth.ts";
import { requireMember } from "./backup.ts";
import type { SqlDatabase } from "./store.ts";

type PlanRow = {revision:number; tasks:string};
async function requirePlanOwner(db:SqlDatabase, owner:string) {
  await requireMember(db,owner,owner);
  const restored = await db.prepare("SELECT 1 AS found FROM backup_trial_snapshots WHERE account_id = ?1").bind(owner).first();
  if (!restored) throw new ApiError(404,"no_snapshot","Import a semester before creating its plan.");
}
function snapshot(row:PlanRow):PlanSnapshot {
  return {revision:row.revision,tasks:parseCloudTasks(JSON.parse(row.tasks))};
}
export async function readTodayPlan(db:SqlDatabase,owner:string):Promise<PlanSnapshot> {
  await requirePlanOwner(db,owner);
  const row=await db.prepare("SELECT revision,tasks FROM today_plans WHERE account_id = ?1").bind(owner).first<PlanRow>();
  return row ? snapshot(row) : {revision:0,tasks:[]};
}
export async function saveTodayPlan(db:SqlDatabase,owner:string,body:Record<string,unknown>):Promise<PlanSnapshot> {
  await requirePlanOwner(db,owner);
  const expected = body.expectedRevision;
  if (!Number.isSafeInteger(expected) || Number(expected)<0 || Object.keys(body).some(k=>k!=="expectedRevision" && k!=="tasks"))
    throw new ApiError(400,"invalid_plan","Send tasks and the plan version you loaded.");
  let data:string;
  try {data=JSON.stringify(parseCloudTasks(body.tasks));}
  catch {throw new ApiError(400,"invalid_tasks","Check task titles, planning dates and the 300-task limit.");}
  const write = expected === 0
    ? db.prepare("INSERT INTO today_plans(account_id,revision,tasks) VALUES (?1,1,?2) ON CONFLICT(account_id) DO NOTHING RETURNING revision,tasks").bind(owner,data)
    : db.prepare("UPDATE today_plans SET revision=revision+1,tasks=?2 WHERE account_id=?1 AND revision=?3 RETURNING revision,tasks").bind(owner,data,Number(expected));
  const saved=await write.first<PlanRow>();
  if (!saved) throw new ApiError(409,"plan_conflict","The plan changed on another device. Refresh before saving again.");
  return snapshot(saved);
}
