import { readBackup } from "../../../lib/backup.ts";
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
