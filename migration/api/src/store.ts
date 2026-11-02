import { ApiError } from "./auth.ts";
import { createSampleSemester, type PilotSemester, type SemesterResponse } from "./contract.ts";

// Structural subset of D1, also implemented by the real SQLite test adapter.
export interface SqlStatement {
  bind(...values: (string | number | null)[]): SqlStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results:T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
  batch(statements: SqlStatement[]): Promise<unknown[]>;
}
interface BoardRow { data: string; revision: number }

export async function resolveAccount(db: SqlDatabase, identity: { issuer: string; subject: string }): Promise<string> {
  const existing = await db.prepare("SELECT account_id FROM pilot_identities WHERE issuer = ?1 AND subject = ?2")
    .bind(identity.issuer, identity.subject).first<{ account_id: string }>();
  if (existing) return existing.account_id;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  // D1 batch is transactional. A simultaneous first request cannot create an
  // orphan account or a second mapping for the same verified identity.
  await db.batch([
    db.prepare("INSERT INTO pilot_accounts (id, created_at) SELECT ?1, ?2 WHERE NOT EXISTS (SELECT 1 FROM pilot_identities WHERE issuer = ?3 AND subject = ?4)")
      .bind(id, now, identity.issuer, identity.subject),
    db.prepare("INSERT INTO pilot_identities (issuer, subject, account_id) SELECT ?1, ?2, ?3 WHERE EXISTS (SELECT 1 FROM pilot_accounts WHERE id = ?3) ON CONFLICT (issuer, subject) DO NOTHING")
      .bind(identity.issuer, identity.subject, id),
  ]);
  const row = await db.prepare("SELECT account_id FROM pilot_identities WHERE issuer = ?1 AND subject = ?2")
    .bind(identity.issuer, identity.subject).first<{ account_id: string }>();
  if (!row) throw new Error("Account mapping unavailable");
  return row.account_id;
}

function response(row: BoardRow): SemesterResponse {
  return { semester: JSON.parse(row.data) as PilotSemester, revision: row.revision };
}

export async function getSemester(db: SqlDatabase, accountId: string): Promise<SemesterResponse> {
  const row = await db.prepare("SELECT data, revision FROM pilot_boards WHERE account_id = ?1").bind(accountId).first<BoardRow>();
  if (!row) throw new ApiError(404, "semester_not_found", "Create your sample semester to start the connection trial.");
  return response(row);
}

export async function createSample(db: SqlDatabase, accountId: string): Promise<SemesterResponse> {
  await db.prepare("INSERT INTO pilot_boards (account_id, data, revision, updated_at) VALUES (?1, ?2, 1, ?3) ON CONFLICT (account_id) DO NOTHING")
    .bind(accountId, JSON.stringify(createSampleSemester()), new Date().toISOString()).run();
  return getSemester(db, accountId);
}

export async function updateTask(db: SqlDatabase, accountId: string, taskId: string, completed: boolean, expectedRevision: number): Promise<SemesterResponse> {
  const current = await getSemester(db, accountId);
  if (current.revision !== expectedRevision) throw new ApiError(409, "revision_conflict", "This semester changed on another device. Refresh before trying again.");
  const task = current.semester.tasks.find(task => task.id === taskId);
  if (!task) throw new ApiError(404, "task_not_found", "This task is not in your sample semester.");
  task.completed = completed;
  // The revision predicate makes read+modify+write atomic against concurrent
  // clients. Only this one field changes; unrelated data remains from the read.
  const row = await db.prepare("UPDATE pilot_boards SET data = ?1, revision = revision + 1, updated_at = ?2 WHERE account_id = ?3 AND revision = ?4 RETURNING data, revision")
    .bind(JSON.stringify(current.semester), new Date().toISOString(), accountId, expectedRevision).first<BoardRow>();
  if (!row) throw new ApiError(409, "revision_conflict", "This semester changed on another device. Refresh before trying again.");
  return response(row);
}
