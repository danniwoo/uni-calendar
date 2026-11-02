import { readBackup } from "../../../lib/backup.ts";
import { importedAssessments } from "../../../lib/imported-assessments.ts";
import { ApiError } from "./auth.ts";
import type { SqlDatabase } from "./store.ts";

export const maxBackupBytes = 1_800_000;
export async function requireMember(db: SqlDatabase, owner: string, requested: string) {
  if (owner !== requested || !await db.prepare("SELECT 1 AS admitted FROM backup_trial_members WHERE account_id = ?1").bind(owner).first()) {
    throw new ApiError(403, "not_admitted", "This account is not enrolled in the backup trial.");
  }
}
export async function storeBackup(db: SqlDatabase, owner: string, text: string) {
  try {
    readBackup(text);
    // Keep the exact exported bytes, but never retain an embedded subscription URL.
    if (JSON.parse(text).feedUrl !== "") throw new Error();
  } catch { throw new ApiError(400, "invalid_backup", "Choose a complete saved-semester export with an empty timetable feed."); }
  const bytes = new TextEncoder().encode(text);
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), n => n.toString(16).padStart(2, "0")).join("");
  const result = await db.prepare("INSERT INTO backup_trial_snapshots (account_id, sha256, data, imported_at) SELECT account_id, ?2, ?3, ?4 FROM backup_trial_members WHERE account_id = ?1 ON CONFLICT(account_id) DO NOTHING")
    .bind(owner, digest, text, new Date().toISOString()).run();
  const row = await db.prepare("SELECT sha256 FROM backup_trial_snapshots WHERE account_id = ?1").bind(owner).first<{sha256:string}>();
  if (!row || row.sha256 !== digest) throw new ApiError(409, "snapshot_exists", "A different restore point already exists. It has been kept.");
  return { sha256: digest, created: result.meta.changes === 1 };
}
export async function exportBackup(db: SqlDatabase, owner: string): Promise<string> {
  const row = await db.prepare("SELECT data FROM backup_trial_snapshots WHERE account_id = ?1").bind(owner).first<{data:string}>();
  if (!row) throw new ApiError(404, "no_snapshot", "No backup has been imported for this account.");
  return row.data;
}

async function activeSnapshot(db: SqlDatabase, owner: string) {
  const row = await db.prepare(`SELECT COALESCE(a.data,s.data) AS data, COALESCE(a.sha256,s.sha256) AS sha256,
    (SELECT json_group_array(json_object('task_id',task_id,'done',done,'active',active,'revision',revision))
     FROM imported_completion WHERE account_id=s.account_id) AS completion
    FROM backup_trial_snapshots s LEFT JOIN recovery_active a USING(account_id) WHERE s.account_id=?1`)
    .bind(owner).first<{data:string;sha256:string;completion:string}>();
  if (!row) throw new ApiError(404,"no_snapshot","No backup has been imported for this account.");
  return row;
}

export async function getImportedAssessments(db: SqlDatabase, owner: string) {
  await requireMember(db, owner, owner);
  const snapshot = await activeSnapshot(db, owner);
  const board = importedAssessments(readBackup(snapshot.data));
  const results = JSON.parse(snapshot.completion) as {task_id:string;done:number;revision:number;active:number}[];
  const changes = new Map(results.map(row=>[row.task_id,row]));
  return {...board,rows:board.rows.map(row=>{
    const change = changes.get(row.id);
    return {...row,done:change?.active ? Boolean(change.done) : row.done,completionRevision:change?.revision ?? 0};
  })};
}

export async function setImportedCompletion(db:SqlDatabase, owner:string, body:Record<string,unknown>) {
  const {id,done,expectedRevision} = body;
  if (typeof id !== "string" || !id || typeof done !== "boolean" || !Number.isSafeInteger(expectedRevision)
      || Number(expectedRevision)<0 || Object.keys(body).some(key=>!["id","done","expectedRevision"].includes(key))) {
    throw new ApiError(400,"invalid_completion","Send the occurrence, completion state and version you loaded.");
  }
  await requireMember(db,owner,owner);
  const snapshot = await activeSnapshot(db,owner);
  const board = readBackup(snapshot.data);
  if (!board.tasks.some(task=>task.id===id)) throw new ApiError(404,"missing_occurrence","This occurrence is unavailable.");
  const sameBoard = `(SELECT COALESCE(a.sha256,s.sha256) FROM backup_trial_snapshots s
    LEFT JOIN recovery_active a USING(account_id) WHERE s.account_id=?1)`;
  const write = expectedRevision === 0
    ? db.prepare(`INSERT INTO imported_completion(account_id,task_id,done,revision)
      SELECT ?1,?2,?3,1 WHERE ${sameBoard}=?4 ON CONFLICT DO NOTHING`).bind(owner,id,Number(done),snapshot.sha256)
    : db.prepare(`UPDATE imported_completion SET done=?3,active=1,revision=revision+1
      WHERE account_id=?1 AND task_id=?2 AND revision=?4 AND ${sameBoard}=?5`)
      .bind(owner,id,Number(done),Number(expectedRevision),snapshot.sha256);
  if ((await write.run()).meta.changes !== 1) throw new ApiError(409,"completion_conflict","This occurrence changed. Refresh before trying again.");
  return {id,done,revision:Number(expectedRevision)+1};
}
