# Implementation checkpoint

## Goal
USYD semester-only assessment and weekly-learning tracker. Timetable URL discovers enrolled units and real class instances. Official matching unit outlines supply assessment dates, weights and topics. Unknown timing stays in a tray. Completion tracking must survive reloads. Usually four units; responsive mobile layout.

## Current checkpoint
Initial interface is implemented with clearly labelled example data. Timetable importer, durable state and real task interactions are next. Dependencies installed. Local preview: `npm run dev` (normally http://127.0.0.1:5173).

## Guardrails
- Stop immediately if weekly Codex allowance remaining is below 40%. Last checked: 76% remaining.
- Never put the private timetable subscription URL, ICS files, credentials or personal progress in Git.
- Do not infer due dates from closing dates; do not invent release dates or quiz coverage.
- Midsemester break is not a teaching week. Use Australia/Sydney time and handle DST.
- Preserve user edits/completion on refresh. Keep undated tasks visible.
- Scope excludes Canvas/Ed login, PDF/OCR, day/month views and notifications for now.

## Resume
Read this file and git status. Continue in this app folder. User's GitHub checkpoint repository is origin. Sites hosting identity is in `.openai/hosting.json`; reuse it, never create another site. Site remains private and unpublished. Saved source is independent of the running preview; closing laptop does not erase code.
