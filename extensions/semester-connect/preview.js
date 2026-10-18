import { readCanvas } from "./reader.js";
import { CANVAS_ORIGIN, ERRORS, dateLabel, gradeView, submissionLabel, visibleAssignments } from "./model.js";

const $ = (id) => document.getElementById(id);
const params = new URL(location.href).searchParams;
const sourceTab = /^\d+$/.test(params.get("tab") || "") ? Number(params.get("tab")) : null;
let user = null, courses = [], snapshot = null, generation = 0, busy = false;
const version = chrome.runtime.getManifest().version;
$("version").textContent = version;
$("footer-version").textContent = version;

// All Canvas-provided content is text, never HTML or executable URLs.
function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = String(text);
  if (className) el.className = className;
  return el;
}
function message(text, error = false) {
  $("message").textContent = text;
  $("message").className = `message${error ? " error" : ""}`;
}
function controls() {
  $("courses").disabled = busy || sourceTab === null;
  $("course").disabled = busy;
  $("read").disabled = busy || !user || !$("course").value;
}
function discardResults() {
  snapshot = null;
  $("results").hidden = true;
  for (const name of ["rows", "groups", "summary", "course-code", "course-title", "fetched", "group-count", "count"]) $(name).replaceChildren();
  $("canvas-grades").removeAttribute("href");
  $("search").value = "";
  $("status").value = "all";
}
function clear(text = "Preview cleared. No grades were saved. You can read your courses again.", error = false) {
  generation++;
  busy = false;
  user = null;
  courses = [];
  discardResults();
  $("identity").textContent = "";
  $("account-id").textContent = "";
  $("course").replaceChildren(new Option("Choose a course…", ""));
  $("workspace").hidden = true;
  $("start").hidden = false;
  message(text, error);
  controls();
}
async function execute(request) {
  if (sourceTab === null) throw new Error("WRONG_SITE");
  let tab;
  try { tab = await chrome.tabs.get(sourceTab); } catch { throw new Error("TAB_CLOSED"); }
  try { if (new URL(tab.url).origin !== CANVAS_ORIGIN) throw new Error(); }
  catch { throw new Error("ACCESS"); }
  let results;
  try {
    results = await chrome.scripting.executeScript({ target: { tabId: sourceTab }, world: "ISOLATED", func: readCanvas, args: [request] });
  } catch { throw new Error("ACCESS"); }
  const result = results?.[0]?.result;
  if (!result || result.ok !== true) throw new Error(result?.code || "INVALID_RESPONSE");
  return result;
}
async function read(operation) {
  if (busy) return;
  const selected = courses.find((c) => c.id === $("course").value);
  if (operation === "course" && (!selected || !user)) return;
  const request = operation === "courses" ? { operation } : { operation, courseId: selected.id, expectedUserId: user.id };
  if (operation === "courses") clear("");
  else discardResults();
  const ownGeneration = ++generation;
  busy = true;
  controls();
  message(operation === "courses" ? "Reading your active student course list…" : "Reading this course’s assignments and groups… Keep the source Canvas tab open; this can take up to a minute.");
  try {
    const result = await execute(request);
    if (ownGeneration !== generation) return;
    if (operation === "courses") {
      user = result.user;
      courses = result.courses;
      $("identity").textContent = user.name;
      $("account-id").textContent = ` · account ${user.id}`;
      $("course").replaceChildren(new Option("Choose a course…", ""));
      for (const c of courses) $("course").append(new Option(`${c.code || c.name} — ${c.name}${c.term ? ` · ${c.term}` : ""}`, c.id));
      $("workspace").hidden = false;
      $("start").hidden = true;
      message(courses.length ? `${courses.length} active student courses found. Select one to read its assignments and marks.` : "No active student courses were returned. Check your Canvas account and enrollment; this is not proof that you have no coursework.");
    } else {
      snapshot = result;
      render();
      message("Read complete. This is a snapshot, not live syncing. Nothing was imported into Semester.");
    }
  } catch (error) {
    if (ownGeneration !== generation) return;
    const code = error.message in ERRORS ? error.message : "INVALID_RESPONSE";
    clear(`${ERRORS[code]} (${code})`, true);
  } finally {
    if (ownGeneration === generation) { busy = false; controls(); }
  }
}
function render() {
  $("results").hidden = false;
  const { course, assignments, groups, fetchedAt, groupsUnavailable } = snapshot;
  $("course-code").textContent = course.code || `Course ${course.id}`;
  $("course-title").textContent = course.name;
  $("fetched").textContent = `Read ${dateLabel(fetchedAt)} · Sydney · ${course.term || "Term not provided"}`;
  $("canvas-grades").href = `${CANVAS_ORIGIN}/courses/${course.id}/grades`;
  $("summary").replaceChildren();
  for (const [value, label] of [[assignments.length, "assignments returned"], [assignments.filter((a) => gradeView(a).kind === "released").length, "released grades"], [assignments.filter((a) => !a.dueAt).length, "without a due date"]]) {
    const metric = element("div", null, "metric");
    metric.append(element("strong", value), element("span", label));
    $("summary").append(metric);
  }
  $("group-count").textContent = groupsUnavailable ? "· unavailable" : `· ${groups.length}`;
  $("groups").replaceChildren(element("p", groupsUnavailable ? "Canvas did not return the assignment groups. Weights are unavailable, not zero. The assignment list was read successfully." : course.weighted === true ? "Canvas reports weighted assignment groups. These are group totals, not each assignment’s weight. Rules are shown, not calculated in 0.1.0." : course.weighted === false ? "Canvas reports that group weighting is OFF. The configured weights below are not applied weights." : "Canvas did not confirm whether group weighting is enabled. Do not assume the percentages below are applied."));
  const grid = element("div", null, "group-list");
  for (const g of groups) {
    const item = element("div", null, "group-item");
    item.append(element("strong", `${g.name} · ${g.weight == null ? "Weight unknown" : `${g.weight}% configured group weight`}`));
    const rules = [];
    if (g.rules.dropLowest > 0) rules.push(`Drop lowest: ${g.rules.dropLowest}`);
    if (g.rules.dropHighest > 0) rules.push(`Drop highest: ${g.rules.dropHighest}`);
    if (g.rules.neverDrop.length) rules.push(`Never drop IDs: ${g.rules.neverDrop.join(", ")}`);
    item.append(element("p", `${rules.join(" · ") || "No drop rule returned"} · Group ID ${g.id}`));
    grid.append(item);
  }
  $("groups").append(grid);
  renderRows();
}
function renderRows() {
  if (!snapshot) return;
  const rows = visibleAssignments(snapshot.assignments, $("search").value, $("status").value);
  const groups = new Map(snapshot.groups.map((g) => [g.id, g.name]));
  $("rows").replaceChildren();
  $("count").textContent = `${rows.length} of ${snapshot.assignments.length} assignments`;
  $("empty").hidden = rows.length > 0;
  $("empty").textContent = snapshot.assignments.length ? "No assignments match these filters." : "Canvas returned no assignments for this course. Check the course in Canvas before assuming nothing is due.";
  for (const a of rows) {
    const tr = element("tr"), title = element("td"), due = element("td"), grade = element("td"), submission = element("td");
    const link = element("a", a.name || "Untitled assignment", "assignment-title");
    link.href = `${CANVAS_ORIGIN}/courses/${snapshot.course.id}/assignments/${a.id}`;
    link.target = "_blank"; link.rel = "noopener noreferrer";
    title.append(link, element("span", groups.get(a.groupId) || "Group unavailable", "subtext"));
    if (a.omitted) title.append(element("span", "Excluded from final grade", "badge"));
    if (a.locked) title.append(element("span", "Locked in Canvas", "badge"));
    const details = element("details", null, "dates");
    details.append(element("summary", "Dates & source details"));
    const dl = element("dl");
    for (const [label, value] of [["Opens", a.opensAt], ["Closes", a.closesAt], ["Posted", a.submission?.postedAt]]) dl.append(element("dt", label), element("dd", dateLabel(value)));
    details.append(dl, element("div", `Course ${snapshot.course.id} · Assignment ${a.id} · ${a.gradingType || "Grading type unknown"}`, "source-id"));
    title.append(details);
    due.append(element("span", a.dueAt ? dateLabel(a.dueAt) : "Due date not provided"));
    if (!a.dueAt && a.closesAt) due.append(element("span", "Closing date is not a due date", "subtext"));
    const view = gradeView(a);
    grade.append(element("span", view.label, `grade ${view.kind}`), element("span", view.detail, "subtext"));
    if (view.kind !== "released" && a.pointsPossible != null) grade.append(element("span", `Out of ${a.pointsPossible} points`, "subtext"));
    if (a.submission?.currentAttemptGraded === false) grade.append(element("span", "Earlier attempt · latest not graded", "badge warning"));
    submission.append(element("span", submissionLabel(a)));
    if (a.submission?.submittedAt) submission.append(element("span", dateLabel(a.submission.submittedAt), "subtext"));
    tr.append(title, due, grade, submission);
    $("rows").append(tr);
  }
}
$("courses").addEventListener("click", () => read("courses"));
$("read").addEventListener("click", () => read("course"));
$("course").addEventListener("change", () => { discardResults(); message("Select Read selected course to fetch a fresh snapshot."); controls(); });
$("search").addEventListener("input", renderRows);
$("status").addEventListener("change", renderRows);
$("clear").addEventListener("click", () => clear());
chrome.tabs.onRemoved.addListener((tabId) => { if (tabId === sourceTab) clear(ERRORS.TAB_CLOSED, true); });
chrome.tabs.onUpdated.addListener((tabId, change) => { if (tabId === sourceTab && (change.status === "loading" || change.url)) clear(ERRORS.TAB_CHANGED, true); });
window.addEventListener("pagehide", () => { generation++; user = null; courses = []; snapshot = null; });
if (sourceTab === null) {
  $("start-copy").textContent = "Open canvas.sydney.edu.au in Chrome and sign in normally. While that Canvas tab is active, click the Semester Connect extension icon. This preview cannot connect from the Semester website or another school’s Canvas.";
  message("Open this preview from the extension icon on a USYD Canvas tab.");
}
controls();
