import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { readCanvas } from "../reader.js";
import { dateLabel, gradeView, submissionLabel, visibleAssignments } from "../model.js";

const ORIGIN = "https://canvas.sydney.edu.au";
const profile = { id: 91, name: "Synthetic Student", primary_email: "DO NOT FORWARD", avatar_url: "DO NOT FORWARD" };
const course = { id: 12, name: "Synthetic unit", course_code: "TEST1001", term: { name: "Test term" }, apply_assignment_group_weights: true, enrollments: [{ type: "student", user_id: 91 }] };
const posted = { user_id: 91, assignment_id: 1, score: 14, grade: "14", posted_at: "2026-10-18T02:00:00Z", workflow_state: "graded" };
const assignment = { id: 1, course_id: 12, name: "Quiz", points_possible: 20, grading_type: "points", assignment_group_id: 3, due_at: "2026-10-18T12:59:00Z", unlock_at: "2026-10-10T13:00:00Z", lock_at: "2026-10-25T12:59:00Z", description: "DO NOT FORWARD", submission: posted };
const group = { id: 3, name: "Quizzes", group_weight: 21, rules: { drop_lowest: 1, never_drop: [1] } };
function response(data, status = 200, link = "", type = "application/json") {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": type, Link: link } });
}
async function run(options = {}) {
  const requests = [];
  let identityCount = 0;
  const context = vm.createContext({ URL, Date, AbortSignal, DOMParser:options.DOMParser, location: { origin: options.origin || ORIGIN },
    fetch: async (address, init) => {
      const url = new URL(address);
      requests.push({ url, init });
      assert.equal(init.method, "GET");
      assert.equal(init.credentials, "same-origin");
      assert.equal(init.redirect, "error");
      assert.equal(init.cache, "no-store");
      assert.equal(url.origin, ORIGIN);
      assert.deepEqual(Object.keys(init.headers), ["Accept"]);
      const override = await options.handle?.(url, requests.length);
      if (override) return override;
      if (url.pathname === "/api/v1/users/self/profile") return response({ ...profile, id: ++identityCount > 1 && options.accountChanged ? 92 : 91 });
      if (url.pathname === "/api/v1/courses") return response([course]);
      if (url.pathname === "/api/v1/courses/12") return response(options.course || course);
      if (url.pathname.endsWith("/assignments")) return response(options.assignments || [assignment]);
      if (url.pathname.endsWith("/assignment_groups")) return response([group]);
      if (url.pathname.endsWith("/grades")) return new Response("synthetic DOM fixture",{headers:{"content-type":"text/html"}});
      throw new Error("Unexpected route");
    },
  });
  const result = await vm.runInContext(`(${readCanvas.toString()})`, context)(options.request || { operation: "course", courseId: "12", expectedUserId: "91" });
  return { result: JSON.parse(JSON.stringify(result)), requests };
}
test("extension version and least-privilege manifest are consistent", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url)));
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
  assert.equal(manifest.version, "0.2.1");
  assert.equal(pkg.version, manifest.version);
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  for (const key of ["host_permissions", "externally_connectable", "content_scripts", "web_accessible_resources"]) assert.equal(manifest[key], undefined);
});
test("fixed course read returns sanitized source facts and independent dates", async () => {
  const { result, requests } = await run();
  assert.equal(result.ok, true);
  assert.equal(requests.length, 7);
  assert.equal(result.assignments[0].submission.score, 14);
  assert.equal(result.assignments[0].dueAt, "2026-10-18T12:59:00.000Z");
  assert.equal(result.assignments[0].closesAt, "2026-10-25T12:59:00.000Z");
  assert.equal(result.groups[0].weight, 21);
  assert.deepEqual(result.groups[0].rules.neverDrop, ["1"]);
  assert.equal(JSON.stringify(result).includes("DO NOT FORWARD"), false);
});
test("course discovery asks for active student enrollments, not all grades", async () => {
  const { result, requests } = await run({ request: { operation: "courses" } });
  assert.equal(result.courses.length, 1);
  assert.equal(requests[1].url.searchParams.get("enrollment_type"), "student");
  assert.equal(requests[1].url.searchParams.get("enrollment_state"), "active");
  assert.deepEqual(requests[1].url.searchParams.getAll("include[]"), ["term"]);
  assert.equal(result.courses[0].enrollments, undefined);
});
test("single-course responses without enrollment fields still verify against the student list", async () => {
  for (const enrollments of [undefined, []]) {
    const {result}=await run({course:{...course,enrollments}});assert.equal(result.ok,true);
  }
  const {result}=await run({course:{...course,enrollments:undefined},handle:url=>url.pathname==="/api/v1/courses"?response([]):null});
  assert.equal(result.code,"NOT_STUDENT");
});
// DOM contract tests; real HTML parsing is additionally exercised in localhost
// browser QA with tooltip, hidden, pending and What-If markup fixtures.
function marksParser(rows,supported=true){return class {parseFromString(){return {
  querySelector:()=>supported?{}:null,
  querySelectorAll:()=>rows.map(r=>({id:`submission_${r.id}`,getAttribute:key=>key==="data-muted"?String(!!r.muted):String(!!r.pending),querySelector:()=>({
    closest:()=>r.hidden?{}:r.bootstrap?{id:"grade-summary-content",hasAttribute:()=>false,getAttribute:()=>null,style:{},parentElement:{closest:()=>r.outerHidden?{}:null}}:null,querySelector:()=>r.icon?{}:null,
    cloneNode:()=>({textContent:String(r.score),querySelectorAll:()=>[],querySelector:()=>null})
  })}))
};}};}
test("Marks-visible numeric score confirms release without posted_at; hidden markup overrides stale posted API",async()=>{
  const rows=[{id:1,score:7},{id:2,score:9,muted:true},{id:3,score:9,pending:true},{id:4,score:9,hidden:true},{id:5,score:9,icon:true},{id:6,score:0}];
  const {result}=await run({DOMParser:marksParser(rows),assignments:rows.map(r=>({...assignment,id:r.id,submission:{...posted,assignment_id:r.id,score:99,posted_at:r.id===1||r.id===6?null:posted.posted_at}}))});
  assert.equal(result.marksPageUnavailable,false);assert.deepEqual(result.assignments.map(a=>a.submission.score),[7,null,null,null,null,0]);
  assert.equal(result.assignments[0].submission.releaseEvidence,"marks-page");
});
test("unsupported Marks layout reports limitation without inventing release",async()=>{
  const {result}=await run({DOMParser:marksParser([],false),assignments:[{...assignment,submission:{...posted,posted_at:null}}]});
  assert.equal(result.marksPageUnavailable,true);assert.equal(result.assignments[0].submission.score,null);
});
test("Canvas bootstrap-hidden wrapper is not withheld; hidden rows, outer ancestors and icons remain withheld",async()=>{
  const rows=[{id:1,score:7,bootstrap:true},{id:2,score:8,bootstrap:true,muted:true},{id:3,score:8,bootstrap:true,hidden:true},{id:4,score:8,bootstrap:true,outerHidden:true},{id:5,score:8,bootstrap:true,icon:true}];
  const {result}=await run({DOMParser:marksParser(rows),assignments:rows.map(r=>({...assignment,id:r.id,submission:{...posted,assignment_id:r.id,posted_at:null}}))});
  assert.deepEqual(result.assignments.map(a=>a.submission.score),[7,null,null,null,null]);
});
test("four independently selected courses use their own endpoints, not a fixed first course", async () => {
  const list=[12,13,14,15].map(id=>({...course,id,enrollments:undefined}));
  for(const c of list){
    const {result}=await run({request:{operation:"course",courseId:String(c.id),expectedUserId:"91"},handle:url=>{
      if(url.pathname==="/api/v1/courses")return response(list);
      if(url.pathname===`/api/v1/courses/${c.id}`)return response(c);
      if(url.pathname===`/api/v1/courses/${c.id}/assignments`)return response([{...assignment,course_id:c.id}]);
    }});
    assert.equal(result.ok,true);assert.equal(result.course.id,String(c.id));assert.equal(result.assignments[0].submission.score,14);
  }
});
test("null/hidden/unposted/excused scores do not cross the reader boundary", async () => {
  const cases = [
    { ...posted, score: 0 },
    { ...posted, score: null },
    { ...posted, score: 17, posted_at: null },
    { ...posted, score: 18, grade_hidden: true },
    { ...posted, score: 19, excused: true },
    { ...posted, score: 20, posted_at: undefined },
  ];
  const { result } = await run({ assignments: cases.map((s, i) => ({ ...assignment, id: i + 1, submission: { ...s, assignment_id: i + 1 } })) });
  assert.equal(result.assignments[0].submission.score, 0);
  for (const a of result.assignments.slice(1)) assert.equal(a.submission.score, null);
  for (const a of result.assignments.slice(2)) assert.equal(a.submission.grade, "");
  assert.equal(gradeView(result.assignments[0]).label, "0 / 20");
  assert.equal(gradeView(result.assignments[4]).label, "Excused");
});
test("unpublished assignments excluded, absent due never inferred from lock", async () => {
  const { result } = await run({ assignments: [{ ...assignment, due_at: null }, { ...assignment, id: 2, published: false }] });
  assert.equal(result.assignments.length, 1);
  assert.equal(result.assignments[0].dueAt, null);
  assert.ok(result.assignments[0].closesAt);
});
test("pagination reads all pages, preserves include/filter and deduplicates", async () => {
  const { result, requests } = await run({ handle: (url) => {
    if (!url.pathname.endsWith("/assignments")) return;
    if (url.searchParams.get("page") === "2") return response([assignment, { ...assignment, id: 2, submission: null }]);
    const next = new URL(url); next.searchParams.set("page", "2");
    return response([assignment], 200, `<${next}>; rel="next", <${url}>; rel="current"`);
  } });
  assert.equal(result.assignments.length, 2);
  assert.equal(requests.filter((r) => r.url.pathname.endsWith("/assignments")).length, 2);
  assert.equal(requests.find((r) => r.url.searchParams.has("page")).url.searchParams.get("include[]"), "submission");
});
for (const next of ["https://evil.example/api/v1/courses/12/assignments?page=2", `${ORIGIN}/api/v1/courses/99/assignments?page=2`, `${ORIGIN}/api/v1/courses/12/assignments?page=2&access_token=secret`, `${ORIGIN}/api/v1/courses/12/assignments?page=2&include[]=observed_users`, `${ORIGIN}/api/v1/courses/12/assignments`]) {
  test(`unsafe page link rejected: ${next}`, async () => {
    const { result } = await run({ handle: (url) => url.pathname.endsWith("/assignments") ? response([assignment], 200, `<${next}>; rel="next"`) : null });
    assert.equal(result.code, "PAGINATION");
    assert.equal(result.assignments, undefined);
  });
}
test("pagination cycles fail instead of showing a partial list", async () => {
  const { result } = await run({ handle: (url) => {
    if (!url.pathname.endsWith("/assignments")) return;
    const next = new URL(url); next.searchParams.set("page", "2");
    return response([assignment], 200, `<${next}>; rel="next"`);
  } });
  assert.equal(result.code, "PAGINATION");
});
for (const [status, code] of [[401, "LOGIN_REQUIRED"], [403, "FORBIDDEN"], [429, "RATE_LIMITED"], [500, "INVALID_RESPONSE"]]) {
  test(`HTTP ${status} gives safe actionable error`, async () => {
    const { result } = await run({ handle: () => response({ private: "DO NOT FORWARD" }, status) });
    assert.deepEqual(result, { ok: false, code });
  });
}
test("HTML sign-in response is not interpreted as data", async () => {
  const { result } = await run({ handle: () => response("sign in", 200, "", "text/html") });
  assert.equal(result.code, "LOGIN_REQUIRED");
});
test("network and timeout failures are bounded and do not expose errors", async () => {
  for (const [name, code] of [["TypeError", "NETWORK"], ["TimeoutError", "TIMEOUT"]]) {
    const { result } = await run({ handle: () => { const e = new Error("secret request URL"); e.name = name; throw e; } });
    assert.deepEqual(result, { ok: false, code });
  }
});
test("account switch aborts all returned records", async () => {
  assert.deepEqual((await run({ accountChanged: true })).result, { ok: false, code: "ACCOUNT_CHANGED" });
  assert.equal((await run({ request: { operation: "course", courseId: "12", expectedUserId: "92" } })).requests.length, 1);
  assert.equal((await run({ assignments: [{ ...assignment, submission: { ...posted, user_id: 92 } }] })).result.code, "ACCOUNT_CHANGED");
});
test("wrong course or assignment data rejected", async () => {
  assert.equal((await run({ assignments: [{ ...assignment, course_id: 99 }] })).result.code, "INVALID_RESPONSE");
  assert.equal((await run({ assignments: [{ ...assignment, submission: { ...posted, assignment_id: 99 } }] })).result.code, "INVALID_RESPONSE");
});
test("teacher/observer data is not read", async () => {
  const { result, requests } = await run({ course: { ...course, enrollments: [{ type: "teacher" }] } });
  assert.equal(result.code, "NOT_STUDENT");
  assert.equal(requests.length, 3);
});
test("missing group access is explicitly partial; login errors are fatal", async () => {
  for (const status of [403, 401]) {
    const { result } = await run({ handle: (url) => url.pathname.endsWith("/assignment_groups") ? response({}, status) : null });
    if (status === 403) { assert.equal(result.groupsUnavailable, true); assert.equal(result.assignments.length, 1); }
    else assert.equal(result.code, "LOGIN_REQUIRED");
  }
});
test("wrong site and malformed operation rejected before any request", async () => {
  for (const options of [{ origin: "https://evil.example" }, { request: { operation: "delete" } }, { request: { operation: "course", courseId: "../users", expectedUserId: "91" } }]) {
    const { result, requests } = await run(options);
    assert.equal(result.ok, false); assert.equal(requests.length, 0);
  }
});
test("display: Sydney DST, unknown dates, zero maximum, non-numeric marks", () => {
  assert.match(dateLabel("2026-10-18T12:59:00Z"), /23:59/);
  assert.match(dateLabel("2026-08-18T13:59:00Z"), /23:59/);
  assert.equal(dateLabel(null), "Not provided");
  assert.match(dateLabel("bad"), /Invalid/);
  assert.equal(gradeView({ pointsPossible: 0, submission: { released: true, score: 2 } }).detail, "No percentage calculated");
  assert.equal(gradeView({ submission: { released: true, grade: "Complete" } }).label, "Complete");
  assert.equal(gradeView({ submission: null }).kind, "neutral");
  assert.equal(submissionLabel({ submission: { submittedAt: "2026-10-18", late: true } }), "Submitted late");
});
test("filter and date sort keep undated assignments last", () => {
  const rows = [{ id: "a", name: "Quiz 2", dueAt: null }, { id: "b", name: "Quiz 1", dueAt: "2026-10-18", submission: { released: true, score: 0 }, pointsPossible: 3 }];
  assert.deepEqual(visibleAssignments(rows, "QUIZ", "all").map((a) => a.id), ["b", "a"]);
  assert.equal(visibleAssignments(rows, "", "released")[0].id, "b");
  assert.equal(visibleAssignments(rows, "", "other")[0].id, "a");
});
