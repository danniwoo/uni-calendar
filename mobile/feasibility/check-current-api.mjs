// Stage 2 investigation only. Runs the existing web handlers against synthetic,
// in-memory SQLite. No HTTP server, network, credentials, or production database.
// From mobile/: node --import tsx feasibility/check-current-api.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const require = createRequire(import.meta.url);
function loadTypeScript(path, resolve) {
  const filename = fileURLToPath(new URL(path, root));
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(
    resolve,
    module,
    module.exports,
  );
  return module.exports;
}

// Simulate identity already supplied by trusted Sites dispatch. This does NOT
// test dispatch, sign-in, cookie sharing, bearer tokens, or native authentication.
let requestHeaders = new Headers();
const auth = loadTypeScript("app/chatgpt-auth.ts", (name) => {
  if (name === "next/headers") return { headers: async () => requestHeaders };
  if (name === "next/navigation")
    return {
      redirect: () => {
        throw new Error("Unexpected redirect");
      },
    };
  throw new Error(`Unexpected auth dependency: ${name}`);
});
function identity(owner) {
  requestHeaders = new Headers(
    owner
      ? {
          "oai-authenticated-user-id": owner,
          "oai-authenticated-user-email": `${owner}@example.invalid`,
        }
      : {},
  );
}

const sql = new DatabaseSync(":memory:");
for (const migration of [
  "0000_noisy_plazm.sql",
  "0001_lyrical_iron_patriot.sql",
])
  sql.exec(readFileSync(new URL(`drizzle/${migration}`, root), "utf8"));
const db = {
  prepare(query) {
    return {
      bind(...values) {
        const statement = sql.prepare(query);
        return {
          first: async () => statement.get(...values) ?? null,
          run: async () => ({
            meta: { changes: Number(statement.run(...values).changes) },
          }),
        };
      },
    };
  },
  async batch(statements) {
    sql.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sql.exec("COMMIT");
      return results;
    } catch (error) {
      sql.exec("ROLLBACK");
      throw error;
    }
  },
};
const route = loadTypeScript("app/api/semester/route.ts", (name) => {
  if (name === "../../chatgpt-auth") return auth;
  if (name === "@/lib/storage") return { database: () => db };
  if (name.startsWith("@/lib/"))
    return require(fileURLToPath(new URL(`${name.slice(2)}.ts`, root)));
  throw new Error(`Unexpected API dependency: ${name}`);
});
const task = (id, extra = {}) => ({
  id,
  unit: "TEST1001",
  title: id,
  kind: "task",
  manual: true,
  description: "Synthetic feasibility fixture",
  source: "Manual",
  sourceText: "",
  weight: "",
  timing: "",
  hurdle: false,
  group: false,
  ...extra,
});
const fixture = (owner) => ({
  year: 2026,
  session: "S2C",
  boardGeneration: `synthetic-${owner}`,
  feedUrl: "https://example.invalid/synthetic-only",
  importedAt: "2026-11-02T00:00:00Z",
  weeks: [],
  units: [],
  classes: [],
  completed: {},
  warnings: [],
  tasks: [
    task("report", {
      kind: "assessment",
      date: "2026-11-06",
      time: "23:59",
      grade: { earned: 12, possible: 20 },
      reminders: [],
      futureMetadata: { keep: true },
    }),
    task("prepare-report", { parentId: "report", done: false }),
  ],
});
function put(semester, revision, origin, syncVersion = 10) {
  return route.PUT(
    new Request("https://semester.example.invalid/api/semester", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify({ semester, revision, syncVersion }),
    }),
  );
}
async function read() {
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response.json();
}
const beforeFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("Network forbidden in feasibility checks");
};
try {
  identity(null);
  assert.equal((await route.GET()).status, 401);
  assert.equal((await put(fixture("alice"), 0)).status, 401);
  requestHeaders.set("Authorization", "Bearer synthetic-not-a-real-token");
  assert.equal(await auth.getChatGPTUser(), null);
  assert.equal(
    auth.chatGPTSignInPath("semester-preview://auth"),
    "/signin-with-chatgpt?return_to=%2F",
  );
  assert.equal(
    auth.chatGPTSignInPath("/mobile-test"),
    "/signin-with-chatgpt?return_to=%2Fmobile-test",
  );
  console.log(
    "PASS: missing dispatch identity rejected; app helper has no bearer path; sign-in return stays on site.",
  );

  identity("alice");
  assert.equal((await put(fixture("alice"), 0)).status, 200);
  const initial = await read();
  identity("bob");
  assert.equal((await read()).semester, null);
  assert.equal((await put(fixture("bob"), 0)).status, 200);
  identity("alice");
  const changed = structuredClone(initial.semester);
  changed.tasks.find((t) => t.id === "prepare-report").done = true;
  const rejected = await put(
    changed,
    initial.revision,
    "https://other.example.invalid",
  );
  assert.equal(rejected.status, 403);
  assert.equal((await read()).revision, initial.revision);
  assert.equal((await put(changed, initial.revision)).status, 200);
  const after = await read();
  assert.equal(after.revision, initial.revision + 1);
  assert.equal(
    after.semester.tasks.find((t) => t.id === "prepare-report").done,
    true,
  );
  assert.deepEqual(
    after.semester.tasks.find((t) => t.id === "report"),
    initial.semester.tasks.find((t) => t.id === "report"),
  );
  identity("bob");
  assert.equal(
    (await read()).semester.tasks.find((t) => t.id === "prepare-report").done,
    false,
  );
  console.log(
    "PASS: authenticated test owners stay separate; full-snapshot preparation change preserves grade, deadline and unknown fields.",
  );

  identity("alice");
  assert.equal((await put(initial.semester, initial.revision)).status, 409);
  assert.equal((await read()).revision, after.revision);
  assert.equal(
    (await put(after.semester, after.revision, undefined, 9)).status,
    409,
  );
  console.log(
    "PASS: stale revision and older reminder-incompatible clients are rejected.",
  );

  // Characterise the existing whole-document API, not a desired mobile contract.
  // A reduced mobile projection can pass validation and erase omitted fields.
  // This destructive case exists ONLY in the disposable synthetic database.
  const reduced = structuredClone(after.semester);
  const report = reduced.tasks.find((t) => t.id === "report");
  delete report.grade;
  delete report.futureMetadata;
  assert.equal((await put(reduced, after.revision)).status, 200);
  const reducedRead = await read();
  assert.equal(
    reducedRead.semester.tasks.find((t) => t.id === "report").grade,
    undefined,
  );
  assert.equal(
    reducedRead.semester.tasks.find((t) => t.id === "report").futureMetadata,
    undefined,
  );
  console.log(
    "CONFIRMED LIMITATION: a reduced current-revision snapshot replaces omitted data; do not PUT the mobile sample model.",
  );
  console.log(
    "Local API investigation complete. Hosted/native authentication and live cross-device sync remain UNVERIFIED.",
  );
} finally {
  globalThis.fetch = beforeFetch;
  sql.close();
}
