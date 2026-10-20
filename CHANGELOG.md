# Changelog

## Unreleased

### Documentation

- Update README capabilities, Connect instructions, privacy boundaries and both local database migrations.
- Add VISION and a resumable ROADMAP with MVP stages, workstream IDs, explicit user-test queue and acceptance criteria.
- Condense PROGRESS into an engineering handoff; preserve historical context in an archive digest and Git history.
- Documentation only: no Web/Connect version bump, application deployment or user-data change.

## 0.4.0 — 2026-10-20

- Reuse confirmed Canvas unit/item mappings and suggest unique exact titles or assignment links. Ambiguous matches stay skipped; nothing saves before review.
- Show old → new grades and update only unchanged Canvas-owned values. Manual edits/clears, legacy imports without a baseline, older reads and removed items remain protected. Ungraded links can be saved for later results.
- Preserve source baselines through backups/refresh, mark manual grade edits explicitly, and guard older clients with sync v6.
- Fix course selection and import confirmation checkbox alignment, focus states and click targets. Semester Connect 0.2.1 fixes the Canvas bootstrap-hidden Marks wrapper that incorrectly suppressed all released scores.

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
