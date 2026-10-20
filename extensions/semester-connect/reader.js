/** Self-contained: Chrome serializes this function into the Canvas isolated world.
 * Only fixed GET endpoints. No cookies are read, exported or copied. Browser
 * credentials stay on Canvas. Do not add generic URL or HTTP-method parameters.
 */
export const READER_VERSION = "0.2.2";
export async function readCanvas(request) {
  // Keep inside the function too: Chrome serializes this function without imports.
  const readerVersion = "0.2.2";
  const ORIGIN = "https://canvas.sydney.edu.au";
  const started = Date.now();
  const id = (v) => (typeof v === "number" && Number.isSafeInteger(v) && v > 0) ||
    (typeof v === "string" && /^[1-9]\d{0,19}$/.test(v));
  const text = (v, max = 400) => typeof v === "string" ? v.slice(0, max) : "";
  const number = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
  const date = (v) => typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
  const fail = (code) => { throw new Error(code); };
  const allowedErrors = new Set(["WRONG_SITE", "VERSION_MISMATCH", "INVALID_REQUEST", "LOGIN_REQUIRED", "FORBIDDEN", "RATE_LIMITED", "NETWORK", "TIMEOUT", "INVALID_RESPONSE", "PAGINATION", "LIMIT", "ACCOUNT_CHANGED", "NOT_STUDENT"]);
  try {
    if (location.origin !== ORIGIN) fail("WRONG_SITE");
    if (!request || !["courses", "course"].includes(request.operation)) fail("INVALID_REQUEST");
    if (request.expectedVersion && request.expectedVersion !== readerVersion) fail("VERSION_MISMATCH");
    if (request.operation === "course" && (!id(request.courseId) || !id(request.expectedUserId))) fail("INVALID_REQUEST");
    const allowedPaths = new Set(["/api/v1/users/self/profile", "/api/v1/courses"]);
    if (request.operation === "course") {
      for (const suffix of ["", "/assignments", "/assignment_groups"]) {
        allowedPaths.add(`/api/v1/courses/${request.courseId}${suffix}`);
      }
    }
    async function get(url, html = false) {
      if (Date.now() - started > 60000) fail("TIMEOUT");
      if (url.origin !== ORIGIN || !allowedPaths.has(url.pathname) || url.username || url.password || url.hash) fail("INVALID_REQUEST");
      let response;
      try {
        response = await fetch(url.href, {
          method: "GET", credentials: "same-origin", redirect: "error", cache: "no-store",
          headers: { Accept: html ? "text/html" : "application/json" }, signal: AbortSignal.timeout(15000),
        });
      } catch (error) { fail(error?.name === "TimeoutError" ? "TIMEOUT" : "NETWORK"); }
      if (response.status === 401) fail("LOGIN_REQUIRED");
      if (response.status === 403) fail("FORBIDDEN");
      if (response.status === 429) fail("RATE_LIMITED");
      if (!response.ok) fail("INVALID_RESPONSE");
      if (html) {
        if (!(response.headers.get("content-type") || "").includes("text/html")) fail("INVALID_RESPONSE");
        const body = await response.text();
        if (body.length > 4000000) fail("LIMIT");
        return { data: body, link: "" };
      }
      if (!(response.headers.get("content-type") || "").includes("application/json")) fail("LOGIN_REQUIRED");
      // Never forward HTML, error bodies, assignment descriptions or attachments.
      let data;
      try { data = await response.json(); } catch { fail("INVALID_RESPONSE"); }
      return { data, link: response.headers.get("link") || "" };
    }
    const url = (path, query = {}) => {
      const result = new URL(path, ORIGIN);
      for (const [key, value] of Object.entries(query)) result.searchParams.set(key, value);
      return result;
    };
    async function list(initial) {
      let next = initial;
      const seen = new Set();
      const rows = [];
      while (next) {
        if (seen.size >= 50 || seen.has(next.href)) fail("PAGINATION");
        seen.add(next.href);
        const result = await get(next);
        if (!Array.isArray(result.data) || result.data.some((row) => !row || !id(row.id))) fail("INVALID_RESPONSE");
        rows.push(...result.data);
        if (rows.length > 5000) fail("LIMIT");
        next = null;
        // Canvas Link pagination. Only accept the same endpoint and query shape;
        // rebuild the URL rather than forwarding arbitrary server-supplied URLs.
        for (const part of result.link.split(/,(?=\s*<)/)) {
          if (!/;\s*rel\s*=\s*"?next"?(?:\s|;|$)/i.test(part)) continue;
          const match = part.match(/^\s*<([^>]+)>/);
          if (!match || next) fail("PAGINATION");
          let linked;
          try { linked = new URL(match[1], ORIGIN); } catch { fail("PAGINATION"); }
          if (linked.origin !== ORIGIN || linked.pathname !== initial.pathname || linked.username || linked.password || linked.hash) fail("PAGINATION");
          for (const key of linked.searchParams.keys()) {
            if (key !== "page" && JSON.stringify(linked.searchParams.getAll(key)) !== JSON.stringify(initial.searchParams.getAll(key))) fail("PAGINATION");
          }
          const pages = linked.searchParams.getAll("page");
          if (pages.length !== 1 || !/^[\w=-]{1,200}$/.test(pages[0])) fail("PAGINATION");
          next = new URL(initial.href);
          next.searchParams.set("page", pages[0]);
        }
      }
      // A changing paginated list can duplicate rows. Do not show double records.
      return [...new Map(rows.map((row) => [String(row.id), row])).values()];
    }
    async function identity() {
      const { data } = await get(url("/api/v1/users/self/profile"));
      if (!data || !id(data.id)) fail("INVALID_RESPONSE");
      return { id: String(data.id), name: text(data.name, 120) || "Canvas student" };
    }
    const user = await identity();
    if (request.expectedUserId && String(request.expectedUserId) !== user.id) fail("ACCOUNT_CHANGED");
    const summarizeCourse = (course) => ({
      id: String(course.id), name: text(course.name), code: text(course.course_code, 120),
      term: text(course.term?.name, 120), state: text(course.workflow_state, 60),
      weighted: typeof course.apply_assignment_group_weights === "boolean" ? course.apply_assignment_group_weights : null,
    });
    const studentCourses = () => list(url("/api/v1/courses", { enrollment_type: "student", enrollment_state: "active", "include[]": "term", per_page: "100" }));
    let payload;
    if (request.operation === "courses") {
      const courses = await studentCourses();
      payload = { courses: courses.map(summarizeCourse) };
    } else {
      const { data: course } = await get(url(`/api/v1/courses/${request.courseId}`, { "include[]": "term" }));
      if (!course || String(course.id) !== String(request.courseId)) fail("INVALID_RESPONSE");
      // This preview is for a student's own grades, not teacher/observer views.
      // The single-course API does not guarantee an enrollments array. Verify
      // membership against a fresh server-filtered list, never a caller-supplied flag.
      const ownCourses = await studentCourses();
      if (!ownCourses.some(c => String(c.id) === String(request.courseId))) fail("NOT_STUDENT");
      if (Array.isArray(course.enrollments) && course.enrollments.length && !course.enrollments.some(e =>
        ["student", "StudentEnrollment"].includes(e.type) && (e.user_id == null || String(e.user_id) === user.id))) fail("NOT_STUDENT");
      const assignments = await list(url(`/api/v1/courses/${request.courseId}/assignments`, { "include[]": "submission", override_assignment_dates: "true", per_page: "100" }));
      let groups = [], groupsUnavailable = false;
      try { groups = await list(url(`/api/v1/courses/${request.courseId}/assignment_groups`, { per_page: "100" })); }
      catch (error) {
        // A permissions/endpoint limitation must not turn a useful assignment
        // preview into "no assignments". Authentication failures still abort.
        if (!["FORBIDDEN", "INVALID_RESPONSE"].includes(error.message)) throw error;
        groupsUnavailable = true;
      }
      // Independent confirmation from the freshly fetched student Marks page.
      // Never execute page scripts, use hidden original/what-if values, or read
      // another student's URL. Unsupported markup remains unavailable.
      const visibleMarks = new Map(), withheldMarks = new Set();
      let marksPageUnavailable = false;
      const gradesPath = `/courses/${request.courseId}/grades`;
      allowedPaths.add(gradesPath);
      try {
        const { data: html } = await get(url(gradesPath), true);
        const doc = new DOMParser().parseFromString(html, "text/html");
        if (!doc.querySelector("#grades_summary")) marksPageUnavailable = true;
        for (const row of doc.querySelectorAll('#grades_summary tr[id^="submission_"]')) {
          const assignmentId = row.id.replace(/^submission_/, "");
          if (!id(assignmentId)) continue;
          if (row.getAttribute("data-muted") !== "false" || row.getAttribute("data-pending_quiz") === "true") {withheldMarks.add(assignmentId);continue;}
          const cell = row.querySelector(".assignment_score .grade");
          if (!cell) continue;
          const hiddenSelector='[hidden], [aria-hidden="true"], [style*="display: none"], [style*="display:none"], [style*="visibility: hidden"]';
          let hidden = cell.closest(hiddenSelector);
          // Canvas ships the whole classic grade-summary-content wrapper with
          // display:none until its JS mounts. This is NOT a grade-release flag.
          // Exempt only that known bootstrap ancestor style, never hidden
          // rows/cells or any other hidden ancestor. Child icons are checked below.
          if(hidden?.id==="grade-summary-content"&&!hidden.hasAttribute("hidden")&&hidden.getAttribute("aria-hidden")!=="true"&&hidden.style.visibility!=="hidden") hidden=hidden.parentElement?.closest(hiddenSelector)||null;
          // A decorative aria-hidden check/cross is Canvas's visible pass/fail
          // result, not a concealed score. Only recognize those exact icons.
          const passFailIcon = cell.querySelector("i.graded_icon.icon-check, i.graded_icon.icon-x");
          const resultLabel = passFailIcon
            ? [...cell.querySelectorAll(".screenreader-only")].map(n => n.textContent.trim()).find(t => /^(Complete|Incomplete)$/i.test(t))
            : null;
          const passFail = resultLabel && (
            (passFailIcon.classList.contains("icon-check") && /^Complete$/i.test(resultLabel)) ||
            (passFailIcon.classList.contains("icon-x") && /^Incomplete$/i.test(resultLabel))
          ) ? resultLabel.toLowerCase() : null;
          if (hidden || cell.querySelector('.icon-off, [hidden]') ||
              [...cell.querySelectorAll('[aria-hidden="true"]')].some(n => n !== passFailIcon || !passFail)) {
            withheldMarks.add(assignmentId);continue;
          }
          const copy = cell.cloneNode(true);
          copy.querySelectorAll('.tooltip_wrap, .screenreader-only, .sr-only').forEach(n => n.remove());
          if (copy.querySelector('[style*="display: none"], [style*="display:none"], [style*="visibility: hidden"]')) {withheldMarks.add(assignmentId);continue;}
          const scoreText = copy.textContent.trim();
          if (passFail && !scoreText) visibleMarks.set(assignmentId, { score: null, grade: passFail });
          else if (/^\d+(?:\.\d+)?$/.test(scoreText)) visibleMarks.set(assignmentId, { score: Number(scoreText), grade: scoreText });
        }
      } catch (error) {
        if (["LOGIN_REQUIRED", "ACCOUNT_CHANGED", "RATE_LIMITED", "TIMEOUT"].includes(error.message)) throw error;
        visibleMarks.clear();
        marksPageUnavailable = true;
      }
      payload = {
        course: summarizeCourse(course), groupsUnavailable, marksPageUnavailable,
        groups: groups.map((g) => ({ id: String(g.id), name: text(g.name), weight: number(g.group_weight),
          rules: { dropLowest: number(g.rules?.drop_lowest), dropHighest: number(g.rules?.drop_highest),
            neverDrop: Array.isArray(g.rules?.never_drop) ? g.rules.never_drop.filter(id).map(String) : [] } })),
        assignments: assignments.filter((a) => a.published !== false).map((a) => {
          if (a.course_id != null && String(a.course_id) !== String(request.courseId)) fail("INVALID_RESPONSE");
          const s = a.submission;
          if (s?.user_id != null && String(s.user_id) !== user.id) fail("ACCOUNT_CHANGED");
          if (s?.assignment_id != null && String(s.assignment_id) !== String(a.id)) fail("INVALID_RESPONSE");
          // Only an explicitly posted, non-hidden grade crosses the boundary.
          const pageMark = visibleMarks.get(String(a.id));
          const pageConfirmed = !!pageMark && (typeof pageMark.score === "number" || a.grading_type === "pass_fail");
          const withheld = withheldMarks.has(String(a.id)) || s?.grade_hidden === true;
          // Assignment.muted is a deprecated notification flag, NOT student
          // release visibility. Fresh Marks row data-muted IS a visibility flag.
          const released = (!!date(s?.posted_at) || pageConfirmed) && !withheld && s?.excused !== true;
          return { id: String(a.id), name: text(a.name), groupId: id(a.assignment_group_id) ? String(a.assignment_group_id) : null,
            dueAt: date(a.due_at), opensAt: date(a.unlock_at), closesAt: date(a.lock_at),
            pointsPossible: number(a.points_possible), gradingType: text(a.grading_type, 40),
            omitted: a.omit_from_final_grade === true, locked: a.locked_for_user === true,
            submission: s || pageConfirmed ? {
              state: text(s?.workflow_state, 60), submittedAt: date(s?.submitted_at),
              postedAt: date(s?.posted_at), released, excused: s?.excused === true,
              releaseEvidence: released ? pageConfirmed ? "marks-page" : "posted-api" : null,
              unavailableReason: released ? null : withheld ? "hidden-in-canvas" : "unconfirmed",
              late: s?.late === true, missing: s?.missing === true,
              currentAttemptGraded: typeof s?.grade_matches_current_submission === "boolean" ? s.grade_matches_current_submission : null,
              // Complete/Incomplete is a result, not an inferred percentage.
              score: released && a.grading_type !== "pass_fail" ? pageConfirmed ? pageMark.score : number(s?.score) : null,
              grade: released ? pageConfirmed ? pageMark.grade : text(s?.grade, 80) : "",
            } : null,
          };
        }),
      };
    }
    const after = await identity();
    if (after.id !== user.id) fail("ACCOUNT_CHANGED");
    return { ok: true, readerVersion, user, source: ORIGIN, fetchedAt: new Date().toISOString(), ...payload };
  } catch (error) {
    return { ok: false, code: allowedErrors.has(error?.message) ? error.message : "INVALID_RESPONSE" };
  }
}
