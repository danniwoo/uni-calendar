import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { createApi, type Env } from "../src/worker.ts";
import { configuredIssuer } from "../src/auth.ts";
import {invitationHash} from "../src/access.ts";
import type { SqlDatabase, SqlStatement } from "../src/store.ts";
import type { SemesterResponse } from "../src/contract.ts";

const issuer = "https://semester-test.supabase.co/auth/v1";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const charlie = "44444444-4444-4444-8444-444444444444";
const dana = "55555555-5555-4555-8555-555555555555";
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
  async all<T>() { return {results:this.db.prepare(this.sql).all(this.parameters()) as T[]}; }
  async run() { return { meta: { changes: Number(this.db.prepare(this.sql).run(this.parameters()).changes) } }; }
}
class SQLiteDatabase implements SqlDatabase {
  sqlite = new DatabaseSync(":memory:");
  constructor() {
    this.sqlite.exec("PRAGMA foreign_keys=ON");
    this.sqlite.exec(readFileSync(new URL("../migrations/0001_pilot.sql", import.meta.url), "utf8"));
    this.sqlite.exec(readFileSync(new URL("../migrations/0002_backup_trial.sql", import.meta.url), "utf8"));
    this.sqlite.exec(readFileSync(new URL("../migrations/0003_today_plans.sql", import.meta.url), "utf8"));
    this.sqlite.exec(readFileSync(new URL("../migrations/0004_imported_completion.sql", import.meta.url), "utf8"));
    this.sqlite.exec(readFileSync(new URL("../migrations/0005_recovery.sql", import.meta.url), "utf8"));
    this.sqlite.exec(readFileSync(new URL("../migrations/0006_invitation_access.sql", import.meta.url), "utf8"));
    this.sqlite.exec(readFileSync(new URL("../migrations/0007_growth_referrals.sql", import.meta.url), "utf8"));
  }
  prepare(sql: string) { return new SQLiteStatement(this.sqlite, sql); }
  async batch(statements: SqlStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      // The SQLite mutations are synchronous. Resolve results after the whole
      // batch, matching D1's transactional/non-interleaving batch boundary.
      const results = statements.map(s => {
        const statement = s as SQLiteStatement;
        if (statement.sql.startsWith("SELECT ")) return {results:this.sqlite.prepare(statement.sql).all(statement.parameters())};
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

async function addInvitation(db:SQLiteDatabase,token:string,{id=crypto.randomUUID(),expiresAt="2099-01-01T00:00:00.000Z",revokedAt=null as string|null,max=1,count=0}={}) {
  db.sqlite.prepare(`INSERT INTO access_invitations
    (id,kind,token_hash,label,max_redemptions,redemption_count,expires_at,revoked_at,created_at)
    VALUES (?,'private',?,'Test invitation',?,?,?,?,?)`)
    .run(id,await invitationHash(token),max,count,expiresAt,revokedAt,"2026-11-10T00:00:00.000Z");
  return id;
}

test("the invitation migration backfills a populated legacy allowlist",t=>{
  const sqlite=new DatabaseSync(":memory:");t.after(()=>sqlite.close());sqlite.exec("PRAGMA foreign_keys=ON");
  for(const name of ["0001_pilot.sql","0002_backup_trial.sql","0003_today_plans.sql","0004_imported_completion.sql","0005_recovery.sql"])
    sqlite.exec(readFileSync(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
  const account="99999999-9999-4999-8999-999999999999";
  sqlite.prepare("INSERT INTO pilot_accounts VALUES (?,?)").run(account,"2026-11-01T00:00:00Z");
  sqlite.prepare("INSERT INTO backup_trial_members VALUES (?)").run(account);
  sqlite.exec(readFileSync(new URL("../migrations/0006_invitation_access.sql",import.meta.url),"utf8"));
  const access=sqlite.prepare("SELECT state,source FROM account_access WHERE account_id=?").get(account) as {state:string;source:string};
  assert.equal(access.state,"active");assert.equal(access.source,"legacy_pilot");
});

test("growth migration backfills immutable attribution without changing access",t=>{
  const db=new SQLiteDatabase();t.after(()=>db.sqlite.close());
  const account="99999999-9999-4999-8999-999999999998",timestamp="2026-11-01T00:00:00.000Z";
  db.sqlite.prepare("INSERT INTO pilot_accounts VALUES (?,?)").run(account,timestamp);
  db.sqlite.prepare("INSERT INTO account_access VALUES (?,'active','private_invitation',NULL,?,?)").run(account,timestamp,timestamp);
  // The migration already ran in the fixture, so exercise its idempotent backfill statement.
  db.sqlite.exec(`INSERT INTO account_attribution(account_id,direct_channel,acquired_at)
    SELECT account_id,CASE source WHEN 'private_invitation' THEN 'private_invitation' ELSE 'legacy_pilot' END,enrolled_at
    FROM account_access WHERE 1 ON CONFLICT(account_id) DO NOTHING`);
  assert.deepEqual({...db.sqlite.prepare("SELECT direct_channel,acquired_at FROM account_attribution WHERE account_id=?").get(account) as object},
    {direct_channel:"private_invitation",acquired_at:timestamp});
  assert.equal(db.sqlite.prepare("SELECT state FROM account_access WHERE account_id=?").get(account)?.state,"active");
});

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
  const assessments = "/v1/imported/assessments";
  assert.equal((await call(assessments, a)).status, 403);
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
  const response = await call(assessments, a);
  assert.equal(response.status, 200);
  const imported = await response.json() as {rows:{id:string;date:string|null}[];grades:{mark:unknown}[]};
  assert.equal(imported.rows[0].id, "undated");
  assert.equal(imported.rows[0].date, null);
  assert.deepEqual(imported.grades[0].mark, {earned:0,possible:10});
  assert.equal("completed" in imported, false);
  assert.equal((await call(assessments + "?owner=" + account, b)).status, 404);
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
  const { call,db } = setup(t);
  const a = await token(); const b = await token(bob);
  for(const jwt of [a,b]) {
    const {accountId}=await (await call("/v1/session",jwt)).json() as {accountId:string};
    db.sqlite.prepare("INSERT INTO backup_trial_members VALUES (?)").run(accountId);
  }
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
  const { call,db } = setup(t); const jwt = await token();
  const {accountId}=await (await call("/v1/session",jwt)).json() as {accountId:string};
  db.sqlite.prepare("INSERT INTO backup_trial_members VALUES (?)").run(accountId);
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
  const {accountId}=await (await call("/v1/session",jwt)).json() as {accountId:string};
  (env.DB as SQLiteDatabase).sqlite.prepare("INSERT INTO backup_trial_members VALUES (?)").run(accountId);
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

test("a private invitation enrols a mapped account and unlocks protected import routes",async t=>{
  const {call,db}=setup(t),jwt=await token(),invite="A".repeat(43);
  await addInvitation(db,invite);
  const preview=await call("/v1/access/invitation",undefined,"POST",{token:invite});
  assert.equal(preview.status,200);assert.equal((await preview.json() as {remaining:number}).remaining,1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM pilot_accounts").get()?.n,0,"public preview must not map an identity");
  const session=await (await call("/v1/session",jwt)).json() as {accountId:string;access:{state:string;enrolled:boolean}};
  assert.deepEqual(session.access,{state:"none",enrolled:false,source:null,enrolledAt:null});
  assert.equal((await call("/v1/imported/board",jwt)).status,403);
  const redeemed=await call("/v1/access/redeem",jwt,"POST",{token:invite});
  assert.equal(redeemed.status,200);
  assert.equal((await redeemed.json() as {access:{state:string};alreadyEnrolled:boolean}).alreadyEnrolled,false);
  const active=await (await call("/v1/session",jwt)).json() as {access:{state:string;enrolled:boolean;source:string}};
  assert.equal(active.access.state,"active");assert.equal(active.access.enrolled,true);assert.equal(active.access.source,"private_invitation");
  assert.equal((await call("/v1/imported/board",jwt)).status,200);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM backup_trial_members WHERE account_id=?").get(session.accountId)?.n,1);
  assert.equal(db.sqlite.prepare("SELECT redemption_count n FROM access_invitations").get()?.n,1);
});

test("invalid, expired, revoked and exhausted invitations fail without granting access",async t=>{
  const {call,db}=setup(t),jwt=await token();
  await call("/v1/session",jwt);
  const cases:[string,{expiresAt?:string;revokedAt?:string;max?:number;count?:number},number,string][]=[
    ["B".repeat(43),{expiresAt:"2000-01-01T00:00:00.000Z"},410,"invitation_expired"],
    ["C".repeat(43),{revokedAt:"2026-11-10T00:00:00.000Z"},410,"invitation_revoked"],
    ["D".repeat(43),{max:1,count:1},409,"invitation_exhausted"],
  ];
  for(const [value,options,status,code] of cases) {
    await addInvitation(db,value,options);
    for(const authenticated of [false,true]) {
      const response=await call(authenticated?"/v1/access/redeem":"/v1/access/invitation",authenticated?jwt:undefined,"POST",{token:value});
      assert.equal(response.status,status);assert.equal((await response.json() as {error:{code:string}}).error.code,code);
    }
  }
  assert.equal((await call("/v1/access/invitation",undefined,"POST",{token:"short"})).status,400);
  assert.equal((await call("/v1/access/redeem",jwt,"POST",{token:"E".repeat(43)})).status,404);
  const session=await (await call("/v1/session",jwt)).json() as {access:{state:string}};
  assert.equal(session.access.state,"none");
});

test("only one account can redeem a final invitation slot",async t=>{
  const {call,db}=setup(t),invite="F".repeat(43),tokens=[await token(bob),await token(charlie)];
  await addInvitation(db,invite);
  await Promise.all(tokens.map(jwt=>call("/v1/session",jwt)));
  const results=await Promise.all(tokens.map(jwt=>call("/v1/access/redeem",jwt,"POST",{token:invite})));
  assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
  assert.equal(db.sqlite.prepare("SELECT redemption_count n FROM access_invitations").get()?.n,1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM invitation_redemptions WHERE counted=1").get()?.n,1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM account_access WHERE state='active'").get()?.n,1);
});

test("redemption retries are idempotent and cannot reactivate suspended access",async t=>{
  const {call,db}=setup(t),jwt=await token(dana),first="G".repeat(43),second="H".repeat(43);
  await call("/v1/session",jwt);await addInvitation(db,first);
  assert.equal((await call("/v1/access/redeem",jwt,"POST",{token:first})).status,200);
  const again=await call("/v1/access/redeem",jwt,"POST",{token:first});
  assert.equal(again.status,200);assert.equal((await again.json() as {alreadyEnrolled:boolean}).alreadyEnrolled,true);
  assert.equal(db.sqlite.prepare("SELECT redemption_count n FROM access_invitations WHERE token_hash=?").get(await invitationHash(first))?.n,1);
  const {accountId}=await (await call("/v1/session",jwt)).json() as {accountId:string};
  db.sqlite.prepare("UPDATE account_access SET state='suspended' WHERE account_id=?").run(accountId);
  await addInvitation(db,second);
  assert.equal((await call("/v1/access/redeem",jwt,"POST",{token:second})).status,403);
  assert.equal((await call("/v1/imported/board",jwt)).status,403);
  assert.equal(db.sqlite.prepare("SELECT redemption_count n FROM access_invitations WHERE token_hash=?").get(await invitationHash(second))?.n,0);
});

test("legacy backup-trial members are backfilled and do not consume invitations",async t=>{
  const {call,db}=setup(t),jwt=await token(),invite="I".repeat(43);
  const {accountId}=await (await call("/v1/session",jwt)).json() as {accountId:string};
  db.sqlite.prepare("INSERT INTO backup_trial_members VALUES (?)").run(accountId);
  const session=await (await call("/v1/session",jwt)).json() as {access:{state:string;source:string}};
  assert.equal(session.access.state,"active");assert.equal(session.access.source,"legacy_pilot");
  await addInvitation(db,invite);
  const result=await call("/v1/access/redeem",jwt,"POST",{token:invite});
  assert.equal(result.status,200);assert.equal((await result.json() as {alreadyEnrolled:boolean}).alreadyEnrolled,true);
  assert.equal(db.sqlite.prepare("SELECT redemption_count n FROM access_invitations").get()?.n,0);
  assert.equal((await call("/v1/imported/board",jwt)).status,200);
});

test("society acquisition and A to B to C referrals stay distinct from explicit friendship",async t=>{
  const {call,db}=setup(t),aJwt=await token(alice),bJwt=await token(bob),cJwt=await token(charlie),dJwt=await token(dana);
  const campaignId=crypto.randomUUID(),campaignToken="J".repeat(43),campaignInvite=crypto.randomUUID(),created="2026-11-10T00:00:00.000Z";
  db.sqlite.prepare("INSERT INTO growth_campaigns VALUES (?,? ,?,'society',?,NULL)").run(campaignId,"SYNCS-2027S1","SYNCS 2027 S1",created);
  db.sqlite.prepare(`INSERT INTO access_invitations(id,kind,token_hash,label,max_redemptions,redemption_count,expires_at,created_at)
    VALUES (?,'campaign',?,'SYNCS',100,0,'2099-01-01T00:00:00.000Z',?)`).run(campaignInvite,await invitationHash(campaignToken),created);
  db.sqlite.prepare("INSERT INTO invitation_contexts(invitation_id,campaign_id) VALUES (?,?)").run(campaignInvite,campaignId);

  const campaignPreview=await (await call("/v1/access/invitation",undefined,"POST",{token:campaignToken})).json() as {kind:string;campaign:{key:string}};
  assert.equal(campaignPreview.kind,"campaign");assert.equal(campaignPreview.campaign.key,"SYNCS-2027S1");
  const aId=(await (await call("/v1/session",aJwt)).json() as {accountId:string}).accountId;
  assert.equal((await call("/v1/access/redeem",aJwt,"POST",{token:campaignToken})).status,200);
  assert.deepEqual({...db.sqlite.prepare("SELECT direct_channel,campaign_id,root_campaign_id FROM account_attribution WHERE account_id=?").get(aId) as object},
    {direct_channel:"society",campaign_id:campaignId,root_campaign_id:campaignId});
  assert.equal((await call("/v1/friends/profile",aJwt,"PATCH",{name:"Alice",expectedRevision:0})).status,200);
  const aInvite=await (await call("/v1/friends/invitation",aJwt,"POST",{})).json() as {id:string;url:string};
  const aReferral=new URLSearchParams(new URL(aInvite.url).hash.slice(1)).get("invite")!;
  assert.equal((await call("/v1/access/redeem",aJwt,"POST",{token:aReferral})).status,409);
  assert.equal((await call("/v1/friends/request",aJwt,"POST",{token:aReferral})).status,409);

  const bId=(await (await call("/v1/session",bJwt)).json() as {accountId:string}).accountId;
  const bRedeem=await call("/v1/access/redeem",bJwt,"POST",{token:aReferral});
  assert.equal(bRedeem.status,200);
  assert.equal((await bRedeem.json() as {invitation:{kind:string;referrer:{name:string}}}).invitation.referrer.name,"Alice");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM friendships").get()?.n,0,"registration must not create a friendship");
  assert.deepEqual({...db.sqlite.prepare("SELECT direct_channel,referrer_account_id,root_campaign_id FROM account_attribution WHERE account_id=?").get(bId) as object},
    {direct_channel:"friend_referral",referrer_account_id:aId,root_campaign_id:campaignId});
  assert.equal((await call("/v1/friends/request",bJwt,"POST",{token:aReferral})).status,409,"a display name is required before consent");
  assert.equal((await call("/v1/friends/profile",bJwt,"PATCH",{name:"Bob",expectedRevision:0})).status,200);
  assert.equal((await call("/v1/friends/request",bJwt,"POST",{token:aReferral})).status,200);
  assert.equal((await call("/v1/friends/request",bJwt,"POST",{token:aReferral})).status,200,"duplicate requests are idempotent");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM friendships").get()?.n,1);
  let aFriends=await (await call("/v1/friends",aJwt)).json() as {friends:{connectionId:string;revision:number;state:string}[]};
  assert.equal(aFriends.friends[0].state,"incoming");
  assert.equal((await call("/v1/friends/action",aJwt,"POST",{connectionId:aFriends.friends[0].connectionId,expectedRevision:aFriends.friends[0].revision,operation:"accept"})).status,200);
  assert.equal(((await (await call("/v1/friends",bJwt)).json() as {friends:{state:string}[]}).friends[0].state),"accepted");

  const bInvite=await (await call("/v1/friends/invitation",bJwt,"POST",{})).json() as {id:string;url:string};
  const bReferral=new URLSearchParams(new URL(bInvite.url).hash.slice(1)).get("invite")!;
  const cId=(await (await call("/v1/session",cJwt)).json() as {accountId:string}).accountId;
  assert.equal((await call("/v1/access/redeem",cJwt,"POST",{token:bReferral})).status,200);
  assert.deepEqual({...db.sqlite.prepare("SELECT direct_channel,referrer_account_id,root_campaign_id FROM account_attribution WHERE account_id=?").get(cId) as object},
    {direct_channel:"friend_referral",referrer_account_id:bId,root_campaign_id:campaignId});
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM friendships WHERE account_a=? OR account_b=?").get(cId,cId)?.n,0);

  // An enrolled account may use an exhausted referral for friendship without
  // consuming or replacing acquisition attribution.
  const privateToken="K".repeat(43);await addInvitation(db,privateToken);
  const dId=(await (await call("/v1/session",dJwt)).json() as {accountId:string}).accountId;
  assert.equal((await call("/v1/access/redeem",dJwt,"POST",{token:privateToken})).status,200);
  await call("/v1/friends/profile",dJwt,"PATCH",{name:"Dana",expectedRevision:0});
  db.sqlite.prepare("UPDATE access_invitations SET max_redemptions=redemption_count WHERE id=?").run(bInvite.id);
  assert.equal((await call("/v1/access/invitation",undefined,"POST",{token:bReferral})).status,200);
  const existing=await call("/v1/access/redeem",dJwt,"POST",{token:bReferral});
  assert.equal(existing.status,200);assert.equal((await existing.json() as {alreadyEnrolled:boolean}).alreadyEnrolled,true);
  assert.equal((await call("/v1/friends/request",dJwt,"POST",{token:bReferral})).status,200);
  assert.equal(db.sqlite.prepare("SELECT direct_channel FROM account_attribution WHERE account_id=?").get(dId)?.direct_channel,"private_invitation");
  const publicFriends=JSON.stringify(await (await call("/v1/friends",bJwt)).json());
  assert.equal(/account_id|referrer_account_id|root_campaign_id|campaign_id/.test(publicFriends),false);
  assert.equal(db.sqlite.prepare("SELECT redemption_count FROM access_invitations WHERE id=?").get(bInvite.id)?.redemption_count,1);
});

test("Today plans isolate accounts, preserve the restore point and reject racing or invalid writes", async t => {
  const {db,call} = setup(t);
  const a=await token(), b=await token(bob);
  const url="/v1/today/plan";
  assert.equal((await call(url)).status,401);
  assert.equal((await call(url,b)).status,403);
  for(const jwt of [a,b]) {
    const owner=(await (await call("/v1/session",jwt)).json() as {accountId:string}).accountId;
    db.sqlite.prepare("INSERT INTO backup_trial_members VALUES (?)").run(owner);
    assert.equal((await call(url,jwt)).status,404);
    db.sqlite.prepare("INSERT INTO backup_trial_snapshots VALUES (?,?,?,?)").run(owner,"a".repeat(64),"{}", "example");
  }
  const task={id:"mine",title:"Review material",plannedFor:"2026-11-02",createdAt:1};
  const write=(expectedRevision:number,tasks:unknown[])=>call(url,a,"PATCH",{expectedRevision,tasks});
  assert.deepEqual(await (await call(url,a)).json(),{revision:0,tasks:[]});
  const races=await Promise.all([write(0,[task]),write(0,[task])]);
  assert.deepEqual(races.map(x=>x.status).sort(),[200,409]);
  assert.equal((await write(1,[{...task,plannedFor:"2026-02-30"}])).status,400);
  assert.equal((await write(1,[task,task])).status,400);
  assert.deepEqual(await (await write(1,[{...task,completedAt:2}])).json(),{revision:2,tasks:[{...task,completedAt:2}]});
  assert.equal((await write(1,[])).status,409);
  assert.deepEqual(await (await call(url,b)).json(),{revision:0,tasks:[]});
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM backup_trial_snapshots WHERE data='{}'").get()?.n,2);
});

test("occurrence completion is independent of preparation, scoped, reversible, and preserves the restore point", async t=>{
  const {call,db}=setup(t);
  const a=await token(), b=await token(bob);
  const id="COMP3888:demo/1";
  const board={year:2026,session:"S2C",feedUrl:"",importedAt:"test",classes:[],warnings:[],completed:{},
    weeks:[{id:"13",label:"Week 13",start:"2026-11-02",end:"2026-11-08",kind:"teaching"}],
    units:[{code:"COMP3888",name:"Test",session:"S2C",outline:"",status:"",summary:"",assessments:[],topics:[]}],
    tasks:[{id,unit:"COMP3888",kind:"task",title:"Demo",date:"2026-11-03",time:"12:00",timing:"During workshop",weight:"",description:"",source:"",sourceText:""}]};
  const api="/v1/imported/completion", plan="/v1/today/plan";
  const write=(jwt:string,done:boolean,expectedRevision:number)=>call(api,jwt,"PATCH",{id,done,expectedRevision});
  assert.equal((await write(b,true,0)).status,403);
  const url=async (jwt:string)=>{
    const {accountId}=await (await call("/v1/session",jwt)).json() as {accountId:string};
    db.sqlite.prepare("INSERT INTO backup_trial_members VALUES (?)").run(accountId);
    const path="/v1/backup-trial/"+accountId;
    assert.equal((await call(path,jwt,"POST",board)).status,201);
    return path;
  };
  const restore=await url(a);
  await url(b);
  const read=async (jwt:string)=>(await (await call("/v1/imported/assessments",jwt)).json() as {rows:{id:string;done:boolean;completionRevision:number}[]}).rows[0];
  const preparation={id:"rehearsal",title:"Rehearse Demo",plannedFor:"2026-11-02",createdAt:1,completedAt:2,sourceKey:JSON.stringify([2026,"S2C",id])};
  assert.equal((await call(plan,a,"PATCH",{expectedRevision:0,tasks:[preparation]})).status,200);
  const originalPlan=await (await call(plan,a)).text();
  assert.equal((await read(a)).done,false);
  assert.equal((await call(api,a,"PATCH",{id:"missing",done:true,expectedRevision:0})).status,404);
  assert.equal((await call(api,a,"PATCH",{id,done:true,expectedRevision:0,owner:"other"})).status,400);
  assert.equal((await call(api,undefined,"PATCH",{id,done:true,expectedRevision:0})).status,401);
  const attempts=await Promise.all([write(a,true,0),write(a,true,0)]);
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
  assert.equal((await read(a)).done,true);
  assert.equal((await read(a)).completionRevision,1);
  assert.equal((await read(b)).done,false);
  assert.equal(await (await call(plan,a)).text(),originalPlan);
  assert.equal((await write(a,false,0)).status,409);
  assert.equal((await write(a,false,1)).status,200);
  assert.equal((await read(a)).done,false);
  assert.equal((await read(a)).completionRevision,2);
  assert.equal(await (await call(plan,a)).text(),originalPlan);
  assert.equal(await (await call(restore,a)).text(),JSON.stringify(board));
});

test("a newer website export preserves progress; a full restore recovers it without reviving stale writes", async t=>{
  const {db,call}=setup(t);
  const a=await token(), b=await token(bob);
  const owner=(await (await call("/v1/session",a)).json() as {accountId:string}).accountId;
  const other=(await (await call("/v1/session",b)).json() as {accountId:string}).accountId;
  for(const id of [owner,other])db.sqlite.prepare("INSERT INTO backup_trial_members VALUES (?)").run(id);
  const route="/v1/recovery/"+owner;
  const read=async()=>await (await call(route,a)).json() as import("../../recovery.ts").Current;
  const restore=(file:unknown,expectedVersion:number)=>call(route,a,"POST",{expectedVersion,file:JSON.stringify(file)});
  const quiz={id:"quiz",unit:"UNIT101",title:"Quiz",kind:"quiz",weight:"15%",timing:"During tutorial",description:"",source:"",sourceText:""};
  const base={year:2026,session:"S2C",feedUrl:"",importedAt:"source",warnings:[],completed:{legacy:true},classes:[],
    weeks:[{id:"w13",label:"Week 13",kind:"teaching",start:"2026-11-02",end:"2026-11-08"}],
    units:[{code:quiz.unit,name:"Unit",session:"S2C",outline:"",status:"",summary:"",assessments:[],topics:[]}],tasks:[quiz]};
  assert.deepEqual(await read(),{backup:null,version:0});
  assert.equal((await restore(base,0)).status,200);
  const original=await read();
  assert.equal((await call(route,b)).status,403);
  assert.equal((await call("/v1/recovery/"+other,b,"POST",{expectedVersion:0,file:JSON.stringify(original.backup)})).status,400);
  const task={id:"prep",title:"Practice",createdAt:1,plannedFor:"2026-11-03",sourceKey:JSON.stringify([2026,"S2C",quiz.id])};
  const plan=(expectedRevision:number,tasks:unknown[])=>call("/v1/today/plan",a,"PATCH",{expectedRevision,tasks});
  const mark=(expectedRevision:number,done:boolean)=>call("/v1/imported/completion",a,"PATCH",{expectedRevision,done,id:quiz.id});
  assert.equal((await plan(0,[task])).status,200);
  assert.equal((await mark(0,true)).status,200);
  const parts=[{id:"first",name:"Attempt 1",grade:{earned:4,possible:15}},{id:"second",name:"Attempt 2"}];
  const mapping={key:"1:2:3",targetId:quiz.id,mode:"part",rule:{method:"highest",count:2},
    attemptItemId:"first",lastItem:parts[0],sourceRules:"reviewed"};
  const updated={...base,canvasAccountId:"1",canvasImports:[mapping],tasks:[{...quiz,gradePlan:{method:"highest",mode:"parts",items:parts}},
    ...parts.map((part,i)=>({...quiz,id:part.id,title:part.name,parentId:quiz.id,attemptId:part.id,weight:"",date:i?"2026-11-04":"2026-10-28",time:"12:00",week:i?13:12}))]};
  assert.equal((await restore(updated,original.version)).status,409);
  const withProgress=await read();
  assert.equal((await restore({...updated,canvasImports:[{...mapping,attemptItemId:"second"}]},withProgress.version)).status,400);
  assert.equal((await restore({...updated,canvasImports:[mapping,{...mapping,key:"1:2:4"}]},withProgress.version)).status,400);
  assert.equal((await restore({...base,tasks:[]},withProgress.version)).status,400);
  assert.deepEqual(await read(),withProgress);
  const races=await Promise.all([restore(updated,withProgress.version),restore(updated,withProgress.version)]);
  assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
  const saved=await read();
  assert.equal(saved.backup!.snapshot.originalJson,JSON.stringify(updated));
  assert.deepEqual(saved.backup!.todayPlan,withProgress.backup!.todayPlan);
  assert.deepEqual(saved.backup!.completion,withProgress.backup!.completion);
  assert.equal(await (await call("/v1/backup-trial/"+owner,a)).text(),JSON.stringify(base));
  const tampered={...saved.backup,snapshot:{...saved.backup!.snapshot,originalJson:JSON.stringify(base)}};
  assert.equal((await restore(tampered,saved.version)).status,400);
  assert.equal((await restore(original.backup,saved.version)).status,200);
  const reset=await read();
  assert.equal(reset.backup!.snapshot.originalJson,JSON.stringify(base));
  assert.deepEqual(reset.backup!.completion,[]);
  assert.deepEqual(reset.backup!.todayPlan!.tasks,[]);
  assert.equal((await mark(1,false)).status,409);
  assert.equal((await plan(1,[])).status,409);
  assert.equal((await restore(saved.backup,reset.version)).status,200);
  const again=await read();
  assert.deepEqual(again.backup!.todayPlan!.tasks,[task]);
  assert.equal(again.backup!.completion[0].done,1);
  const projected=await (await call("/v1/imported/assessments",a)).json() as import("../../../lib/imported-assessments.ts").ImportedAssessments;
  assert.deepEqual(projected.grades[0].parts.map(p=>p.mark),[{earned:4,possible:15},null]);
  assert.equal(projected.rows.find(row=>row.id==="second")?.date,"2026-11-04");
  assert.equal(projected.rows.find(row=>row.id==="quiz")?.done,true);
});

test("the original web board and phone share occurrence revisions without replacing backups or Today tasks",async t=>{
  const {call,db}=setup(t), web="/v1/imported/board", phone="/v1/imported/completion";
  const a=await token(), b=await token(bob);
  const {accountId}=await (await call("/v1/session",a)).json() as {accountId:string};
  assert.equal((await call(web,b)).status,403);
  db.sqlite.prepare("INSERT INTO backup_trial_members VALUES (?)").run(accountId);
  const {pilotDemo}=await import("../../web/src/pilot-demo.ts");
  const board=pilotDemo(new Date("2026-11-02T01:00:00Z"));
  const id=board.tasks[0].id, file=JSON.stringify(board,null,2);
  const recovery="/v1/recovery/"+accountId;
  assert.equal((await call(recovery,a,"POST",{file,expectedVersion:0})).status,200);
  const plan={id:"p",title:"Draft",plannedFor:"2026-11-02",createdAt:1,sourceKey:JSON.stringify([2026,"S2C",id])};
  assert.equal((await call("/v1/today/plan",a,"PATCH",{expectedRevision:0,tasks:[plan]})).status,200);
  const read=async ()=>(await (await call(web,a)).json()) as {revision:number;semester:typeof board};
  const state=await read();
  state.semester.tasks[0].done=true;
  const save=await call(web,a,"PUT",state);
  assert.equal(save.status,200);
  const revision=(await save.json() as {revision:number}).revision;
  assert.equal((await read()).revision,revision);
  const rows=(await (await call("/v1/imported/assessments",a)).json() as {rows:{id:string;done:boolean;completionRevision:number}[]}).rows;
  const row=rows.find(item=>item.id===id)!;
  assert.equal(row.done,true);
  assert.equal((await call(phone,a,"PATCH",{id,done:false,expectedRevision:row.completionRevision})).status,200);
  assert.equal((await call(web,a,"PUT",{...state,revision})).status,409);
  const refreshed=await read();
  assert.equal(refreshed.semester.tasks[0].done,false);
  refreshed.semester.tasks[0].title="Updated on web";
  assert.equal((await call(web,a,"PUT",refreshed)).status,200);
  assert.equal((await read()).semester.tasks[0].title,"Updated on web");
  assert.equal((await (await call("/v1/backup-trial/"+accountId,a)).text()),file);
  assert.deepEqual((await (await call("/v1/today/plan",a)).json() as {tasks:unknown[]}).tasks,[plan]);
  assert.equal((await call(web,b,"PUT",refreshed)).status,403);
});
