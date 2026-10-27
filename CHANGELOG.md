# Changelog

## 0.14.0 — 2026-10-27

- First and returning imports now open a prepared-results list. Reuse saved IDs, prefill tentative matches from assignment labels, similar titles and supporting dates/explicit item percentages, or prepare a new assessment for an otherwise unmatched released numeric grade. Show evidence, destination weight and current/incoming values; Change, Skip and Undo remain available. Competing candidates and source collisions never silently share an overall grade.
- One Import action saves the visible ordinary proposals: no per-row acceptance, second confirmation screen or checkbox. Ambiguous results can wait without blocking ready grades. Ungraded backlog is collapsed; advanced weekly/retake calculations still require explicit rules. JSON and extension checks use the same preparation and planner.
- Missing single-code courses in the same semester may be added with raw results and unknown weights. Group weights and points possible never become individual weights. Preserve these linked course shells during same-board timetable refresh; different-board isolation is unchanged.
- Import lands on the assessment list with grades visible. Protect manual values/clears, personal deadlines, concurrent edits, frozen batches and source-ID persistence. New synthetic checks cover a 64-item first-use batch, 64 separately suggested grades, single-click fake imports, skip/undo/cancel, JSON, reimport and new-batch switching.
- No live imports or manual-data changes. Exact existing-manual-child linking, correcting saved overall links and explicit manual-conflict replacement remain separate work; raw results do not imply a calculated final unit grade.

## 0.13.0 — 2026-10-27

- Connect a newly available result directly inside its update card, with weighted destination suggestions, current/incoming comparison, stable staging and Undo. Ordinary assessments visibly default to an overall result only after choosing a destination; recurring/individual setups still need explicit placement.
- Count both changed connected grades and available unconnected results in the review headline. Distinguish unchanged results from linked items still awaiting a readable result; remove competing per-row actions during multi-select.
- Show per-course read times and explain that Check all reads the selected courses without individually refreshing their Marks pages. Notify when a newer same-account, non-regressive batch arrives; switching requires explicitly discarding the current draft. Never silently replace an open review.
- Preserve confirmation, concurrent-edit rejection, manual data and JSON fallback. Existing-manual-child linking, whole-link repair and explicit manual-conflict acceptance are still pending; this release does not change the import model.

## 0.12.0 — 2026-10-27

- Separate daily grade updates from optional connection maintenance. Ungraded/unlinked backlog is no longer presented as an update count; available unconnected results have their own destination action.
- Show one course at a time with compact Canvas-style rows. Connect opens an assessment-first comparison; whole results versus individual entries are explicit, and calculation rules appear only when relevant. Suggestions include weights but still need confirmation.
- Keep confirmed links as collapsed context even when filtering them out. Staged connections stay visible and reversible; saved rules are reused without re-entering their parameters.
- Add regression coverage for the update/backlog distinction, filtered context, and manual deadline extensions surviving new Canvas grades through both JSON and direct snapshots. No live import is performed.
- Existing-manual-child linking, correction of already saved whole-result links and explicit acceptance of conflicting manual values remain pending. The interface explains these limits rather than silently duplicating or moving records.

## 0.11.0 — 2026-10-26

- Replace duplicate group/rule/item forms with one grouped source-to-assessment comparison. Display original Canvas names and distinct Semester destinations with weights; groups never become extra assessments or inferred combined grades.
- Reuse saved source-ID links with explicit linked/new-result/unchanged/protected states. Skipping a saved link for one check no longer labels it never linked; restore it without rematching.
- Show bulk individual-result setup only after selecting source items. Preserve explicit calculation/drop-rule guards, selected rows, Undo and JSON/direct matching parity.
- Add user stories, synthetic group/matching regressions and isolated browser QA. Manual data, calendar tasks and confirmation boundaries remain unchanged. Existing manual-child linking, overall-to-child repair and explicit acceptance of a conflicting Canvas value remain separate work.

## 0.10.0 — 2026-10-26

- Focus returning Canvas previews on real grade changes. Collapse optional unmatched items and protected values; never-linked does not mean newly created in Canvas.
- Keep selected matching rows visible, label selections as unsaved, allow Undo, and count actual proposed changes on Review rather than all remembered matches.
- Add confirmed-import history in Assessments and Manage, including before/after descriptions, protected entries and skipped counts. Receipts share the grade save, backups and board lifecycle; no receipt on preview, cancellation or repeated no-op import. Retention is bounded and disclosed; previous imports are not reconstructed.
- Mark unseen imported grade changes with a labelled dot. A history link opens the relevant unit and grade editor; opening the grade clears only the indicator. Dismissed pending checks can be reopened without a new check.
- Preserve manual values, unknown results, frozen reviews, concurrent-edit guards and JSON fallback. Sync guard v9 protects receipts from older tabs. Synthetic tests do not constitute real-user acceptance; no live imports were confirmed.

## 0.9.0 — 2026-10-24

- Add **Check all N courses** with Connect 0.4.0: one explicit batch checks the previously enabled courses using one existing signed-in Canvas tab. No automatic import.
- Returning imports open a compact update summary: changed grades, unmatched items, and named protected entries. Unchanged records, source details and JSON fallback stay collapsed.
- Replace the ambiguous “Show unmatched items” filter with **Resolve unmatched items**, focus the matching section, explain the next action, and offer existing confirmed retake/completion rules as explicit destinations. Appending an unknown prework preserves its unknown result and does not create a calendar task.
- Preserve frozen reviews, concurrent-edit rejection, manual/cleared values and source-ID protection. Verification uses invented data; real four-course batch acceptance remains separate.

## 0.8.0 — 2026-10-24 (source checkpoint; deployment separate)

- Subsequently deployed as Sites version 45, source `85498d9`; production UI confirmed Web 0.8.0. This records deployment, not four-course acceptance.

- Make Canvas update review explicit: new/updated results with before → after values, never-linked/unmatched items that stay skipped, manual/cleared/removed entries protected, and rule/source changes requiring separate review. Collapse unchanged rows.
- Receive opt-in Connect 0.3.0 pending snapshots in the same Chrome profile. Reuse the JSON parser, saved source-ID matching and pure import planner; no new write endpoint or automatic confirmation. Opening a review freezes its source snapshot, and concurrent board changes invalidate acknowledgement.
- Retain **Manage → Import from Semester Connect → JSON import** as a testing/fallback path. Show per-course read timestamps; unvisited courses are not claimed to be fresh.
- Synthetic UI checks cover banner → review, frozen source, stale-board rejection, cancellation, JSON upload, explicit test-only confirmation and preservation of manual grades/clears. TypeScript, web regression scripts and production build pass. No live grades imported; real Chrome permission/reload acceptance and deployment remain separate steps.

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
