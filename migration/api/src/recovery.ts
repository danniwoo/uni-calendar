import { prepareRecovery, recoveryFormat, type Current, type Completion } from "../../recovery.ts";
import type { PlanSnapshot } from "../../../lib/today-plan.ts";
import { ApiError } from "./auth.ts";
import type { SqlDatabase } from "./store.ts";

type Saved = {version:number; data:string|null; sha:string|null; imported_at:string|null;
  plan_revision:number|null; tasks:string|null; completion:string};

// One SQLite statement keeps the semester and both types of progress at the same instant.
export async function currentRecovery(db:SqlDatabase,owner:string):Promise<Current> {
  const row = await db.prepare(`SELECT coalesce(v.version,0) AS version,coalesce(a.data,s.data) AS data,
    coalesce(a.sha256,s.sha256) AS sha, coalesce(a.imported_at,s.imported_at) AS imported_at,
    p.revision AS plan_revision,p.tasks,
    (SELECT json_group_array(json_object('taskId',task_id,'done',done,'revision',revision))
      FROM (SELECT task_id,done,revision FROM imported_completion WHERE account_id=m.account_id AND active=1 ORDER BY task_id)) AS completion
    FROM backup_trial_members m LEFT JOIN backup_trial_snapshots s USING(account_id)
    LEFT JOIN recovery_active a USING(account_id) LEFT JOIN recovery_versions v USING(account_id)
    LEFT JOIN today_plans p USING(account_id) WHERE m.account_id=?1`).bind(owner).first<Saved>();
  if (!row) throw new ApiError(403,"not_admitted","This account is not enrolled in the private import trial.");
  return {version:row.version,backup:row.data===null ? null : {
    format:recoveryFormat,version:1,owner,snapshot:{originalJson:row.data,sha256:row.sha!,importedAt:row.imported_at!},
    todayPlan:row.tasks===null ? null : {revision:row.plan_revision!,tasks:JSON.parse(row.tasks)},
    completion:JSON.parse(row.completion) as Completion[],
  }};
}

function planWrite(db:SqlDatabase,owner:string,previous:PlanSnapshot|null,next:PlanSnapshot|null) {
  if (!previous && !next) return [];
  const tasks=JSON.stringify(next?.tasks ?? []);
  if (previous && JSON.stringify(previous.tasks)===tasks && previous.revision>=(next?.revision ?? 0)) return [];
  const revision=Math.max((previous?.revision ?? 0)+1,next?.revision ?? 1);
  return [db.prepare(`INSERT INTO today_plans(account_id,revision,tasks) VALUES (?1,?2,?3)
    ON CONFLICT(account_id) DO UPDATE SET revision=excluded.revision,tasks=excluded.tasks`).bind(owner,revision,tasks)];
}

export async function restoreRecovery(db:SqlDatabase,owner:string,body:Record<string,unknown>) {
  if (typeof body.file!=="string" || !Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion)<0)
    throw new ApiError(400,"invalid_restore","Choose a file and preview it before restoring.");
  const current=await currentRecovery(db,owner);
  const conflict=()=>new ApiError(409,"preview_changed","Your semester or progress changed. Preview again before restoring.");
  if (current.version!==body.expectedVersion) throw conflict();
  let prepared;
  try {prepared=await prepareRecovery(body.file,owner,current.backup);}
  catch(e){throw new ApiError(400,"invalid_backup",e instanceof Error ? e.message : "Invalid backup.");}
  const {snapshot,todayPlan,completion}=prepared.backup;
  const statements=[
    db.prepare("INSERT INTO recovery_versions(account_id,version) VALUES (?1,0) ON CONFLICT DO NOTHING").bind(owner),
    // The version trigger aborts the entire D1 batch if any write followed the preview.
    db.prepare("UPDATE recovery_versions SET version=?2 WHERE account_id=?1").bind(owner,current.version+1),
  ];
  if (!current.backup) {
    statements.push(db.prepare("INSERT INTO backup_trial_snapshots(account_id,sha256,data,imported_at) VALUES (?1,?2,?3,?4)")
      .bind(owner,snapshot.sha256,snapshot.originalJson,snapshot.importedAt));
  } else if(current.backup.snapshot.sha256!==snapshot.sha256) {
    statements.push(db.prepare(`INSERT INTO recovery_active(account_id,sha256,data,imported_at) VALUES (?1,?2,?3,?4)
      ON CONFLICT(account_id) DO UPDATE SET sha256=excluded.sha256,data=excluded.data,imported_at=excluded.imported_at`)
      .bind(owner,snapshot.sha256,snapshot.originalJson,snapshot.importedAt));
  }
  if (prepared.full) {
    statements.push(...planWrite(db,owner,current.backup?.todayPlan ?? null,todayPlan));
    const changes=JSON.stringify(completion);
    // Inactive rows retain a revision so older open phone screens cannot recreate removed changes.
    statements.push(db.prepare(`UPDATE imported_completion SET active=0,revision=revision+1 WHERE account_id=?1 AND active=1
      AND task_id NOT IN (SELECT json_extract(value,'$.taskId') FROM json_each(?2))`).bind(owner,changes));
    statements.push(db.prepare(`INSERT INTO imported_completion(account_id,task_id,done,revision,active)
      SELECT ?1,json_extract(value,'$.taskId'),json_extract(value,'$.done'),json_extract(value,'$.revision'),1
      FROM json_each(?2) WHERE 1 ON CONFLICT(account_id,task_id) DO UPDATE SET done=excluded.done,active=1,
      revision=max(imported_completion.revision+1,excluded.revision)
      WHERE active=0 OR done!=excluded.done OR imported_completion.revision<excluded.revision`).bind(owner,changes));
  }
  statements.push(db.prepare("SELECT version FROM recovery_versions WHERE account_id=?1").bind(owner));
  let results;
  try {results=await db.batch(statements);}
  catch(e) {
    if ((await currentRecovery(db,owner)).version!==current.version) throw conflict();
    throw e;
  }
  const clock=results[results.length-1] as {results:{version:number}[]};
  return {sha256:snapshot.sha256,revision:clock.results[0].version};
}
