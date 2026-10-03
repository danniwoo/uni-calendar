# Implementation checkpoint

## Goal
USYD semester-only assessment and weekly-learning tracker. Timetable URL discovers enrolled units and real class instances. Official matching unit outlines supply assessment dates, weights and topics. Unknown timing stays in a tray. Completion tracking must survive reloads. Usually four units; responsive mobile layout.

## Current checkpoint
A/B comparison added: A preserves the full v2 overview; B uses a full-width board with pending-details tray collapsed, next-seven-day tasks (including real recurring deadlines), near teaching weeks expanded and farther weeks compact but milestones visible. Tutorial participation shares the tutorial entry while retaining independent participation/learning state. B task sheets read first, edit on demand. Layout choice is a device-local preference only; both views use identical account data and save logic. No new API, migration or model calls. Existing milestone and source-conflict warnings remain visible in compact weeks.

October 4 review fixes: compact routine rows, milestone-only upcoming strip, collapsed breaks, ongoing project aggregate in unit header/details, explicit assessmentSummary parsing (per-occurrence weights, hurdles, reattempt count, coverage text/week ranges), table/schedule conflict flags, honest class-window timing, optional-bonus labeling, per-field manual overrides, correct placement and linked individual occurrences, lecture catch-up control, JSON backup restore, and three-way optimistic save recovery. Existing records upgrade from saved outline text on read, without background network imports. No AI API calls added. Tests cover rules, placement, manual overrides, concurrency, migration idempotence and DST. Local browser verified separate-tab completion merge; test ticks restored. Source-rule parsing is conservative, not a general language model. Exact topic-to-week inference, Ed/Canvas-only facts, score-aware cap tracking, PDF/OCR and automatic absence allowance remain out of scope. Current sharing includes one external viewer; preserve it on deployment (do not use owner-only private deploy).

Functional app implemented: private timetable import, matching outline discovery, 2026 teaching-week mapping, deterministic assessment extraction, class-linked quizzes, learning topics, completion, manual task edits/addition, planned spans, coverage-linked lectures, recurring occurrences, unknown-details tray, refresh preservation, account-scoped D1 saving and backup export. No sample data ships in the app. Real import tested with 4 units, 89 class events and 74 assessment occurrences. Local preview: `npm run dev` (normally http://127.0.0.1:5173). Initial D1 migration applied locally. Check the existing Site's deployment status for the live version; this checkpoint precedes publishing.

## Guardrails
- Stop immediately if weekly Codex allowance remaining is below 40%. Last checked: 74% remaining.
- Never put the private timetable subscription URL, ICS files, credentials or personal progress in Git.
- Do not infer due dates from closing dates; do not invent release dates or quiz coverage.
- Midsemester break is not a teaching week. Use Australia/Sydney time and handle DST.
- Preserve user edits/completion on refresh. Keep undated tasks visible.
- Scope excludes Canvas/Ed login, PDF/OCR, day/month views and notifications for now.

## Resume
Read this file and git status. Continue in this app folder. User's GitHub checkpoint repository is origin. Sites hosting identity is in `.openai/hosting.json`; reuse it, never create another site. Site audience is owner-private. Use its existing deployment status rather than assuming this checkpoint's publication state is current. Saved source is independent of the running preview; closing laptop does not erase code. App data is distinct from Git source. Hosted and local preview accounts/databases are separate.

## Verification already performed
TypeScript and production build passed. Import parsing checked against all four real public outlines (downloaded only to temporary files). Browser verified end-to-end import, saved state after reload, lecture completion persisted (test tick restored to unchecked), quiz detail panel and staged W4–7 lecture coverage. WebMCP read and open tools registered and worked; invalid task id rejected. Mobile and desktop layouts inspected. Synthetic regression script remains in the repository. Next: final responsive check, final build, private deployment, and push final checkpoint.
