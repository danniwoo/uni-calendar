import test from "node:test";
import assert from "node:assert/strict";
import { createApi, ApiError } from "../src/api.js";
import { createController } from "../src/controller.js";
import { readConfig, takeAuthCallback } from "../src/config.js";

const a = { user: { id: "a" }, access_token: "token-a" };
const b = { user: { id: "b" }, access_token: "token-b" };
const board = (title = "Sample semester", revision = 1, completed = false) => ({
  semester: { id: "sample", title, weekLabel: "Sample week", assessments: [{ id: "a1", unitCode: "TEST1001", title: "Sample report", dueAt: "2026-11-05T12:59:00Z", weightLabel: "20%" }], tasks: [{ id: "t1", unitCode: "TEST1001", title: "Sample draft", completed }] }, revision,
});
const deferred = () => { let resolve; let reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
const api = overrides => ({ session: async s => ({ accountId: s.user.id }), get: async () => board(), seed: async () => board(), update: async () => board("Sample semester", 2, true), ...overrides });

test("configuration fails closed for missing settings, admin keys and unsafe origins", () => {
  assert.equal(readConfig({}).ready, false);
  const env = { VITE_SUPABASE_URL: "https://project.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", VITE_SEMESTER_API_URL: "http://localhost:8787" };
  assert.equal(readConfig(env).ready, true);
  assert.equal(readConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_admin" }).ready, false);
  assert.equal(readConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: "eyJserviceRole" }).ready, false);
  assert.equal(readConfig({ ...env, VITE_SEMESTER_API_URL: "http://remote.example" }).ready, false);
  assert.equal(readConfig({ ...env, VITE_SUPABASE_URL: "https://user:password@example.com" }).ready, false);
});

test("OAuth callback is cleaned before exchange, retaining only unrelated navigation", () => {
  assert.deepEqual(takeAuthCallback("http://localhost:4174/?code=secret&sb_flow_id=flow&tab=work"), { code: "secret", flowId: "flow", failed: false, cleanUrl: "/?tab=work" });
  const implicit = takeAuthCallback("http://localhost:4174/#access_token=secret&refresh_token=private");
  assert.equal(implicit.failed, true); assert.equal(implicit.cleanUrl, "/");
  const query = takeAuthCallback("http://localhost:4174/?access_token=secret&refresh_token=private");
  assert.equal(query.failed, true); assert.equal(query.cleanUrl, "/");
  assert.equal(takeAuthCallback("http://localhost:4174/?error=cancelled&error_description=secret").cleanUrl, "/");
});

test("API uses Supabase access token, sends only narrow update and refuses redirects", async () => {
  const calls = [];
  const client = createApi("https://api.example", async (url, init) => { calls.push({ url, init }); return Response.json(board("updated", 2, true)); });
  await client.update(a, "id/with spaces", true, 1);
  assert.equal(calls[0].url, "https://api.example/v1/tasks/id%2Fwith%20spaces");
  assert.equal(calls[0].init.headers.Authorization, "Bearer token-a");
  assert.equal(calls[0].init.credentials, "omit");
  assert.equal(calls[0].init.redirect, "error");
  assert.deepEqual(JSON.parse(calls[0].init.body), { completed: true, expectedRevision: 1 });
  await assert.rejects(client.get(null), { status: 401 });
  assert.equal(calls.length, 1);
});

test("malformed API data is rejected and server error details are not echoed", async () => {
  const malformed = createApi("https://api.example", async () => Response.json({ semester: {}, revision: 1 }));
  await assert.rejects(malformed.get(a), { code: "invalid_board" });
  const failure = createApi("https://api.example", async () => Response.json({ error: { code: "private", message: "token-or-internal-content" } }, { status: 500 }));
  await assert.rejects(failure.get(a), e => !e.message.includes("token-or-internal-content"));
});

test("logout clears board immediately and ignores the pending request result", async () => {
  const waiting = deferred();
  const c = createController(api({ get: () => waiting.promise }));
  c.setSession(a); const pending = c.refresh();
  c.clear();
  assert.equal(c.getState().board, null); assert.equal(c.getState().session, null);
  waiting.resolve(board("old account")); await pending;
  assert.equal(c.getState().board, null); assert.equal(c.getState().accountId, null);
});

test("old account response cannot replace a newer account's board", async () => {
  const old = deferred();
  const c = createController(api({ get: s => s.user.id === "a" ? old.promise : Promise.resolve(board("B data")) }));
  c.setSession(a); const first = c.refresh();
  c.setSession(b); await c.refresh();
  old.resolve(board("A data")); await first;
  assert.equal(c.getState().session.user.id, "b");
  assert.equal(c.getState().board.semester.title, "B data");
  assert.equal(c.getState().accountId, "b");
});

test("an old mutation result cannot reappear after switching accounts", async () => {
  const old = deferred();
  const c = createController(api({ update: () => old.promise, get: s => Promise.resolve(board(s.user.id)) }));
  c.setSession(a); await c.refresh(); const update = c.update("t1", true);
  c.setSession(b); await c.refresh(); old.resolve(board("saved A", 2, true)); await update;
  assert.equal(c.getState().board.semester.title, "b"); assert.equal(c.getState().board.revision, 1);
});

test("409 reloads latest board without silently replaying the mutation", async () => {
  let writes = 0; let reads = 0;
  const c = createController(api({ get: async () => board("sample", ++reads), update: async () => { writes++; throw new ApiError(409, "conflict", "conflict"); } }));
  c.setSession(a); await c.refresh(); await c.update("t1", true);
  assert.equal(writes, 1); assert.equal(c.getState().board.revision, 2);
  assert.match(c.getState().notice, /choose your change again/);
});

test("rejected API sessions clear displayed data and disable subsequent writes", async () => {
  let calls = 0;
  const c = createController(api({ get: async () => { calls++; if (calls > 1) throw new ApiError(401, "expired", "Session rejected"); return board(); } }));
  c.setSession(a); await c.refresh(); await c.refresh(); await c.seed();
  assert.equal(c.getState().board, null); assert.equal(c.getState().accountId, null);
  assert.equal(c.getState().rejected, true); assert.equal(calls, 2);
});

test("missing board is explicit, seed requires an action, and refreshed tokens are used", async () => {
  let seeds = 0; const tokens = [];
  const c = createController(api({ get: async () => { throw new ApiError(404, "missing", "No board"); }, seed: async session => { seeds++; tokens.push(session.access_token); return board(); } }));
  c.setSession(a); await c.refresh();
  assert.equal(c.getState().board, null); assert.equal(c.getState().checked, true); assert.equal(seeds, 0);
  c.setSession({ ...a, access_token: "refreshed-token" }); await c.seed();
  assert.deepEqual(tokens, ["refreshed-token"]); assert.equal(c.getState().board.revision, 1);
});
