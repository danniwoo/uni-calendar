# Engineering handoff

Updated: 2026-10-22. **Priorities, resumable work and acceptance tests live only in [ROADMAP](ROADMAP.md).** This file is technical context, not a second backlog.

## Current source checkpoint

- Web **0.7.0**, Connect **0.2.3**, import format **1**, web sync guard **v8**.
- Implementation checkpoint: `0374e9c` — `feat(connect): reuse mappings and safely update imported grades`.
- Web release was published in the preceding release workflow. Connect remains an unpacked extension requiring Chrome reload and a fresh preview/read/download.
- Safe updates reuse confirmed account/course/item mappings and compare source baselines. Manual edits/clears, stale files, legacy records without a baseline and removed items are protected.
- Connect 0.2.2 additionally removes the incorrect API `assignment.muted` veto (deprecated notification flag); student Marks row `data-muted`, pending quiz, submission `grade_hidden` and excused checks remain authoritative. Complete/Incomplete icon + accessibility-label pairs are text-only (`score:null`), not inferred percentages.
- A user-generated 0.2.2 export after reload passed format validation; released numeric/text results matched the earlier read-only four-course Marks comparison. End-to-end mapping/import acceptance remains outstanding ([CONNECT-01](ROADMAP.md#connect-01)). No private export or individual marks belong in Git.
- Web 0.4.1 adds missing manual-assessment deletion, confirmation and immediate conflict-aware undo. `manual` alone is not provenance: require a saved `manual-` root absent from outline assessments. Cascade descendants, retain Canvas ledgers, and reject stale confirmation/source-defined descendants.
- No live user records were changed during QA. User acceptance remains T09 / FLOW-01-F1 in ROADMAP; previous workstreams retain their pending tests.

## Resume safely

1. Read ROADMAP's dashboard and the relevant work card/test ID.
2. Check `git status`, current branch and any overlapping changes. Preserve user changes.
3. Inspect relevant code and tests below; reproduce the specific issue before changing behaviour.
4. On handoff, update the same roadmap card's next action and test evidence. “Implemented”, “published” and “user verified” are separate facts.
5. Record code/check details here only when they help the next session. Release notes belong in the appropriate changelog.
6. Preserve detailed implementation reasoning, failed approaches, edge cases and test evidence. Before shortening this handoff, move the full prior text into a dated archive with a historical-status warning and link it here; a summary or Git history alone is not a replacement.

## Code map

| Area | Main entry points | Checks |
| --- | --- | --- |
| Import, rules, teaching weeks | `lib/importer.ts`, `lib/semester.ts`, `lib/assessment-rules.ts` | `scripts/check-import.ts` |
| Persistence, merge, restore | `lib/storage.ts`, `lib/sync.ts`, `lib/backup.ts`, `app/api/semester/route.ts`, `drizzle/` | `check-backup.ts`, `check-backup-storage.mjs` |
| Semester / Week / Month | `components/semester-board.tsx`, `components/week-calendar.tsx`, `components/month-calendar.tsx` | `check-semester-display.ts`, `check-week.ts`, `check-import.ts` |
| Subject / preparation | `components/unit-detail.tsx`, `components/assessment-scope.tsx`, `lib/subject-view.ts`, `lib/learning-scope.ts` | `check-subject.ts` |
| Assessment inventory / schedules | `components/assessment-list.tsx`, `components/assessment-steps.tsx`, `lib/assessment-schedule.ts`, `lib/assessment-activity.ts` | `check-assessment-list.ts`, `check-assessment-schedule.ts`, `check-assessment-activity.ts` |
| Manual assessment deletion | `components/assessment-delete.tsx`, `lib/assessment-delete.ts`, `components/semester-board.tsx` | `check-assessment-delete.ts` |
| Personal tasks / events | `components/personal-editor.tsx`, `lib/personal-items.ts` | `check-personal.ts` |
| Grades | `components/assessment-grades.tsx`, `components/grade-parts-editor.tsx`, `lib/grades.ts` | `check-grades.ts`, `check-grade-parts.ts` |
| Canvas | `extensions/semester-connect/`, `components/canvas-import.tsx`, `lib/canvas-import.ts` | extension `npm test`, `scripts/check-canvas-import.ts` |

Check filenames without a directory prefix in the table are under `scripts/`. Commands and local database setup are in [README](README.md#local-development).

## Verification evidence and limits

### Web 0.7.0 Canvas rule imports

`CanvasChoice.rule` opts into a separate pure rule planner (`lib/canvas-rule-import.ts`). User selects one existing parent, explicit source IDs across groups, and highest/count/optional threshold or completion/count/bestCount/points. Source-number names are retained independently of calendar occurrence weeks. Untouched deterministic unknown placeholders reserve the remaining opportunities; a later explicitly linked source replaces only an untouched placeholder, never a user-edited slot. No automatic fuzzy rule selection, no inferred latest-attempt rule, no direct extension-to-app transport.

Ledger records retain confirmed rule configuration, per-item baseline and Canvas group metadata. New imports only update identical source-owned entries under the same active rule; manual overall grades/clears, pre-existing manual plans, changed item content, deletions/exclusions, changed rule settings and changed Canvas group metadata are protected. Explicit missed-submission decisions are marked manual. Not-taken attempts can later receive a released numeric result. Complete converts to submitted only under the confirmed binary rule; Incomplete, hidden, blank or absent items do not infer zero. Reimported unknowns never erase existing results. Rule changes require manual review rather than silent recalculation. `saveGradePlan` also tracks outcome/name/config edits for provenance. Sync v8 prevents older writers from dropping this ledger.

Tests: `check-canvas-rules.ts` covers cross-group attempts, best-N cap denominator, stable IDs, future placeholders, partial-to-settled results, safe source updates, repeated imports, changed source rules/maxima, manual/cleared/removed states, backup metadata, identity isolation and atomic invalid selections. Existing web regression scripts, TypeScript and SQL storage tests also run. `scripts/canvas-rules-qa/` serves invented data with in-memory writes only; browser verification covers explicit selection, not-taken/missed controls, staging without writes, aggregate preview, confirmation reset on Back, confirmation totals and remembered mappings. No user grades or exports are test fixtures; real special-rule import still requires user confirmation.

The v0.6.0 notes below describe the preceding release; its importer restriction is superseded only by the explicit rule path above. Ordinary points/equal imports still reject drop-rule/retake groups.

### Web 0.6.0 grading rules

`GradePlan.method` adds `highest` and `completion`; optional `completionPoints`, `attemptsClosed`, `passMark` and per-item `outcome` are validated through the shared backup/API validator. No database migration: rules live in the existing per-account Semester JSON. Outcomes are separate from numeric grades and calendar completion. Changing rule/source keeps raw numeric grades; excluded entries are retained. Counts must be applied before saving a changed count. Do not infer missing/late/zero from a blank.

Highest compares fractions, not raw points; all numeric attempts or an explicit closed set of scored/not-taken entries settles the result. Awaiting/unknown blanks do not settle it. Numerical threshold is independent of finality, assessment weight and official hurdle state. Binary completion uses `min(submitted, bestCount) × completionPoints` over the fixed best-N maximum. Confirmed missed contributes zero, unknown/future remains unresolved. All outcomes resolved or enough submissions to reach the cap settles the result without changing future entries. Partial completion is a lower bound: keep it out of the marked-work average; display its secured unit points separately and pause target estimates while partly resolved groups remain.

Existing Canvas part updates only support points/equal plans and therefore preserve these user-configured methods. No new automatic retake mapping, text-to-binary import, or Canvas polling. Guard v7 checks both active and inactive new rule fields, including outline-root overrides, to reject older writers that would drop them. Conflict resolution still treats each gradePlan atomically.

Checks: `check-grade-rules.ts` covers highest/threshold boundaries, future/awaiting/unknown/zero, best-N caps, other-unit configurations, stats, source switching, backups/refresh, stale edits and repeat-import protection; storage test checks rules survive SQL JSON storage. The full web check scripts and TypeScript were rerun. `scripts/grade-rules-qa/` is a reusable isolated React fixture with invented data and localhost-only persistence, no account/API connection. Browser QA covers entering three attempts, blank third attempt, exact threshold, best 8 of 10 × 0.5, distinct unknown/missed/future states, reaching the cap before the last opportunity, cancel and save/reload. No pending real ELEC marks were written. User acceptance remains T10; automated tests do not certify course-specific policy.

Prior-turn acceptance update (no private scores retained): 17 user-approved mapped results were imported and verified after reload, with no new assessments; retake/prework remained pending. Track the remaining real repeat-import/update checks under T02.

Connect 0.2.2: 34 Node tests and 81 real-browser DOMParser assertions passed, plus four-course synthetic preview selection/batch read, grade filters, mixed-manifest error UI and the website's complete import-protection regression script. Reproducible harness: `extensions/semester-connect/scripts/qa-server.mjs`. It serves only synthetic fixtures on localhost; production reader body is unchanged, with lexical origin/fetch doubles. No real grades are fixtures.

Diagnosis used read-only live Marks pages and a focused API comparison: deprecated assignment `muted:true` existed alongside posted scores visible to the student. Complete icons were incorrectly caught by the generic `aria-hidden` descendant rejection. The user's earlier export also identified an older manifest version, so 0.2.2 checks manifest/reader/preview consistency before read/export. Keep the embedded reader version synchronized (Node test enforces this).

Installed-extension end-to-end QA is **not complete**: browser policy blocks `chrome-extension://` access. Do not circumvent it. The user subsequently reloaded and supplied a fresh 0.2.2 four-course export; released results were checked against earlier live evidence and passed the website parser. This does not validate every date, mapping or write. No real import, Canvas mutation or web publication occurred for this extension patch.

Resolved in Connect 0.2.3: an unsubmitted pass/fail item with `posted_at` but no result previously retained `released:true` with `score:null` and empty `grade`. Release now requires an actual result as well as visibility evidence. Submission state, result visibility and completion remain separate. 35 Node tests and 89 real-DOM synthetic assertions pass; no numeric fallback invents a pass/fail result.

Web 0.5.0 import flow: `CanvasImport` separates match and review states, invalidates acknowledgment on changes/back-navigation and holds the exact reviewed Semester reference for the existing parent commit guard. Search/filter never clears choices; summaries count the entire selection, not just visible rows. Unit changes clear that course's choices. New assessments remain an explicit secondary option; no bulk creation.

`canvasCandidates` supplies opt-in unit-scoped title/assignment-label candidates; it never feeds automatic choices. `canvasGroupBlock` enforces unknown/drop-rule and named-retake restrictions in both the UI and pure planner, including partial-group selections. Retakes are not auto-suggested on first import; confirmed saved mappings remain reusable. This heuristic cannot recognize every naming pattern and does not decide highest/latest/capped rules. Groups require explicit points/equal selection. Complete/Incomplete is sanitized for display only; numeric import calculations are unchanged.

Synthetic UI evidence: candidate selection, no default group calculation, retake group blocking, duplicate overall-target error, text results, cancellation with zero writes, preserved manual grade, provisional parts without new tasks, remembered mappings and zero-change repeat import, and concurrent-data-change invalidation. Browser QA used a checkout-ignored localhost React harness with invented fixtures, not the signed-in website or Canvas. Keep actual user acceptance of mappings/import under T02; do not treat this as permission to import their file.

For 0.4.1, all web regression scripts, storage checks and TypeScript passed. The temporary full-board browser harness intercepted account API calls with synthetic data only. It verified deletion from summary/edit, cancellation, Undo restoring grades/completion, group scope, imported-item protection, simulated reload persistence and removal from Week. The harness was removed before packaging. Production-build/publication verification is part of the release workflow; inspect deployment status when resuming.

The 0.4.0 implementation handoff recorded passing TypeScript, production build, web regression suites and 30 extension reader tests. Isolated synthetic browser checks covered:

- Four-course selection, failures/retry and private export.
- Marks HTML visibility, pending/hidden/What-If exclusions.
- Import review, remembered mappings, source-grade updates, manual-grade protection and repeat-import idempotence.

These are developer checks, not confirmation that every live course layout or human workflow is correct. Older optional extension browser scripts are historical integration checks, not proof of current live compatibility. See [Connect's verification notes](extensions/semester-connect/README.md).

Documentation changes require link/path/version checks and `git diff --check`; they do not require rerunning an unrelated app build. Never imply previous implementation checks were rerun for a docs-only commit.

## Persistence and release constraints

- D1 and sign-in already exist; do not plan “add cloud/database” as if starting from no persistence.
- Apply append-only migrations; never reset real/local user state merely to run a check.
- Treat manual names/dates/weights/notes/grades/completion as user-owned. Preserve explicit clears, too.
- Keep parent assessment totals separate from child steps. Never double-count grades or infer completion from marks.
- Use synthetic test data and disposable test state. Real imports/restores require explicit review and user authority.
- Respect browser/tool access limits; do not bypass restricted extension pages or authentication.
- Reuse `.openai/hosting.json` and preserve the existing shared audience. Publishing is separate from Git push; inspect current hosting status when releasing.
- Conventional Commits; no rewriting published Git history. Web and Connect use separate SemVer versions; import-format and sync versions have separate compatibility roles.
- Retain the user's working guardrail: stop if weekly allowance remaining falls below 30%; do not spend reset credits.

## History

- [Full former PROGRESS — verbatim snapshot](docs/archive/PROGRESS-2026-10-20-full.md): detailed implementation decisions, fixes, limitations and verification notes from `0374e9c`, retained for engineering reference.
- [Archived milestone digest](docs/archive/IMPLEMENTATION-2026-10-20.md): a shorter navigation aid, not a substitute for the full record.

The snapshot includes superseded scope, provisional release notes and session-specific details. Read historical sections when investigating relevant code, but use ROADMAP and this handoff for current priorities and constraints. Do not treat archived next steps as current instructions or an acceptance ledger.
