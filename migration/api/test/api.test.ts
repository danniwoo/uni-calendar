import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { createApi, type Env } from "../src/worker.ts";
import { configuredIssuer } from "../src/auth.ts";
import type { SqlDatabase, SqlStatement } from "../src/store.ts";
import type { SemesterResponse } from "../src/contract.ts";

const issuer = "https://semester-test.supabase.co/auth/v1";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const key = await generateKeyPair("ES256");
const publicJwk = { ...await exportJWK(key.publicKey), kid: "test-key", alg: "ES256", use: "sig" };

async function token(subject = alice, claims: JWTPayload = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: subject, iss: issuer, aud: "authenticated", iat: now, exp: now + 300,
    session_id: "33333333-3333-4333-8333-333333333333", role: "authenticated", is_anonymous: false, ...claims })
    .setProtectedHeader({ alg: "ES256", kid: "test-key" }).sign(key.privateKey);
}

class SQLiteStatement implements SqlStatement {
  db: DatabaseSync;
  sql: string;
  values: (string | number | null)[];
  constructor(db: DatabaseSync, sql: string, values: (string | number | null)[] = []) { this.db = db; this.sql = sql; this.values = values; }
  bind(...values: (string | number | null)[]) { return new SQLiteStatement(this.db, this.sql, values); }
  parameters() { return Object.fromEntries(this.values.map((value, i) => [String(i + 1), value])); }
  async first<T>() { return (this.db.prepare(this.sql).get(this.parameters()) ?? null) as T | null; }
  async run() { return { meta: { changes: Number(this.db.prepare(this.sql).run(this.parameters()).changes) } }; }
}
class SQLiteDatabase implements SqlDatabase {
  sqlite = new DatabaseSync(":memory:");
  constructor() {
    this.sqlite.exec("PRAGMA foreign_keys=ON");
    this.sqlite.exec(readFileSync(new URL("../migrations/0001_pilot.sql", import.meta.url), "utf8"));
    this.sqlite.exec(readFileSync(new URL("../migrations/0002_backup_trial.sql", import.meta.url), "utf8"));
  }
  prepare(sql: string) { return new SQLiteStatement(this.sqlite, sql); }
  async batch(statements: SqlStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      // The SQLite mutations are synchronous. Resolve results after the whole
      // batch, matching D1's transactional/non-interleaving batch boundary.
      const results = statements.map(s => {
        const statement = s as SQLiteStatement;
        return { meta: { changes: Number(this.sqlite.prepare(statement.sql).run(statement.parameters()).changes) } };
      });
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
}

function setup(t: { after(fn: () => void): void }) {
  const db = new SQLiteDatabase();
  t.after(() => db.sqlite.close());
  const env: Env = { DB: db, SUPABASE_URL: "https://semester-test.supabase.co", ALLOWED_ORIGINS: "https://semester.example,http://localhost:5173" };
  const api = createApi(createLocalJWKSet({ keys: [publicJwk] }));
  const call = async (path: string, jwt?: string, method = "GET", body?: unknown, extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = { ...extra };
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return api.fetch(new Request(`https://api.example${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), env);
  };
  return { db, env, api, call };
}

test("private restore is admitted, owner-bound, byte-preserving and never replaces another board", async t => {
  const { call, db } = setup(t);
  const a = await token(), b = await token(bob);
  const account = (await (await call("/v1/session", a)).json() as {accountId:string}).accountId;
  const other = (await (await call("/v1/session", b)).json() as {accountId:string}).accountId;
  const url = "/v1/backup-trial/" + account;
  const board = {year: 2026, session:"S2C", feedUrl:"", importedAt:"example",
    weeks:[{id:"1",label:"Week 1",start:"2026-08-03",end:"2026-08-09",kind:"teaching"}],
    units:[{code:"TEST1000",name:"Test",session:"S2C",outline:"",status:"",summary:"",assessments:[],topics:[]}],
    tasks:[{id:"undated",unit:"TEST1000",kind:"task",title:"No date",weight:"",timing:"",description:"",source:"",sourceText:"",grade:{earned:0,possible:10}}],
    classes:[],warnings:[],completed:{one:true,two:false}};
  assert.equal((await call(url, a, "POST", board)).status, 403);
  db.sqlite.prepare("INSERT INTO backup_trial_members VALUES (?)").run(account);
  db.sqlite.prepare("INSERT INTO backup_trial_members VALUES (?)").run(other);
  assert.equal((await call(url)).status, 401);
  assert.equal((await call(url, b)).status, 403);
  assert.equal((await call(url, b, "POST", board)).status, 403);
  assert.equal((await call(url, a)).status, 404);
  assert.equal((await call(url, a, "POST", {format:"semester-course-plan"})).status, 400);
  assert.equal((await call(url, a, "POST", {...board,feedUrl:"private-url"})).status, 400);
  const seeded = await (await call("/v1/semester/sample", a, "POST")).text();
  const receipt = await call(url, a, "POST", board);
  assert.equal(receipt.status, 201);
  assert.equal((await call(url, a, "POST", board)).status, 200);
  assert.equal((await call(url, a, "POST", {...board,completed:{one:false}})).status, 409);
  assert.equal(await (await call(url, a)).text(), JSON.stringify(board));
  assert.equal(await (await call("/v1/semester", a)).text(), seeded);
  assert.equal((await call("/v1/backup-trial/" + other, b)).status, 404);
});

test("real signatures: valid sessions have a stable app account, not a caller supplied identity", async t => {
  const { call, db } = setup(t);
  const jwt = await token();
  const first = await call("/v1/session", jwt);
  assert.equal(first.status, 200);
  const a = await first.json() as { accountId: string };
  assert.match(a.accountId, /^[a-f0-9-]{36}$/);
  assert.notEqual(a.accountId, alice);
  const again = await call("/v1/session?owner=someone-else", jwt, "GET", undefined, { "oai-authenticated-user-id": bob });
  assert.deepEqual(await again.json(), a);
  const b = await call("/v1/session", await token(bob));
  assert.notEqual((await b.json() as { accountId: string }).accountId, a.accountId);
  const maliciousMetadata = await call("/v1/session", await token(alice, { user_metadata: { owner: bob, role: "service_role" } }));
  assert.deepEqual(await maliciousMetadata.json(), a);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM pilot_accounts").get()?.n, 2);
  assert.equal(first.headers.get("cache-control"), "no-store");
});

test("missing, expired, wrong issuer/audience, anonymous and admin tokens cannot reach D1", async t => {
  const { call, db } = setup(t);
  const now = Math.floor(Date.now() / 1000);
  const attempts = [undefined, "not.a.token", await token(alice, { exp: now - 60 }),
    await token(alice, { iss: "https://other.supabase.co/auth/v1" }), await token(alice, { aud: "anon" }),
    await token(alice, { role: "service_role" }), await token(alice, { is_anonymous: true }),
    await token(alice, { exp: undefined }), await token(alice, { session_id: undefined }),
    await token("arbitrary-owner"), await token(alice, { nbf: now + 60 })];
  for (const jwt of attempts) {
    const result = await call("/v1/session", jwt, "GET", undefined, { "oai-authenticated-user-id": alice });
    assert.equal(result.status, 401);
    assert.equal(result.headers.get("www-authenticate"), "Bearer");
  }
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM pilot_accounts").get()?.n, 0);
});

test("forged signature and symmetric signing algorithm are rejected", async t => {
  const { call } = setup(t);
  const other = await generateKeyPair("ES256");
  const payload = { sub: alice, iss: issuer, aud: "authenticated", iat: 1, exp: Math.floor(Date.now() / 1000) + 300,
    session_id: "33333333-3333-4333-8333-333333333333", role: "authenticated", is_anonymous: false };
  const forged = await new SignJWT(payload).setProtectedHeader({ alg: "ES256", kid: "test-key" }).sign(other.privateKey);
  const symmetric = await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode("not-a-trusted-secret"));
  assert.equal((await call("/v1/session", forged)).status, 401);
  assert.equal((await call("/v1/session", symmetric)).status, 401);
});

test("sample creation is explicit and idempotent; each owner gets their own board", async t => {
  const { call } = setup(t);
  const a = await token(); const b = await token(bob);
  assert.equal((await call("/v1/semester", a)).status, 404);
  const seeded = await call("/v1/semester/sample", a, "POST");
  assert.equal(seeded.status, 200);
  const initial = await seeded.json() as SemesterResponse;
  assert.match(initial.semester.title, /Sample/);
  assert.equal(initial.revision, 1);
  for (const assessment of initial.semester.assessments) assert.ok(Number.isFinite(Date.parse(assessment.dueAt)));
  assert.equal((await call("/v1/semester", b)).status, 404);
  const update = await call(`/v1/tasks/${initial.semester.tasks[0].id}`, a, "PATCH", { completed: true, expectedRevision: 1 });
  assert.equal(update.status, 200);
  const changed = await update.json() as SemesterResponse;
  assert.equal(changed.revision, 2);
  assert.equal(changed.semester.tasks[0].completed, true);
  assert.deepEqual(changed.semester.assessments, initial.semester.assessments);
  assert.deepEqual(await (await call("/v1/semester/sample", a, "POST", {})).json(), changed);
  const bBoard = await (await call("/v1/semester/sample", b, "POST")).json() as SemesterResponse;
  assert.equal(bBoard.semester.tasks[0].completed, false);
  assert.equal(bBoard.revision, 1);
});

test("stale and concurrent writes preserve data, and only the owned task can change", async t => {
  const { call } = setup(t); const jwt = await token();
  await call("/v1/semester/sample", jwt, "POST");
  const path = "/v1/tasks/sample-report-draft";
  const results = await Promise.all(Array.from({ length: 5 }, () => call(path, jwt, "PATCH", { completed: true, expectedRevision: 1 })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(results.filter(r => r.status === 409).length, 4);
  assert.equal((await call("/v1/tasks/not-my-task", jwt, "PATCH", { completed: true, expectedRevision: 2 })).status, 404);
  assert.equal((await call(path, jwt, "PATCH", { completed: false, expectedRevision: 1 })).status, 409);
  const stored = await (await call("/v1/semester", jwt)).json() as SemesterResponse;
  assert.equal(stored.revision, 2);
  assert.equal(stored.semester.tasks[0].completed, true);
  assert.equal(stored.semester.tasks[1].completed, false);
});

test("request validation rejects owner injection, invalid updates and oversized bodies", async t => {
  const { call, api, env } = setup(t); const jwt = await token();
  await call("/v1/semester/sample", jwt, "POST");
  for (const body of [{ completed: true, expectedRevision: 1, owner: bob }, { completed: "yes", expectedRevision: 1 },
    { completed: true, expectedRevision: 0 }, { completed: true, expectedRevision: 1.2 }, [], null]) {
    assert.equal((await call("/v1/tasks/sample-report-draft", jwt, "PATCH", body)).status, 400);
  }
  assert.equal((await call("/v1/semester/sample", jwt, "POST", { owner: bob })).status, 400);
  for (const path of ["/v1/tasks/sample-report-draft", "/v1/semester/sample"]) {
    const response = await call(path, jwt, path.includes("tasks") ? "PATCH" : "POST", { big: "x".repeat(2100) });
    assert.equal(response.status, 413);
  }
  const malformed = await api.fetch(new Request("https://api.example/v1/tasks/sample-report-draft", {
    method: "PATCH", headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }, body: "{" }), env);
  assert.equal(malformed.status, 400);
  assert.equal((await call("/v1/tasks/sample-report-draft", jwt, "PATCH")).status, 415);
});

test("CORS uses exact allowed origins, and preflight creates no accounts", async t => {
  const { call, db } = setup(t);
  const denied = await call("/v1/session", await token(), "GET", undefined, { Origin: "https://semester.example.evil.test" });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
  const preflight = await call("/v1/tasks/example", undefined, "OPTIONS", undefined, {
    Origin: "https://semester.example", "Access-Control-Request-Method": "PATCH", "Access-Control-Request-Headers": "authorization, content-type" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://semester.example");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM pilot_accounts").get()?.n, 0);
  const badHeader = await call("/v1/tasks/example", undefined, "OPTIONS", undefined, {
    Origin: "https://semester.example", "Access-Control-Request-Method": "PATCH", "Access-Control-Request-Headers": "x-owner" });
  assert.equal(badHeader.status, 403);
  const badMethod = await call("/v1/tasks/example", undefined, "OPTIONS", undefined, {
    Origin: "https://semester.example", "Access-Control-Request-Method": "DELETE" });
  assert.equal(badMethod.status, 403);
});

test("issuer configuration cannot accept a caller-selected endpoint", () => {
  assert.equal(configuredIssuer("https://semester-test.supabase.co"), issuer);
  for (const url of ["http://semester-test.supabase.co", "https://evil.test", "https://semester-test.supabase.co@evil.test", "https://semester-test.supabase.co/auth/v1", "https://semester-test.supabase.co?jwks=evil"]) {
    assert.throws(() => configuredIssuer(url));
  }
});

test("account first-request races do not duplicate identities or create orphan accounts", async t => {
  const { call, db } = setup(t); const jwt = await token();
  const sessions = await Promise.all(Array.from({ length: 5 }, () => call("/v1/session", jwt)));
  const ids = await Promise.all(sessions.map(async response => {
    assert.equal(response.status, 200); return (await response.json() as { accountId: string }).accountId;
  }));
  assert.equal(new Set(ids).size, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM pilot_accounts").get()?.n, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM pilot_identities").get()?.n, 1);
});
