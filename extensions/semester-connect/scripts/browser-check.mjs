// Desktop-only UI checks using a disposable Chrome profile and synthetic data.
// No Canvas requests and no access to the user's Chrome profile.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
const allowed = new Set(["preview.html", "preview.css", "preview.js", "reader.js", "model.js"]);
const server = createServer(async (request, response) => {
  const name = new URL(request.url, "http://localhost").pathname.slice(1);
  if (!allowed.has(name)) { response.writeHead(404).end(); return; }
  const types = { html: "text/html", css: "text/css", js: "text/javascript" };
  response.setHeader("Content-Type", types[name.split(".").at(-1)]);
  response.end(await readFile(path.join(root, name)));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("**/*", (route) => {
    if (route.request().url().startsWith(base)) return route.continue();
    throw new Error("UI test attempted an external request");
  });
  await page.addInitScript(() => {
    const profile = { id: "91", name: "Synthetic Student" };
    const course = { id: "12", name: "Data and Information Management — synthetic fixture", code: "TEST1001", term: "Semester 2 · fixture", weighted: true };
    const other = { ...course, id: "13", name: "Second fixture unit", code: "TEST1002" };
    const submitted = { state: "graded", submittedAt: "2026-10-16T04:22:00Z", postedAt: "2026-10-18T02:00:00Z", released: true, score: 2.7, grade: "2.7", currentAttemptGraded: true };
    const assignment = { id: "1", name: "Week 10 quiz", groupId: "3", dueAt: "2026-10-16T05:00:00Z", opensAt: "2026-10-15T13:00:00Z", closesAt: "2026-10-17T12:59:00Z", pointsPossible: 3, gradingType: "points", submission: submitted };
    const assignments = [assignment,
      { ...assignment, id: "2", name: "SQL Quiz", pointsPossible: 10, submission: { ...submitted, score: 10 } },
      { ...assignment, id: "3", name: "Assignment 1 — waiting for release", pointsPossible: 20, submission: { ...submitted, score: null, released: false, postedAt: null, state: "submitted" } },
      { ...assignment, id: "4", name: "Zero is a real grade", submission: { ...submitted, score: 0 } },
      { ...assignment, id: "5", name: "Excused quiz", submission: { ...submitted, score: null, excused: true } },
      { ...assignment, id: "6", name: "Undated assessment", dueAt: null, submission: null },
      { ...assignment, id: "7", name: "<img src=x onerror=alert(1)> · source text, not HTML", submission: null },
    ];
    window.fixture = { calls: [], pending: false, nextError: null, release: null, removed: null, updated: null };
    window.chrome = {
      runtime: { getManifest: () => ({ version: "0.2.3" }) },
      tabs: { get: async () => ({ url: "https://canvas.sydney.edu.au/courses/12/grades" }),
        onRemoved: { addListener: (fn) => { window.fixture.removed = fn; } },
        onUpdated: { addListener: (fn) => { window.fixture.updated = fn; } },
      },
      scripting: { executeScript: async ({ args }) => {
        const request = args[0];
        window.fixture.calls.push(request);
        if (window.fixture.pending) await new Promise((resolve) => { window.fixture.release = resolve; });
        if (window.fixture.nextError) { const code = window.fixture.nextError; window.fixture.nextError = null; return [{ result: { ok: false, code } }]; }
        const common = { ok: true, readerVersion: "0.2.3", user: profile, source: "https://canvas.sydney.edu.au", fetchedAt: "2026-10-18T05:00:00Z" };
        return [{ result: request.operation === "courses" ? { ...common, courses: [course, other] } : { ...common,
          course: request.courseId === "12" ? course : other, assignments,
          groups: [{ id: "3", name: "Weekly quizzes", weight: 21, rules: { dropLowest: 1, dropHighest: 0, neverDrop: ["1"] } }], groupsUnavailable: false } }];
      } },
    };
  });
  await page.goto(`${base}/preview.html`);
  assert.equal(await page.locator("#courses").isDisabled(), true);
  assert.equal(await page.evaluate(() => fixture.calls.length), 0);
  await page.goto(`${base}/preview.html?tab=10`);
  assert.equal(await page.evaluate(() => fixture.calls.length), 0);
  await page.getByRole("button", { name: "Read my courses" }).click();
  await page.locator("#workspace").waitFor({ state: "visible" });
  assert.equal(await page.locator("#read").isDisabled(), true);
  await page.locator("#course").selectOption("12");
  await page.locator("#read").click();
  await page.locator("#results").waitFor({ state: "visible" });
  assert.equal(await page.locator("#rows tr").count(), 7);
  assert.equal(await page.locator("#rows img").count(), 0);
  assert.match(await page.locator("#rows").innerText(), /0 \/ 3/);
  assert.match(await page.locator("#rows").innerText(), /Awaiting grade/);
  assert.match(await page.locator("#rows").innerText(), /Excused/);
  assert.match(await page.locator("#rows tr").last().innerText(), /Undated assessment/);
  assert.equal(await page.locator("#canvas-grades").getAttribute("href"), "https://canvas.sydney.edu.au/courses/12/grades");
  await page.locator(".groups summary").click();
  assert.match(await page.locator("#groups").innerText(), /21% configured group weight/);
  assert.match(await page.locator("#groups").innerText(), /Drop lowest: 1/);
  await page.locator("#rows tr").first().locator("summary").click();
  assert.match(await page.locator("#rows tr").first().innerText(), /Opens/);
  await page.locator("#status").selectOption("released");
  assert.equal(await page.locator("#rows tr").count(), 3);
  await page.locator("#search").fill("SQL");
  assert.equal(await page.locator("#rows tr").count(), 1);
  await page.locator("#search").fill("no such item");
  assert.equal(await page.locator("#empty").isVisible(), true);
  await page.locator("#search").fill("");
  await page.locator("#status").selectOption("all");
  await page.locator("#read").click();
  await page.locator("#results").waitFor({ state: "visible" });
  assert.equal(await page.locator("#rows tr").count(), 7);
  if (process.env.CONNECT_TEST_SCREENSHOT) await page.screenshot({ path: process.env.CONNECT_TEST_SCREENSHOT, fullPage: true });
  await page.locator("#course").selectOption("13");
  assert.equal(await page.locator("#results").isVisible(), false);
  assert.equal(await page.locator("#rows tr").count(), 0);
  await page.evaluate(() => { fixture.pending = true; });
  await page.locator("#read").click();
  await page.waitForFunction(() => !!fixture.release);
  await page.locator("#clear").click();
  await page.evaluate(() => { fixture.pending = false; fixture.release(); });
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#results").isVisible(), false);
  assert.equal(await page.locator("#identity").innerText(), "");
  await page.locator("#courses").click();
  await page.locator("#workspace").waitFor({ state: "visible" });
  await page.locator("#course").selectOption("12");
  await page.evaluate(() => { fixture.nextError = "ACCOUNT_CHANGED"; });
  await page.locator("#read").click();
  await page.waitForFunction(() => document.getElementById("message").textContent.includes("ACCOUNT_CHANGED"));
  assert.equal(await page.locator("#workspace").isVisible(), false);
  await page.locator("#courses").click();
  await page.locator("#workspace").waitFor({ state: "visible" });
  await page.evaluate(() => fixture.updated(10, { status: "loading" }));
  assert.equal(await page.locator("#workspace").isVisible(), false);
  assert.match(await page.locator("#message").innerText(), /navigated/);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.deepEqual(errors, []);
  console.log("PASS: desktop preview, no automatic reads, safe rendering, course selection, grades/filters, group rules, repeat read, clear-in-flight, account error and navigation clearing.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
