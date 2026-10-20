# Changelog

## 0.3.0 — 2026-10-20

- Manage → Import from Semester Connect: local JSON review, explicit unit/item mapping and confirmation before account save.
- Fill blank assessment grades, optionally combine a Canvas group as individual results, or explicitly add a new assessment with unknown weight. No fuzzy matching or automatic date/weight replacement.
- Preserve existing scores, cleared grades, manual grade plans, names, dates, activity timing, notes and completion. Account-scoped import IDs prevent duplicates and accidental remapping.
- Imported part totals remain provisional until their item list/calculation is reviewed. Drop-rule groups are not automatically combined.
- Backup/timetable refresh retain import links; sync v5 protects them from older tabs. Semester Connect independently advances to 0.2.0; no background sync or Web Store release.

## 0.2.0 — 2026-10-20

- Add optional activity timing to assessments: teaching week, single date or date range, independently from the submission deadline.
- Show activity reminders in Week and Month without splitting the assessment or duplicating grades and completion.
- Preserve activity edits/removal through refresh, backups and concurrent saves; reject invalid timing.
- Show the web application version in the footer. Semester Connect has its own version and changelog.
