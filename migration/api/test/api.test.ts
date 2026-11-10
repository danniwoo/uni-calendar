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
    this.sqlite.exec(readFileSync(new URL("../migrations/0008_admin_growth.sql", import.meta.url), "utf8"));
    this.sqlite.exec(readFileSync(new URL("../migrations/0009_growth_analytics.sql", import.meta.url), "utf8"));
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

test("analytics migration preserves the root distribution link for an existing A to B to C chain",t=>{
  const sqlite=new DatabaseSync(":memory:");t.after(()=>sqlite.close());sqlite.exec("PRAGMA foreign_keys=ON");
  for(const name of ["0001_pilot.sql","0002_backup_trial.sql","0003_today_plans.sql","0004_imported_completion.sql","0005_recovery.sql",
    "0006_invitation_access.sql","0007_growth_referrals.sql","0008_admin_growth.sql"])
    sqlite.exec(readFileSync(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
  const ids=["10000000-0000-4000-8000-000000000001","10000000-0000-4000-8000-000000000002","10000000-0000-4000-8000-000000000003"];
  const invitations=["20000000-0000-4000-8000-000000000001","20000000-0000-4000-8000-000000000002","20000000-0000-4000-8000-000000000003"];
  const campaign="30000000-0000-4000-8000-000000000001",stamp="2026-10-01T00:00:00.000Z";
  for(const id of ids)sqlite.prepare("INSERT INTO pilot_accounts(id,created_at) VALUES (?,?)").run(id,stamp);
  sqlite.prepare(`INSERT INTO growth_campaigns(id,campaign_key,name,channel,created_at,starts_at,max_redemptions,redemption_count,updated_at)
    VALUES (?,'ROOT-CHAIN','Root Chain','society',?,?,10,3,?)`).run(campaign,stamp,stamp,stamp);
  for(const [index,id] of invitations.entries())sqlite.prepare(`INSERT INTO access_invitations
    (id,kind,token_hash,label,max_redemptions,redemption_count,expires_at,created_at)
    VALUES (?,?,?, ?,10,1,'2099-01-01T00:00:00.000Z',?)`).run(id,index===0?"campaign":"friend_referral",String(index+1).repeat(64),`link-${index}`,stamp);
  sqlite.prepare("INSERT INTO invitation_contexts(invitation_id,campaign_id) VALUES (?,?)").run(invitations[0],campaign);
  sqlite.prepare("INSERT INTO invitation_contexts(invitation_id,inviter_account_id) VALUES (?,?)").run(invitations[1],ids[0]);
  sqlite.prepare("INSERT INTO invitation_contexts(invitation_id,inviter_account_id) VALUES (?,?)").run(invitations[2],ids[1]);
  sqlite.prepare("INSERT INTO campaign_distribution_links(invitation_id,campaign_id,label,channel,source,created_at) VALUES (?,?,'Root','society','SYNCS',?)").run(invitations[0],campaign,stamp);
  sqlite.prepare(`INSERT INTO account_attribution(account_id,direct_channel,campaign_id,acquisition_invitation_id,root_campaign_id,acquired_at)
    VALUES (?,'society',?,?,?,?)`).run(ids[0],campaign,invitations[0],campaign,stamp);
  sqlite.prepare(`INSERT INTO account_attribution(account_id,direct_channel,acquisition_invitation_id,referrer_account_id,root_campaign_id,acquired_at)
    VALUES (?,'friend_referral',?,?,?,?)`).run(ids[1],invitations[1],ids[0],campaign,stamp);
  sqlite.prepare(`INSERT INTO account_attribution(account_id,direct_channel,acquisition_invitation_id,referrer_account_id,root_campaign_id,acquired_at)
    VALUES (?,'friend_referral',?,?,?,?)`).run(ids[2],invitations[2],ids[1],campaign,stamp);
  sqlite.exec(readFileSync(new URL("../migrations/0009_growth_analytics.sql",import.meta.url),"utf8"));
  assert.deepEqual(sqlite.prepare("SELECT root_acquisition_invitation_id root FROM account_attribution ORDER BY account_id").all().map(row=>({...row})),
    invitations.map(()=>({root:invitations[0]})));
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM analytics_events").get()?.n,0,"migration must not invent historical activity");
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
  assert.equal(db.sqlite.prepare("SELECT period_key FROM analytics_semester_usage WHERE account_id=?").get(account)?.period_key,"2026:S2C");
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
  db.sqlite.prepare("INSERT INTO growth_campaigns(id,campaign_key,name,channel,created_at,revoked_at,starts_at,updated_at) VALUES (?,? ,?,'society',?,NULL,?,?)")
    .run(campaignId,"SYNCS-2027S1","SYNCS 2027 S1",created,created,created);
  db.sqlite.prepare(`INSERT INTO access_invitations(id,kind,token_hash,label,max_redemptions,redemption_count,expires_at,created_at)
    VALUES (?,'campaign',?,'SYNCS',100,0,'2099-01-01T00:00:00.000Z',?)`).run(campaignInvite,await invitationHash(campaignToken),created);
  db.sqlite.prepare("INSERT INTO invitation_contexts(invitation_id,campaign_id) VALUES (?,?)").run(campaignInvite,campaignId);

  const campaignPreview=await (await call("/v1/access/invitation",undefined,"POST",{token:campaignToken})).json() as {kind:string;campaign:{key:string}};
  assert.equal(campaignPreview.kind,"campaign");assert.equal(campaignPreview.campaign.key,"SYNCS-2027S1");
  const aId=(await (await call("/v1/session",aJwt)).json() as {accountId:string}).accountId;
  assert.equal((await call("/v1/access/redeem",aJwt,"POST",{token:campaignToken})).status,200);
  assert.deepEqual({...db.sqlite.prepare("SELECT direct_channel,campaign_id,root_campaign_id,root_acquisition_invitation_id FROM account_attribution WHERE account_id=?").get(aId) as object},
    {direct_channel:"society",campaign_id:campaignId,root_campaign_id:campaignId,root_acquisition_invitation_id:campaignInvite});
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
  assert.deepEqual({...db.sqlite.prepare("SELECT direct_channel,referrer_account_id,root_campaign_id,root_acquisition_invitation_id FROM account_attribution WHERE account_id=?").get(bId) as object},
    {direct_channel:"friend_referral",referrer_account_id:aId,root_campaign_id:campaignId,root_acquisition_invitation_id:campaignInvite});
  assert.equal((await call("/v1/friends/request",bJwt,"POST",{token:aReferral})).status,409,"a display name is required before consent");
  assert.equal((await call("/v1/friends/profile",bJwt,"PATCH",{name:"Bob",expectedRevision:0})).status,200);
  assert.equal((await call("/v1/friends/request",bJwt,"POST",{token:aReferral})).status,200);
  assert.equal((await call("/v1/friends/request",bJwt,"POST",{token:aReferral})).status,200,"duplicate requests are idempotent");
  assert.equal(db.sqlite.prepare("SELECT event_count FROM analytics_activity_days WHERE account_id=? AND feature='friends'").get(bId)?.event_count,1,
    "idempotent retries must not inflate product-activity counts");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM friendships").get()?.n,1);
  let aFriends=await (await call("/v1/friends",aJwt)).json() as {friends:{connectionId:string;revision:number;state:string}[]};
  assert.equal(aFriends.friends[0].state,"incoming");
  assert.equal((await call("/v1/friends/action",aJwt,"POST",{connectionId:aFriends.friends[0].connectionId,expectedRevision:aFriends.friends[0].revision,operation:"accept"})).status,200);
  assert.equal(((await (await call("/v1/friends",bJwt)).json() as {friends:{state:string}[]}).friends[0].state),"accepted");

  const bInvite=await (await call("/v1/friends/invitation",bJwt,"POST",{})).json() as {id:string;url:string};
  const bReferral=new URLSearchParams(new URL(bInvite.url).hash.slice(1)).get("invite")!;
  const cId=(await (await call("/v1/session",cJwt)).json() as {accountId:string}).accountId;
  assert.equal((await call("/v1/access/redeem",cJwt,"POST",{token:bReferral})).status,200);
  assert.deepEqual({...db.sqlite.prepare("SELECT direct_channel,referrer_account_id,root_campaign_id,root_acquisition_invitation_id FROM account_attribution WHERE account_id=?").get(cId) as object},
    {direct_channel:"friend_referral",referrer_account_id:bId,root_campaign_id:campaignId,root_acquisition_invitation_id:campaignInvite});
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

async function enrolledAccount(call:ReturnType<typeof setup>["call"],db:SQLiteDatabase,jwt:string) {
  const accountId=(await (await call("/v1/session",jwt)).json() as {accountId:string}).accountId;
  db.sqlite.prepare("INSERT INTO backup_trial_members VALUES (?) ON CONFLICT DO NOTHING").run(accountId);
  await call("/v1/session",jwt);
  return accountId;
}

test("admin APIs require an active explicitly provisioned D1 role and leak no academic data",async t=>{
  const {call,db}=setup(t),adminJwt=await token(alice),studentJwt=await token(bob);
  const adminId=await enrolledAccount(call,db,adminJwt),studentId=await enrolledAccount(call,db,studentJwt);
  assert.equal((await call("/v1/admin")).status,401);
  assert.equal((await call("/v1/admin",studentJwt)).status,403);
  assert.equal((await call("/v1/admin",await token(bob,{user_metadata:{role:"owner"},app_metadata:{role:"owner"}}))).status,403);
  assert.equal((await call("/v1/admin/roles",studentJwt,"POST",{accountId:studentId,role:"owner"})).status,404);
  db.sqlite.prepare("INSERT INTO admin_roles(account_id,role,granted_at) VALUES (?,'owner',?)").run(adminId,"2026-11-10T00:00:00Z");
  db.sqlite.prepare("INSERT INTO pilot_boards(account_id,data,revision,updated_at) VALUES (?,?,1,?)")
    .run(studentId,JSON.stringify({privateGrade:99,notes:"secret academic text"}),"2026-11-10T00:00:00Z");
  const response=await call("/v1/admin",adminJwt);assert.equal(response.status,200);
  const text=await response.text();assert.equal(text.includes("secret academic text"),false);assert.equal(text.includes("privateGrade"),false);
  assert.equal((await call("/v1/admin/session",adminJwt)).status,200);
  const secondAdminId=studentId;
  db.sqlite.prepare("INSERT INTO admin_roles(account_id,role,granted_at) VALUES (?,'admin',?)").run(secondAdminId,"2026-11-10T00:00:00Z");
  const protectedAccess=db.sqlite.prepare("SELECT updated_at FROM account_access WHERE account_id=?").get(secondAdminId) as {updated_at:string};
  assert.equal((await call("/v1/admin/users/access",adminJwt,"POST",{accountId:secondAdminId,operation:"suspend",expectedUpdatedAt:protectedAccess.updated_at})).status,403);
  db.sqlite.prepare(`INSERT INTO admin_audit_log(id,admin_account_id,action,target_type,result,created_at)
    VALUES (?,?,?,?,?,?)`).run("audit-immutable",adminId,"test.recorded","test","success","2026-11-10T00:00:00Z");
  assert.throws(()=>db.sqlite.prepare("UPDATE admin_audit_log SET action='test.changed' WHERE id='audit-immutable'").run(),/append-only/);
  assert.throws(()=>db.sqlite.prepare("DELETE FROM admin_audit_log WHERE id='audit-immutable'").run(),/append-only/);
  db.sqlite.prepare("UPDATE account_access SET state='suspended' WHERE account_id=?").run(adminId);
  assert.equal((await call("/v1/admin",adminJwt)).status,403,"a suspended admin loses authority even with a valid JWT");
});

test("prospective landing and authentication tracking is token-safe, tab-scoped and idempotent",async t=>{
  const {call,db}=setup(t),raw="Q".repeat(43),visitId="tabScopedVisitId123456",eventId=crypto.randomUUID(),jwt=await token(bob);
  assert.equal(visitId.length,22);await addInvitation(db,raw);
  const first=await call("/v1/analytics/landing",undefined,"POST",{token:raw,visitId,eventId});
  assert.equal(first.status,202);assert.equal((await first.json() as {accepted:boolean;visitor:string}).accepted,true);
  const duplicate=await call("/v1/analytics/landing",undefined,"POST",{token:raw,visitId,eventId:crypto.randomUUID()});
  assert.equal(duplicate.status,202);assert.equal((await duplicate.json() as {accepted:boolean}).accepted,false);
  assert.equal((await call("/v1/analytics/landing",undefined,"POST",{token:"R".repeat(43),visitId,eventId:crypto.randomUUID()})).status,404);
  const landing=db.sqlite.prepare("SELECT * FROM analytics_events WHERE event_name='invitation_landing'").get() as Record<string,unknown>;
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_name='invitation_landing'").get()?.n,1);
  assert.notEqual(landing.visitor_hash,visitId);assert.equal(JSON.stringify(landing).includes(raw),false,"raw invitation tokens must never be retained");
  assert.equal((await call("/v1/analytics/session",undefined,"POST",{visitId})).status,401);
  const authenticated=await call("/v1/analytics/session",jwt,"POST",{visitId});assert.equal(authenticated.status,202);
  assert.equal((await authenticated.json() as {accepted:boolean}).accepted,true);
  assert.equal((await (await call("/v1/analytics/session",jwt,"POST",{visitId})).json() as {accepted:boolean}).accepted,false);
  const session=await (await call("/v1/session",jwt)).json() as {accountId:string;access:{state:string}};
  assert.equal(session.access.state,"none","analytics authentication mapping must not grant Semester enrolment");
  assert.equal(db.sqlite.prepare("SELECT invitation_id FROM analytics_events WHERE event_name='auth_completed'").get()?.invitation_id,landing.invitation_id);
});

test("admin analytics measures mature campaign, retention and A to B to C referral ancestry without exposing small cohorts",async t=>{
  const {call,db}=setup(t),adminJwt=await token(alice),studentJwt=await token(bob);
  const adminId=await enrolledAccount(call,db,adminJwt);await enrolledAccount(call,db,studentJwt);
  db.sqlite.prepare("INSERT INTO admin_roles(account_id,role,granted_at) VALUES (?,'owner',?)").run(adminId,"2026-10-01T00:00:00.000Z");
  assert.equal((await call("/v1/admin/analytics")).status,401);assert.equal((await call("/v1/admin/analytics",studentJwt)).status,403);
  const created=await call("/v1/admin/campaigns",adminJwt,"POST",{key:"SYNCS-ANALYTICS",name:"SYNCS Analytics",societyId:"SYNCS",
    startsAt:null,maxRedemptions:20,distribution:{label:"SYNCS Workshop",channel:"society",source:"syncs_workshop",format:"workshop",placement:"welcome_week",creativeId:"workshop_01",maxRedemptions:20,expiryHours:720}});
  assert.equal(created.status,201);const campaign=await created.json() as {campaignId:string;invitationId:string;url:string};
  const campaignToken=new URLSearchParams(new URL(campaign.url).hash.slice(1)).get("invite")!;
  const subjects=Array.from({length:5},(_,index)=>`60000000-0000-4000-8000-00000000000${index+1}`),direct:{id:string;jwt:string}[]=[];
  for(const [index,subject] of subjects.entries()) {
    const jwt=await token(subject),visitId=`analyticsVisitId00000${index}`;
    assert.equal(visitId.length,22);
    await call("/v1/analytics/landing",undefined,"POST",{token:campaignToken,visitId,eventId:crypto.randomUUID()});
    const id=(await (await call("/v1/session",jwt)).json() as {accountId:string}).accountId;
    await call("/v1/analytics/session",jwt,"POST",{visitId});
    assert.equal((await call("/v1/access/redeem",jwt,"POST",{token:campaignToken})).status,200);direct.push({id,jwt});
  }
  await call("/v1/friends/profile",direct[0].jwt,"PATCH",{name:"Root A",expectedRevision:0});
  const aLink=await (await call("/v1/friends/invitation",direct[0].jwt,"POST",{})).json() as {url:string};
  const aToken=new URLSearchParams(new URL(aLink.url).hash.slice(1)).get("invite")!,bJwt=await token("70000000-0000-4000-8000-000000000001");
  const bId=(await (await call("/v1/session",bJwt)).json() as {accountId:string}).accountId;
  assert.equal((await call("/v1/access/redeem",bJwt,"POST",{token:aToken})).status,200);
  await call("/v1/friends/profile",bJwt,"PATCH",{name:"Referral B",expectedRevision:0});
  const bLink=await (await call("/v1/friends/invitation",bJwt,"POST",{})).json() as {url:string};
  const bToken=new URLSearchParams(new URL(bLink.url).hash.slice(1)).get("invite")!,cJwt=await token("70000000-0000-4000-8000-000000000002");
  const cId=(await (await call("/v1/session",cJwt)).json() as {accountId:string}).accountId;
  assert.equal((await call("/v1/access/redeem",cJwt,"POST",{token:bToken})).status,200);
  const descendants=db.sqlite.prepare("SELECT account_id,root_acquisition_invitation_id root FROM account_attribution WHERE account_id IN (?,?)").all(bId,cId) as {account_id:string;root:string}[];
  assert.deepEqual(new Set(descendants.map(row=>row.account_id)),new Set([bId,cId]));
  assert.equal(descendants.every(row=>row.root===campaign.invitationId),true);

  const activated="2026-10-01T10:00:00.000Z",activationDay="2026-10-01",returnDay="2026-10-15",all=[...direct.map(row=>row.id),bId,cId];
  for(const id of all) {
    db.sqlite.prepare("UPDATE account_attribution SET acquired_at='2026-10-01T09:00:00.000Z' WHERE account_id=?").run(id);
    db.sqlite.prepare(`INSERT INTO analytics_activity_days(account_id,activity_date,feature,activity_kind,first_at,last_at,event_count)
      VALUES (?,?,'semester_import','meaningful',?,?,1)`).run(id,activationDay,activated,activated);
  }
  for(const id of direct.slice(0,3).map(row=>row.id))db.sqlite.prepare(`INSERT INTO analytics_activity_days(account_id,activity_date,feature,activity_kind,first_at,last_at,event_count)
    VALUES (?,?,'today_plan','meaningful','2026-10-15T10:00:00.000Z','2026-10-15T10:00:00.000Z',2)`).run(id,returnDay);
  for(const id of direct.map(row=>row.id))for(const period of ["2026:S1","2026:S2"])db.sqlite.prepare(`INSERT INTO analytics_semester_usage(account_id,period_key,first_at,last_at)
    VALUES (?,?,?,?)`).run(id,period,activated,activated);
  const immature=await (await call("/v1/admin/analytics?from=2026-09-01&to=2026-10-15&campaign=SYNCS-ANALYTICS",adminJwt)).json() as any;
  assert.equal(immature.performance[0].week2Eligible,0,"Week-2 is not eligible until its full seven-day window has elapsed");
  const response=await call("/v1/admin/analytics?from=2026-09-01&to=2026-11-11&campaign=SYNCS-ANALYTICS",adminJwt);
  assert.equal(response.status,200);const report=await response.json() as any,row=report.performance[0];
  assert.deepEqual({landing:row.landingVisits,auth:row.authenticated,joins:row.directJoins,activated:row.activated,w2Eligible:row.week2Eligible,w2Retained:row.week2Retained,descendants:row.downstreamDescendants,activatedDescendants:row.activatedDescendants},
    {landing:5,auth:5,joins:5,activated:5,w2Eligible:5,w2Retained:3,descendants:2,activatedDescendants:2});
  assert.equal(row.week2RetentionRate,0.6);assert.equal(row.referralAmplification,0.4);
  assert.deepEqual({enrolled:report.funnel.enrolled,activated:report.funnel.activated,w2Eligible:report.funnel.week2Eligible,w2Retained:report.funnel.week2Retained},
    {enrolled:5,activated:5,w2Eligible:5,w2Retained:3},"campaign filters must apply consistently to funnel cohorts");
  assert.equal(report.cohorts[0].privacySuppressed,false);assert.equal(report.cohorts[0].week2.rate,0.6);
  assert.deepEqual({available:report.crossSemester.available,periods:report.crossSemester.periods,accounts:report.crossSemester.accounts},{available:true,periods:2,accounts:5});
  assert.equal((await (await call("/v1/admin/analytics?from=2026-09-01&to=2026-11-11&source=not_this_source",adminJwt)).json() as any).funnel.enrolled,0);
  assert.equal((await call("/v1/admin/analytics?source=bad%25filter",adminJwt)).status,400);
  db.sqlite.prepare("UPDATE analytics_state SET small_cohort_min=6 WHERE id=1").run();
  const protectedReport=await (await call("/v1/admin/analytics?from=2026-09-01&to=2026-11-11&campaign=SYNCS-ANALYTICS",adminJwt)).json() as any;
  assert.equal(protectedReport.performance[0].privacySuppressed,true);assert.equal(protectedReport.performance[0].directJoins,null);
  assert.equal(protectedReport.cohorts[0].privacySuppressed,true);assert.equal(protectedReport.cohorts[0].cohortSize,null);
  assert.equal(protectedReport.adoption.every((item:any)=>item.privacySuppressed),true);
  assert.equal(protectedReport.crossSemester.privacySuppressed,true);assert.equal(protectedReport.crossSemester.accounts,null);
  assert.equal(JSON.stringify(protectedReport).includes("Root A"),false,"analytics responses must not expose friend names or academic content");
});

test("analytics storage failure never blocks an enrolled student's academic mutation",async t=>{
  const {call,db}=setup(t),jwt=await token(dana);await enrolledAccount(call,db,jwt);
  const board=await (await call("/v1/semester/sample",jwt,"POST")).json() as SemesterResponse;
  db.sqlite.exec("DROP TABLE analytics_activity_days");
  const result=await call(`/v1/tasks/${board.semester.tasks[0].id}`,jwt,"PATCH",{completed:true,expectedRevision:1});
  assert.equal(result.status,200);assert.equal((await result.json() as SemesterResponse).semester.tasks[0].completed,true);
});

test("draft policy is inert until revision-protected publish, then pauses only new enrolments",async t=>{
  const {call,db}=setup(t),adminJwt=await token(alice),existingJwt=await token(bob),newJwt=await token(charlie),laterJwt=await token(dana);
  const adminId=await enrolledAccount(call,db,adminJwt);await enrolledAccount(call,db,existingJwt);
  db.sqlite.prepare("INSERT INTO admin_roles(account_id,role,granted_at) VALUES (?,'owner',?)").run(adminId,"2026-11-10T00:00:00Z");
  const initial=await (await call("/v1/admin",adminJwt)).json() as {policy:{published:{version:number};draft:{revision:number;stage:string;policy:Record<string,unknown>}}};
  const paused={...initial.policy.draft.policy,pauseNewEnrolments:true};
  const draft=await call("/v1/admin/policy/draft",adminJwt,"PATCH",{stage:"campus_beta",policy:paused,expectedRevision:initial.policy.draft.revision});
  assert.equal(draft.status,200);
  const beforePublish="L".repeat(43);await addInvitation(db,beforePublish);
  await call("/v1/session",newJwt);assert.equal((await call("/v1/access/redeem",newJwt,"POST",{token:beforePublish})).status,200,"draft cannot affect access");
  const saved=await draft.json() as {published:{version:number};draft:{revision:number}};
  const races=await Promise.all([
    call("/v1/admin/policy/publish",adminJwt,"POST",{expectedDraftRevision:saved.draft.revision,expectedPublishedVersion:saved.published.version,confirm:true}),
    call("/v1/admin/policy/publish",adminJwt,"POST",{expectedDraftRevision:saved.draft.revision,expectedPublishedVersion:saved.published.version,confirm:true}),
  ]);
  assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
  const afterPublish="M".repeat(43);await addInvitation(db,afterPublish);await call("/v1/session",laterJwt);
  assert.equal((await call("/v1/access/redeem",laterJwt,"POST",{token:afterPublish})).status,403);
  assert.notEqual((await call("/v1/imported/board",existingJwt)).status,403,"existing access remains active");
  const dashboard=await (await call("/v1/admin",adminJwt)).json() as {policy:{published:{stage:string};draft:{revision:number};hasDraft:boolean};audit:{action:string}[]};
  assert.equal(dashboard.policy.published.stage,"campus_beta");assert.equal(dashboard.policy.hasDraft,false);
  assert.ok(dashboard.audit.some(row=>row.action==="policy.published"));
  assert.equal(dashboard.audit.filter(row=>row.action==="policy.published").length,1,"a losing concurrent publish must not log success");
  const bad={...paused,enrolmentMode:"public",publicEnrolmentAvailable:true};
  assert.equal((await call("/v1/admin/policy/draft",adminJwt,"PATCH",{stage:"public_access",policy:bad,expectedRevision:dashboard.policy.draft.revision})).status,400);
});

test("the published total enrolment cap admits only one concurrent final account",async t=>{
  const {call,db}=setup(t),adminJwt=await token(alice),firstJwt=await token(bob),secondJwt=await token(charlie);
  const adminId=await enrolledAccount(call,db,adminJwt);
  db.sqlite.prepare("INSERT INTO admin_roles(account_id,role,granted_at) VALUES (?,'owner',?)").run(adminId,"2026-11-10T00:00:00Z");
  const state=await (await call("/v1/admin",adminJwt)).json() as {policy:{published:{version:number};draft:{revision:number;stage:string;policy:Record<string,unknown>}}};
  const capped={...state.policy.draft.policy,totalEnrolmentCap:2};
  const draft=await (await call("/v1/admin/policy/draft",adminJwt,"PATCH",{stage:state.policy.draft.stage,policy:capped,expectedRevision:state.policy.draft.revision})).json() as {published:{version:number};draft:{revision:number}};
  assert.equal((await call("/v1/admin/policy/publish",adminJwt,"POST",{expectedDraftRevision:draft.draft.revision,expectedPublishedVersion:draft.published.version,confirm:true})).status,200);
  const first="N".repeat(43),second="O".repeat(43);await addInvitation(db,first);await addInvitation(db,second);
  await Promise.all([call("/v1/session",firstJwt),call("/v1/session",secondJwt)]);
  const attempts=await Promise.all([
    call("/v1/access/redeem",firstJwt,"POST",{token:first}),
    call("/v1/access/redeem",secondJwt,"POST",{token:second}),
  ]);
  assert.deepEqual(attempts.map(response=>response.status).sort(),[200,409]);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM account_access WHERE state!='deleted'").get()?.n,2);
  assert.equal(db.sqlite.prepare("SELECT SUM(redemption_count) n FROM access_invitations WHERE token_hash IN (?,?)")
    .get(await invitationHash(first),await invitationHash(second))?.n,1);
});

test("admin invitations, distribution campaigns and access actions are audited and policy-bound",async t=>{
  const {call,db}=setup(t),adminJwt=await token(alice),userJwt=await token(bob),campaignUserJwt=await token(charlie);
  const adminId=await enrolledAccount(call,db,adminJwt),userId=await enrolledAccount(call,db,userJwt);
  db.sqlite.prepare("INSERT INTO admin_roles(account_id,role,granted_at) VALUES (?,'owner',?)").run(adminId,"2026-11-10T00:00:00Z");
  const created=await call("/v1/admin/invitations",adminJwt,"POST",{label:"Support pilot",expiryHours:24,maxRedemptions:1});
  assert.equal(created.status,201);const invitation=await created.json() as {id:string;url:string};
  const raw=new URLSearchParams(new URL(invitation.url).hash.slice(1)).get("invite")!;
  const stored=db.sqlite.prepare("SELECT token_hash FROM access_invitations WHERE id=?").get(invitation.id) as {token_hash:string};
  assert.notEqual(stored.token_hash,raw);assert.equal(JSON.stringify(db.sqlite.prepare("SELECT * FROM access_invitations WHERE id=?").get(invitation.id)).includes(raw),false);
  assert.equal((await call("/v1/admin/invitations/revoke",adminJwt,"POST",{id:invitation.id})).status,200);
  assert.equal((await call("/v1/access/invitation",undefined,"POST",{token:raw})).status,410);

  const campaign=await call("/v1/admin/campaigns",adminJwt,"POST",{key:"WELCOME-2027",name:"Welcome Week 2027",societyId:"SYNCS",
    startsAt:null,maxRedemptions:1,distribution:{label:"Instagram Story 01",channel:"organic_social",source:"instagram_personal",format:"story",placement:"story",creativeId:"story_01",maxRedemptions:1,expiryHours:48}});
  assert.equal(campaign.status,201);const campaignResult=await campaign.json() as {campaignId:string;invitationId:string;url:string};
  const campaignToken=new URLSearchParams(new URL(campaignResult.url).hash.slice(1)).get("invite")!;
  const campaignUserId=(await (await call("/v1/session",campaignUserJwt)).json() as {accountId:string}).accountId;
  assert.equal((await call("/v1/access/redeem",campaignUserJwt,"POST",{token:campaignToken})).status,200);
  assert.equal(db.sqlite.prepare("SELECT direct_channel FROM account_attribution WHERE account_id=?").get(campaignUserId)?.direct_channel,"organic_social");
  assert.equal(db.sqlite.prepare("SELECT redemption_count FROM growth_campaigns WHERE id=?").get(campaignResult.campaignId)?.redemption_count,1);
  assert.equal((await call("/v1/admin/campaign-links",adminJwt,"POST",{campaignId:campaignResult.campaignId,distribution:{label:"Second",channel:"society",source:"SYNCS",format:"post",placement:"feed",creativeId:null,maxRedemptions:1,expiryHours:24}})).status,409);

  const dashboard=await (await call("/v1/admin",adminJwt)).json() as {campaigns:{id:string;status:string}[];users:{account_id:string;updated_at:string;state:string;direct_channel?:string;acquisition_label?:string;acquired_at?:string}[]};
  assert.equal(dashboard.campaigns.find(row=>row.id===campaignResult.campaignId)?.status,"exhausted");
  const acquired=dashboard.users.find(row=>row.account_id===campaignUserId)!;
  assert.equal(acquired.direct_channel,"organic_social");assert.equal(acquired.acquisition_label,"Instagram Story 01");assert.ok(acquired.acquired_at);
  const user=dashboard.users.find(row=>row.account_id===userId)!;
  const suspended=await call("/v1/admin/users/access",adminJwt,"POST",{accountId:userId,operation:"suspend",expectedUpdatedAt:user.updated_at});
  assert.equal(suspended.status,200);assert.equal((await call("/v1/imported/board",userJwt)).status,403);
  const suspendedBody=await suspended.json() as {updatedAt:string};
  assert.equal((await call("/v1/admin/users/access",adminJwt,"POST",{accountId:userId,operation:"restore",expectedUpdatedAt:suspendedBody.updatedAt})).status,200);
  assert.notEqual((await call("/v1/imported/board",userJwt)).status,403);
  const actions=db.sqlite.prepare("SELECT action FROM admin_audit_log ORDER BY created_at").all().map(row=>row.action);
  for(const action of ["invitation.created","invitation.revoked","campaign.created","account.suspended","account.restored"])assert.ok(actions.includes(action));
});

test("disabling referral enrolment leaves existing friendships and existing-user requests intact",async t=>{
  const {call,db}=setup(t),adminJwt=await token(alice),aJwt=await token(bob),bJwt=await token(charlie),newJwt=await token(dana);
  const adminId=await enrolledAccount(call,db,adminJwt);await enrolledAccount(call,db,aJwt);await enrolledAccount(call,db,bJwt);
  db.sqlite.prepare("INSERT INTO admin_roles(account_id,role,granted_at) VALUES (?,'owner',?)").run(adminId,"2026-11-10T00:00:00Z");
  await call("/v1/friends/profile",aJwt,"PATCH",{name:"A",expectedRevision:0});await call("/v1/friends/profile",bJwt,"PATCH",{name:"B",expectedRevision:0});
  const invite=await (await call("/v1/friends/invitation",aJwt,"POST",{})).json() as {url:string};const referral=new URLSearchParams(new URL(invite.url).hash.slice(1)).get("invite")!;
  await call("/v1/friends/request",bJwt,"POST",{token:referral});
  const incoming=await (await call("/v1/friends",aJwt)).json() as {friends:{connectionId:string;revision:number}[]};
  await call("/v1/friends/action",aJwt,"POST",{connectionId:incoming.friends[0].connectionId,expectedRevision:incoming.friends[0].revision,operation:"accept"});
  const state=await (await call("/v1/admin",adminJwt)).json() as {policy:{published:{version:number};draft:{revision:number;policy:Record<string,unknown>;stage:string}}};
  const disabled={...state.policy.draft.policy,allowFriendReferralEnrolment:false,allowExistingFriendRequests:true};
  const draft=await (await call("/v1/admin/policy/draft",adminJwt,"PATCH",{stage:state.policy.draft.stage,policy:disabled,expectedRevision:state.policy.draft.revision})).json() as {draft:{revision:number};published:{version:number}};
  await call("/v1/admin/policy/publish",adminJwt,"POST",{expectedDraftRevision:draft.draft.revision,expectedPublishedVersion:draft.published.version,confirm:true});
  assert.equal(((await (await call("/v1/friends",aJwt)).json() as {friends:{state:string}[]}).friends[0].state),"accepted");
  await call("/v1/session",newJwt);assert.equal((await call("/v1/access/redeem",newJwt,"POST",{token:referral})).status,403);
  const existingInvite=await call("/v1/access/redeem",bJwt,"POST",{token:referral});assert.equal(existingInvite.status,200);
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
