import { readCanvas, READER_VERSION } from "./reader.js";
import { CANVAS_ORIGIN, ERRORS, dateLabel, gradeView, releasedSummary, submissionLabel, visibleAssignments } from "./model.js";
import {ORIGINS} from "./reload-check.js";

const $ = (id) => document.getElementById(id);
const params = new URL(location.href).searchParams;
const sourceTab = /^\d+$/.test(params.get("tab") || "") ? Number(params.get("tab")) : null;
let user = null, courses = [], snapshot = null, generation = 0, busy = false;
const snapshots = new Map();
const selectedCourses = () => [...document.querySelectorAll('#course-checks input:checked')].map(el => el.value);
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
  const selected = selectedCourses();
  $("read-many").disabled = busy || !user || !selected.length;
  $("export").disabled = busy || !selected.length || selected.length>8 || selected.some(id => !snapshots.has(id));
  $("enable-reload").disabled = busy || !user || !selected.length || selected.length>8;
  document.querySelectorAll('#course-checks input').forEach(el => {el.disabled = busy;});
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
  snapshots.clear();
  $("course-checks").replaceChildren();
  $("batch-status").textContent = "";
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
  if (version !== READER_VERSION || chrome.runtime.getManifest().version !== version) throw new Error("VERSION_MISMATCH");
  if (sourceTab === null) throw new Error("WRONG_SITE");
  let tab;
  try { tab = await chrome.tabs.get(sourceTab); } catch { throw new Error("TAB_CLOSED"); }
  try { if (new URL(tab.url).origin !== CANVAS_ORIGIN) throw new Error(); }
  catch { throw new Error("ACCESS"); }
  let results;
  try {
    results = await chrome.scripting.executeScript({ target: { tabId: sourceTab }, world: "ISOLATED", func: readCanvas, args: [{ ...request, expectedVersion: version }] });
  } catch { throw new Error("ACCESS"); }
  const result = results?.[0]?.result;
  if (!result || result.ok !== true) throw new Error(result?.code || "INVALID_RESPONSE");
  if (result.readerVersion !== version) throw new Error("VERSION_MISMATCH");
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
      for (const c of courses) {
        const label = element("label", null, "course-check"), input = document.createElement("input");
        input.type = "checkbox"; input.value = c.id;
        input.addEventListener("change", controls);
        label.append(input, element("span", `${c.code || c.name} · ${c.term || "Term unknown"}`));
        $("course-checks").append(label);
      }
      $("workspace").hidden = false;
      $("start").hidden = true;
      message(courses.length ? `${courses.length} active student courses found. Select one to read its assignments and marks.` : "No active student courses were returned. Check your Canvas account and enrollment; this is not proof that you have no coursework.");
    } else {
      snapshot = result;
      snapshots.set(result.course.id, result);
      $("batch-status").textContent = selectedCourses().map(id=>{const s=snapshots.get(id);return s?`${s.course.code}: ${s.assignments.length} items, ${s.assignments.filter(a=>gradeView(a).kind==="released").length} released grades`:`${courses.find(c=>c.id===id)?.code||id}: not read — retry this course`;}).join("\n");
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
  $("groups").replaceChildren(element("p", groupsUnavailable ? "Canvas did not return the assignment groups. Weights are unavailable, not zero. The assignment list was read successfully." : course.weighted === true ? "Canvas reports weighted assignment groups. These are group totals, not each assignment’s weight. Rules are shown, not calculated here." : course.weighted === false ? "Canvas reports that group weighting is OFF. The configured weights below are not applied weights." : "Canvas did not confirm whether group weighting is enabled. Do not assume the percentages below are applied."));
  $("read-warning").textContent = snapshot.marksPageUnavailable ? "Marks-page cross-check unavailable. Posted API grades are shown; other scores remain unavailable. Compare in Canvas before importing." : "Grades checked against the student Marks page where supported. Hidden marks and What-If values are not imported.";
  $("read-warning").textContent += ` ${releasedSummary(assignments)}. Complete/Incomplete stays text; Semester applies completion points only through an explicitly confirmed completion rule.`;
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
    if (a.locked) title.append(element("span", "Submission access locked · not grade visibility", "badge"));
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
    if (a.submission?.releaseEvidence) grade.append(element("span", a.submission.releaseEvidence === "marks-page" ? "Verified on Marks page" : "Posted in Canvas API", "subtext"));
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
$("course").addEventListener("change", () => { discardResults(); snapshot = snapshots.get($("course").value) || null; if (snapshot) render(); message("Read again to refresh this course. Saved previews remain in this tab only."); controls(); });
$("read-many").addEventListener("click", async () => {
  const ids = selectedCourses();
  if (busy || !user || !ids.length || ids.length > 8) {message("Select between 1 and 8 teaching courses.", true);return;}
  const ownGeneration = ++generation;
  busy = true; controls(); discardResults();
  ids.forEach(id => snapshots.delete(id));
  const statuses = [];
  try {
    for (const id of ids) {
      message(`Reading ${courses.find(c => c.id === id)?.code || id}… (${statuses.length + 1}/${ids.length})`);
      try {
        const result = await execute({operation:"course",courseId:id,expectedUserId:user.id});
        if (ownGeneration !== generation) return;
        snapshots.set(id,result);
        statuses.push(`${result.course.code}: ${result.assignments.length} items, ${releasedSummary(result.assignments)}`);
      } catch (error) {
        if (ownGeneration !== generation) return;
        if (["ACCOUNT_CHANGED","LOGIN_REQUIRED","ACCESS","TAB_CLOSED","VERSION_MISMATCH"].includes(error.message)) throw error;
        statuses.push(`${courses.find(c=>c.id===id)?.code || id}: ${error.message in ERRORS ? error.message : "INVALID_RESPONSE"} — retry this course`);
      }
      $("batch-status").textContent = statuses.join("\n");
    }
    snapshot = snapshots.get(ids.find(id => snapshots.has(id))) || null;
    if (snapshot) {$("course").value = snapshot.course.id;render();}
    message(ids.every(id=>snapshots.has(id)) ? "Selected courses read. Review each course, then download the import file. Nothing has been sent to Semester." : "Some courses failed. Successful previews are retained; retry failed courses before exporting the selection.", !ids.every(id=>snapshots.has(id)));
  } catch(error) {if (ownGeneration === generation) clear(`${ERRORS[error.message] || ERRORS.INVALID_RESPONSE} (${error.message})`,true);}
  finally {if(ownGeneration===generation){busy=false;controls();}}
});
$("export").addEventListener("click", () => {
  const ids=selectedCourses();
  if(busy || !user || !ids.length || ids.length>8 || ids.some(id=>!snapshots.has(id)))return;
  if(version!==READER_VERSION || chrome.runtime.getManifest().version!==version || ids.some(id=>snapshots.get(id).readerVersion!==version)){
    clear(ERRORS.VERSION_MISMATCH,true);return;
  }
  const data={format:"semester-connect",schemaVersion:1,extensionVersion:version,source:CANVAS_ORIGIN,accountId:user.id,exportedAt:new Date().toISOString(),courses:ids.map(id=>{
    const {course,assignments,groups,groupsUnavailable,marksPageUnavailable,fetchedAt}=snapshots.get(id);
    return {course,assignments,groups,groupsUnavailable,marksPageUnavailable,fetchedAt};
  })};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  if(blob.size>1500000||data.courses.reduce((n,c)=>n+c.assignments.length,0)>2500){message("This selection exceeds Semester’s import limit. Select fewer courses and export again.",true);return;}
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`semester-connect-${new Date().toISOString().slice(0,10)}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  message("Import file downloaded — it contains your grades. In Semester: Manage → Import from Semester Connect. Review matches and confirm there; this download changes nothing in the website.");
});
$("search").addEventListener("input", renderRows);
$("status").addEventListener("change", renderRows);
$("clear").addEventListener("click", () => clear());
chrome.tabs.onRemoved.addListener((tabId) => { if (tabId === sourceTab) clear(ERRORS.TAB_CLOSED, true); });
chrome.tabs.onUpdated.addListener((tabId, change) => { if (tabId === sourceTab && (change.status === "loading" || change.url)) clear(ERRORS.TAB_CHANGED, true); });
window.addEventListener("pagehide", () => { generation++; user = null; courses = []; snapshot = null; snapshots.clear(); });
if (sourceTab === null) {
  $("start-copy").textContent = "Open canvas.sydney.edu.au in Chrome and sign in normally. While that Canvas tab is active, click the Semester Connect extension icon. This preview cannot connect from the Semester website or another school’s Canvas.";
  message("Open this preview from the extension icon on a USYD Canvas tab.");
}
controls();
async function reloadStatus() {
  try {const state=await chrome.runtime.sendMessage({type:"connect-inbox"});$("reload-status").textContent=`${state.enabled?`On · account ${state.accountId} · ${state.courseCount} selected courses. `:"Off. "}${state.message}`;}
  catch {$("reload-status").textContent="Reload Connect and reopen this preview to use reload checks. JSON export is still available.";}
}
$("enable-reload").addEventListener("click",async()=>{
  if(busy||!user||!selectedCourses().length||selectedCourses().length>8)return;
  const config={enabled:true,accountId:user.id,courseIds:selectedCourses()};
  try {
    // Request only from this deliberate user gesture, never on page load.
    if(!await chrome.permissions.request({origins:ORIGINS})){$("reload-status").textContent="Not enabled. You can keep using JSON without granting site access.";return;}
    const result=await chrome.runtime.sendMessage({type:"connect-enable",config});
    if(!result?.ok)throw new Error(result?.error||"Could not enable reload checks.");
    await reloadStatus();
  }catch(error){$("reload-status").textContent=error.message;}
});
$("disable-reload").addEventListener("click",async()=>{
  await chrome.runtime.sendMessage({type:"connect-disable"});
  await chrome.permissions.remove({origins:ORIGINS});
  await reloadStatus();
});
void reloadStatus();
chrome.storage?.onChanged?.addListener((changes,area)=>{if(area==="session"&&changes.reloadState)void reloadStatus();});
