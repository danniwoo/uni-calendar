export const CANVAS_ORIGIN = "https://canvas.sydney.edu.au";
export const TIMEZONE = "Australia/Sydney";
export const ERRORS = {
  WRONG_SITE: "Open USYD Canvas, then click Semester Connect in Chrome’s toolbar again.",
  VERSION_MISMATCH: "Semester Connect has changed. Reload it at chrome://extensions, close this preview, then reopen from Canvas and read again. Old downloads are not updated automatically.",
  INVALID_REQUEST: "This preview could not start. Reopen it from your Canvas tab.",
  LOGIN_REQUIRED: "Your Canvas login is missing or expired. Sign in to Canvas, then reopen Semester Connect.",
  FORBIDDEN: "Canvas did not allow this read. Check that you are signed in as a student. No data was changed.",
  RATE_LIMITED: "Canvas is limiting requests. Wait a minute before trying again.",
  NETWORK: "Canvas could not be reached, or redirected to sign-in. Check your Canvas tab and connection, then retry.",
  TIMEOUT: "The read timed out. No partial preview was kept. Please retry later.",
  INVALID_RESPONSE: "Canvas returned data this version cannot safely read. Nothing was imported. Report this error code, not your raw grades.",
  PAGINATION: "Canvas returned an unexpected page link. The read stopped to avoid incomplete or unsafe results.",
  LIMIT: "This course exceeds this preview’s read limit. No partial results were kept.",
  ACCOUNT_CHANGED: "Your Canvas account changed during the read. The preview was cleared. Reopen from the correct account.",
  NOT_STUDENT: "This course did not confirm your own student enrollment. Teacher and observer views are not supported.",
  TAB_CLOSED: "The source Canvas tab was closed. Reopen Semester Connect from Canvas.",
  TAB_CHANGED: "The source Canvas tab navigated or reloaded. Its preview was cleared. Reopen from Canvas to continue.",
  ACCESS: "Chrome could not access the source tab. Keep Canvas open and click Semester Connect on that tab again.",
};
export function dateLabel(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Invalid date — check Canvas";
  return new Intl.DateTimeFormat("en-AU", { timeZone: TIMEZONE, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}
export function gradeView(assignment) {
  const s = assignment.submission;
  if (s?.excused) return { label: "Excused", detail: "Not treated as zero", kind: "neutral" };
  if (assignment.gradingType === "not_graded") return { label: "Not graded", detail: "No numerical grade expected", kind: "neutral" };
  if (s?.released === true && assignment.gradingType === "pass_fail" && /^(complete|incomplete)$/i.test(s.grade || "")) {
    return { label: s.grade.toLowerCase() === "complete" ? "Complete" : "Incomplete", detail: "Canvas result · not converted to a percentage", kind: "released" };
  }
  if (s?.released === true && typeof s.score === "number" && Number.isFinite(s.score)) {
    const max = assignment.pointsPossible;
    const validMax = typeof max === "number" && Number.isFinite(max);
    const percent = validMax && max > 0 ? `${Number((s.score / max * 100).toFixed(2))}% of this item` : "No percentage calculated";
    return { label: `${s.score} / ${validMax ? max : "?"}`, detail: percent, kind: "released" };
  }
  if (s?.released === true && s.grade) return { label: s.grade, detail: "Canvas grade · no numeric score", kind: "released" };
  if (s?.unavailableReason === "hidden-in-canvas") return { label: "Not released in Canvas", detail: "Hidden by Canvas · not zero", kind: "pending" };
  if (s?.state === "graded" || (s && !s.released && s.postedAt)) return { label: "Grade unavailable", detail: "Not confirmed released · not zero", kind: "pending" };
  if (s?.submittedAt || s?.state === "submitted" || s?.state === "pending_review") return { label: "Awaiting grade", detail: "No released score provided", kind: "pending" };
  return { label: "No released grade", detail: "Not treated as zero", kind: "neutral" };
}
export function submissionLabel(a) {
  const s = a.submission;
  if (!s) return "No submission data";
  if (s.excused) return "Excused";
  if (s.missing) return "Missing · reported by Canvas";
  if (s.submittedAt) return s.late ? "Submitted late" : "Submitted";
  if (s.state === "graded") return "Graded · no submission time";
  if (s.state === "pending_review") return "Pending review";
  if (s.state === "unsubmitted") return "Not submitted";
  return s.state || "Status not provided";
}
export function releasedSummary(rows) {
  const released = rows.filter(a => gradeView(a).kind === "released");
  const numeric = released.filter(a => typeof a.submission?.score === "number" && Number.isFinite(a.submission.score)).length;
  return `${numeric} numeric grades${released.length > numeric ? ` + ${released.length - numeric} text results` : ""}`;
}
export function visibleAssignments(rows, query, status) {
  const search = query.trim().toLocaleLowerCase();
  return rows.filter((a) => (!search || a.name.toLocaleLowerCase().includes(search)) &&
    (status === "all" || (status === "released" ? gradeView(a).kind === "released" : gradeView(a).kind !== "released")))
    .sort((a, b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) || a.name.localeCompare(b.name));
}
