// Load the real unpacked extension into a disposable Chrome profile.
// Every Canvas URL is intercepted with synthetic data; no account is used.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const extensionPath = fileURLToPath(new URL("../", import.meta.url));
const ORIGIN = "https://canvas.sydney.edu.au";
const context = await chromium.launchPersistentContext("", { channel: "chrome", headless: true,
  viewport: { width: 1440, height: 1000 },
  ignoreDefaultArgs: ["--disable-extensions"], args: ["--enable-unsafe-extension-debugging"] });
try {
  const cdp = await context.browser().newBrowserCDPSession();
  const { id } = await cdp.send("Extensions.loadUnpacked", { path: extensionPath });
  console.log("Loaded unpacked extension in disposable profile.");
  const worker = context.serviceWorkers().find((w) => w.url().startsWith(`chrome-extension://${id}/`)) || await context.waitForEvent("serviceworker");
  console.log("Background ready:", await worker.evaluate(() => chrome.action.onClicked.hasListeners()));
  let apiReads = 0;
  const course = { id: 12, name: "Synthetic Canvas course", course_code: "TEST1001", term: { name: "Test term" }, enrollments: [{ type: "student", user_id: 91 }], apply_assignment_group_weights: true };
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.protocol === "chrome-extension:") return route.continue();
    if (url.origin !== ORIGIN) return route.abort();
    assert.equal(request.method(), "GET", "Only GETs are allowed");
    if (!url.pathname.startsWith("/api/")) return route.fulfill({ contentType: "text/html", body: "<!doctype html><h1>Synthetic Canvas — no real data</h1>" });
    apiReads++;
    let body;
    if (url.pathname === "/api/v1/users/self/profile") body = { id: 91, name: "Synthetic Student" };
    else if (url.pathname === "/api/v1/courses") body = [course];
    else if (url.pathname === "/api/v1/courses/12") body = course;
    else if (url.pathname === "/api/v1/courses/12/assignment_groups") body = [{ id: 3, name: "Weekly quizzes", group_weight: 21, rules: {} }];
    else if (url.pathname === "/api/v1/courses/12/assignments") body = [{ id: 1, name: "Synthetic quiz", course_id: 12, assignment_group_id: 3, points_possible: 3, due_at: "2026-10-18T12:59:00Z", grading_type: "points", submission: { user_id: 91, assignment_id: 1, workflow_state: "graded", posted_at: "2026-10-18T03:00:00Z", score: 2.7, grade: "2.7" } }];
    else throw new Error(`Unexpected endpoint ${url.pathname}`);
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  const source = await context.newPage();
  await source.goto(`${ORIGIN}/courses/12/grades`);
  await source.bringToFront();
  console.log("Opened intercepted synthetic Canvas tab.");
  const { targetInfos } = await cdp.send("Target.getTargets", { filter: [{ type: "tab" }] });
  const targetInfo = targetInfos.find((target) => target.url === source.url());
  assert.ok(targetInfo, "The synthetic Canvas tab target must exist");
  const previewPromise = context.waitForEvent("page");
  // Avoid masking a CDP failure with a dangling page-event promise on cleanup.
  previewPromise.catch(() => {});
  await cdp.send("Extensions.triggerAction", { id, targetId: targetInfo.targetId });
  console.log("Triggered toolbar action.");
  const preview = await previewPromise;
  await preview.waitForLoadState();
  console.log("Preview opened.");
  assert.match(preview.url(), /^chrome-extension:/);
  assert.equal(apiReads, 0);
  await preview.locator("#courses").click();
  await preview.locator("#workspace").waitFor({ state: "visible", timeout: 15000 });
  await preview.locator("#course").selectOption("12");
  await preview.locator("#read").click();
  await preview.locator("#results").waitFor({ state: "visible", timeout: 15000 });
  assert.match(await preview.locator("#rows").innerText(), /2\.7 \/ 3/);
  assert.match(await preview.locator("#rows").innerText(), /23:59/);
  assert.equal(apiReads, 8);
  await source.close();
  await preview.locator("#start").waitFor({ state: "visible" });
  assert.equal(await preview.locator("#rows tr").count(), 0);
  console.log("PASS: actual unpacked extension load, action/activeTab permission, isolated-world Canvas GETs, release/date rendering and tab-close clearing (synthetic Canvas only).");
} finally { await context.close(); }
