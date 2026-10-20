import { fixtureReader } from "../fixture-reader.js";
import { READER_VERSION } from "../reader.js";
import { gradeView } from "../model.js";

const profile = { id: 91, name: "Synthetic QA Student — not your account" };
const courses = [12, 13, 14, 15].map((id, i) => ({
  id, name: `Synthetic unit ${i + 1}`, course_code: `TEST100${i + 1}`,
  term: { name: "Synthetic QA only" },
}));
const posted = { user_id: 91, score: 14, grade: "14", posted_at: "2026-10-18T02:00:00Z", workflow_state: "graded" };
const tooltip = '<span class="tooltip_wrap"><span>Click to test a different score</span></span><span class="screenreader-only" role="button">Click to test a different score</span>';
const complete = '<i class="graded_icon icon-check" aria-hidden="true"></i><span class="screenreader-only">Complete</span>';
const incomplete = '<i class="graded_icon icon-x" aria-hidden="true"></i><span class="screenreader-only">Incomplete</span>';
// All grades, titles and IDs below are invented. No real student data.
const cases = [
  { name: "Posted despite deprecated assignment muted", mark: "14", score: 14 },
  { name: "Visible without posted_at", mark: "7", submission: { posted_at: null, score: 99 }, score: 7 },
  { name: "Withheld row overrides stale posted API", mark: "99", muted: true, score: null },
  { name: "Pending quiz overrides posted API", mark: "99", pending: true, score: null },
  { name: "Hidden ancestor", mark: "99", style: "display:none", score: null },
  { name: "Unreleased icon", mark: '<i class="icon-off"></i>', score: null },
  { name: "Complete is a text result", mark: complete, type: "pass_fail", submission: { posted_at: null }, score: null, grade: "complete" },
  { name: "Incomplete is not numeric zero", mark: incomplete, type: "pass_fail", submission: { posted_at: null }, score: null, grade: "incomplete" },
  { name: "Hidden Complete stays hidden", mark: complete, type: "pass_fail", muted: true, score: null },
  { name: "Real numeric zero", mark: "0", score: 0 },
  { name: "What-If/original hidden fields ignored", mark: "-", submission: { posted_at: null, score: 99 }, score: null },
  { name: "Visible score ignores hidden What-If 999", mark: "8", score: 8 },
  { name: "API grade_hidden veto", mark: "14", submission: { grade_hidden: true }, score: null },
  { name: "Unknown aria-hidden descendant stays hidden", mark: '<span aria-hidden="true">99</span>', score: null },
  { name: "Hidden completion icon cannot release", mark: complete.replace('aria-hidden="true"', 'aria-hidden="true" style="display:none"'), type: "pass_fail", score: null },
  { name: "Hidden numeric descendant cannot release", mark: '<span style="display:none">99</span>', score: null },
  { name: "API-only posted numeric", noRow: true, score: 14 },
  { name: "API-only unposted withheld", noRow: true, submission: { posted_at: null }, score: null },
  { name: "Excused is not zero", mark: "14", submission: { excused: true }, score: null },
  { name: "Posted timestamp without numeric result", mark: "-", submission: { score: null, grade: "", workflow_state: "unsubmitted" }, score: null },
  { name: "Posted timestamp without pass/fail result", mark: "-", type: "pass_fail", submission: { score: null, grade: "", workflow_state: "unsubmitted" }, score: null },
];
export const fixtureAssignments = courseId => cases.map((c, i) => ({
  id: i + 1, course_id: courseId, name: c.name, muted: true, published: true,
  points_possible: 20, grading_type: c.type || "points", assignment_group_id: 3,
  due_at: "2026-10-18T12:59:00Z",
  submission: { ...posted, assignment_id: i + 1, ...c.submission },
}));
const html = `<div id="grade-summary-content" style="display: none"><table id="grades_summary">${
  cases.map((c, i) => c.noRow ? "" : `<tr id="submission_${i + 1}" data-muted="${!!c.muted}" data-pending_quiz="${!!c.pending}" style="${c.style || ""}">
    <td class="assignment_score"><span class="grade">${tooltip}${c.mark}</span><span>/ 20</span>
    <div style="display:none"><span class="original_points">999</span><span class="original_score">999</span><span class="what_if_score">999</span><span class="student_entered_score">999</span></div></td></tr>`).join("")
}</table></div>`;
export const requests = [];
async function fakeFetch(address, init) {
  const url = new URL(address);
  if (url.origin !== "https://canvas.sydney.edu.au" || init.method !== "GET") throw new Error("Unsafe fixture request");
  requests.push(url.pathname);
  let data;
  if (url.pathname === "/api/v1/users/self/profile") data = profile;
  else if (url.pathname === "/api/v1/courses") data = courses;
  else {
    const course = courses.find(c => url.pathname === `/api/v1/courses/${c.id}` || url.pathname.startsWith(`/api/v1/courses/${c.id}/`) || url.pathname === `/courses/${c.id}/grades`);
    if (!course) throw new Error("Unknown fixture route");
    if (url.pathname.endsWith("/grades")) return new Response(html, { headers: { "content-type": "text/html" } });
    if (url.pathname.endsWith("/assignments")) data = fixtureAssignments(course.id);
    else if (url.pathname.endsWith("/assignment_groups")) data = [{ id: 3, name: "Synthetic group", group_weight: 20 }];
    else data = course;
  }
  return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
}
export const readFixture = fixtureReader(fakeFetch);
export async function runChecks(report) {
  const check = (condition, name) => { report(condition, name); if (!condition) throw new Error(name); };
  for (const course of courses) {
    const r = await readFixture({ operation: "course", courseId: String(course.id), expectedUserId: "91", expectedVersion: READER_VERSION });
    check(r.ok && !r.marksPageUnavailable && r.course.id === String(course.id), `${course.course_code}: own endpoints + real DOM parser`);
    cases.forEach((c, i) => {
      const a = r.assignments[i], s = a.submission;
      check(s.score === c.score && (c.grade ? s.grade === c.grade && s.released && gradeView(a).kind === "released" : c.score !== null ? s.released : !s.released),
        `${course.course_code}: ${c.name}`);
    });
  }
  const count = requests.length;
  const mismatch = await readFixture({operation:"courses",expectedVersion:"0.1.0"});
  check(!mismatch.ok && mismatch.code === "VERSION_MISMATCH" && requests.length === count, "Old build is blocked before any Canvas request");
}
export function installPreviewFixture() {
  // Test-only adapter loaded solely by qa-server.mjs, never by the extension.
  window.chrome = {
    runtime: { getManifest: () => ({ version: new URL(location.href).searchParams.has("stale") ? "0.1.0" : READER_VERSION }) },
    tabs: { get: async () => ({ url: "https://canvas.sydney.edu.au/courses/12/grades" }),
      onRemoved: { addListener() {} }, onUpdated: { addListener() {} } },
    scripting: { executeScript: async ({ args }) => [{ result: await readFixture(args[0]) }] },
  };
}
