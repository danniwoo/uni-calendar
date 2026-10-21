# Changelog

## 0.7.0 — 2026-10-22

- Connect existing assessments to selected Canvas items using confirmed highest-attempt or best-N completion rules, including attempts across Canvas groups. Configure counts, completion points and optional thresholds before staging the preview.
- Show each proposed source result and the resulting aggregate before confirmation. Keep unknown/unlinked opportunities blank; only explicitly confirmed misses become zero. Do not alter calendar tasks, dates, weights or completion.
- Remember source-ID rule mappings and per-entry baselines for subsequent JSON imports. Preserve manual grades, clears, renamed/removed/excluded entries and rule changes; stop updates when Canvas group rules or maximum marks change. No direct sync or polling in this release.
- Protect new provenance from older clients with sync guard v8; retain backup support. Add synthetic rule-import regression and an isolated browser QA harness. No real pending grades are imported by this release.

## 0.6.0 — 2026-10-21

- Add generic highest-attempt and binary best-N submission rules inside the existing assessment grade editor, including single quizzes.
- Configure included counts, completion points and an optional numerical pass threshold; keep original attempt marks and independently track unknown, not-taken, awaiting, submitted, missed and future states.
- Show secured completion points rather than treating unfinished completion tallies as marked-work averages. Stop double counting and keep threshold checks separate from calendar completion and official hurdles.
- Keep excess entries when reducing counts, protect manual rules against Canvas reimports, and require older tabs to reload before saving rule-bearing boards (sync guard v7).
- Add synthetic regression and isolated browser QA fixtures. No user's pending retake/prework results are automatically filled or imported. Connect remains 0.2.3; automatic special-rule mapping is not included.

## 0.5.0 — 2026-10-20

- Split Canvas import into **Match assessments → Review & confirm**, with explicit skipped/new-item counts, search and result filters, and separate changed/unchanged previews.
- Show existing Semester grades beside Canvas results. Offer unit-scoped assignment-label/title candidates only on user selection; remembered/exact mappings remain reviewable. No automatic fuzzy matching or bulk "add everything".
- Require an explicit calculation method for weekly/multi-part grade groups. Detect named retakes, warn on individual attempts and reject bulk averaging in both UI and import logic; no inferred highest/latest/capped-result policy.
- Show Complete/Incomplete as text in import review, without converting them to marks or completion.
- Invalidate confirmation if Semester data changes while reviewing. Preserve manual grades, dates, weights, notes, completion, existing import ownership and duplicate protection.
- Verified using synthetic import UI, import/retake regression checks, extension checks and TypeScript. Real user mapping/confirmation remains an acceptance step; no real records were imported during development.

## 0.4.1 — 2026-10-20

### Fixed

- Add missing Delete assessment in saved, manually created assessment detail/edit panels, with confirmation and immediate Undo.
- Explain when deletion includes child steps/occurrences and their grades/completion; preserve unrelated records and Canvas import ledgers.
- Protect imported assessments even after manual edits, reject stale confirmation and prevent undo from overwriting newer changes or crossing board replacements.

### Documentation

- Update README capabilities, Connect instructions, privacy boundaries and both local database migrations.
- Add VISION and a resumable ROADMAP with MVP stages, workstream IDs, explicit user-test queue and acceptance criteria.
- Condense PROGRESS into an engineering handoff; preserve historical context in an archive digest and Git history.
- These documentation updates were committed separately before this bug fix. Connect remains 0.2.1; no user-data migration.

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
