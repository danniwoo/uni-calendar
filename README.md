# Semester

A desktop-first semester planner for USYD students: bring together classes, assessments, preparation and grades, then move from **“what happens when?”** to **“what should I do next?”**

Current source versions: **Semester Web 0.13.0** · **Semester Connect 0.4.0**. Publication is a separate Sites release step; Git push alone does not deploy. Connect is a locally loaded Chrome extension, not a Chrome Web Store release. Implementation and automated checks do not mean every workflow has passed a real-user trial.

## Start here / 從哪裡繼續？

**[ROADMAP — 現在、待你測、暫放、下一步](ROADMAP.md)** is the daily working home. It tracks each workstream's stopping point, outstanding validation and next action.

| Document | Purpose |
| --- | --- |
| [ROADMAP.md](ROADMAP.md) | Priorities, MVP stages, resumable work cards and user-test queue. The only task/status backlog. |
| [VISION.md](VISION.md) | Who this is for, the user journey, each view's purpose and scope boundaries. |
| [CHANGELOG.md](CHANGELOG.md) | Versioned web changes; not a to-do list. |
| [PROGRESS.md](PROGRESS.md) | Concise engineering handoff, code map, checks and safety constraints. |
| [Connect guide](extensions/semester-connect/README.md) | Chrome installation/reload, reading Canvas and reviewed import. |
| [Connect changelog](extensions/semester-connect/CHANGELOG.md) | Independently versioned extension changes. |
| [Canvas matching user stories](docs/CANVAS-MATCHING-USER-STORIES.md) | User needs, matching behaviour, acceptance checks and remaining limitations. |
| [Historical milestones](docs/archive/IMPLEMENTATION-2026-10-20.md) | Short digest of past implementation milestones; not current priorities or proof of user acceptance. |
| [Full historical PROGRESS](docs/archive/PROGRESS-2026-10-20-full.md) | Verbatim detailed engineering log: decisions, fixes, limitations and test evidence. Historical context, not current instructions. |

## What works today

- Canvas matching shows **source group → independent Semester assessments**, including target weights, with each source item listed once. Saved links are reused; similar-title suggestions remain opt-in. For weekly entries/retakes, tick source items → **Link selected items to one assessment** → choose a saved rule or explicitly configure calculation → **Stage → Review → Confirm**. Complete converts only under a confirmed completion rule; missing/hidden results stay unknown. A confirmed miss is a manual decision. Source IDs, not teaching-week order, identify entries. Manual/cleared/removed entries and changed rules remain protected. Linking an existing manual child or repairing a previously saved overall-to-child link is not yet supported.
- Optional **Canvas checks**: after enabling selected courses in Connect, use **Check all N courses** in Semester with one signed-in Canvas course tab open, or reload a course to check just that course. Requires Web 0.9.0+ / Connect 0.4.0 for batch checks, in the same Chrome profile. Returning previews show actual grade changes first; unmatched, protected and unchanged entries stay collapsed. Matching rows stay visible after selection, with Undo. **Nothing imports automatically**; JSON remains the testing/manual fallback. See the [setup and acceptance checklist](extensions/semester-connect/README.md#reload-checks). No timer polling or closed-browser syncing.
- **Canvas update history** (Web 0.10.0): open from Assessments or Manage. Only explicit confirmed imports create receipts, saved with the board and included in backups; earlier imports are not backfilled. New indicators mark unseen imported grade changes, not pending previews. Open the grade (or use the history link to jump to its unit) to clear the indicator without deleting history or changing marks. Retains up to 20 recent batches / 250 details per batch with a 300 KB text-size cap. Pending Connect previews are temporary; keep JSON to review later. No separate notification service.

- Timetable import discovers units and real class instances; matching public outlines supply assessment rules and weekly topics.
- **Semester** shows the cross-unit teaching-week picture; **Week / Month** show dates, classes, deadlines and personal tasks/events.
- **Subject** connects preparation gaps to learning records and unit requirements.
- **Assessments** provides a searchable/filterable inventory, a clean Overview and a separate Steps & schedule mode.
- Assessment editing supports multiple steps, demos/submissions, availability, and an activity week/date window separate from the submission deadline.
- Manually created assessments can be deleted from their detail/edit panel, with scope confirmation and immediate Undo. Source-defined assessments are protected.
- Grades support overall or individual-part results, single-unit summaries and conditional target estimates. Blank/hidden marks are not zero; completion and grades are independent.
- Existing assessments can use **Retakes · highest attempt** (optional score threshold) or **Completion · best N submissions** (configurable opportunity count and points). These are generic rules, not tied to a unit.
- Account-scoped D1 storage, backup export/restore, one previous-board recovery slot and guarded concurrent saves are implemented.
- **Semester Connect** reads selected USYD Canvas courses using an existing browser login. A private JSON file is reviewed and mapped in Semester before import. Confirmed mappings can be reused; manual data is protected.

Known limits and outstanding trials are in the [roadmap](ROADMAP.md). Canvas import is **manual and confirmation-based**, not continuous sync. Imported group totals require review; unsupported grading rules are not silently guessed.

## Use

1. Sign in and import your Sydney Timetable subscription URL.
2. Review detected units, **Needs details** and source warnings. Public outlines may omit Canvas/Ed dates.
3. Use Week/Month for daily arrangements, Semester for the semester picture, and Assessments for inventory/editing/grades.
4. Set known preparation scope and update learning records. Unchecked means unrecorded, not necessarily unfinished.
5. For Canvas results, follow the [Connect guide](extensions/semester-connect/README.md): reload the extension, read selected courses, compare the preview, download privately, then **Manage → Import from Semester Connect**. Review before confirming.
6. Wait for **Saved** before closing. Use **Manage → Refresh current timetable** after changing classes; inspect warnings and retain a backup before significant changes.

Hosted and local-preview data are separate. JSON backups omit the private timetable URL. Restore reviews a full-board replacement; it is not a merge. Sharing site access does not share another person's account data.

### Grading rules

In **Assessments → Show grades**, choose **Individual grades / rules** on an assessment (or click its existing individual result). Select a calculation and review all included entries before saving.

- **Highest attempt:** enter the allowed count, click **Apply count**, then enter each released score. Blank attempts can be not confirmed, not taken, or awaiting a result. Optional threshold marks are checked separately from unit weight and do not automatically mark a hurdle passed. If no further attempts are planned, explicitly close attempts and identify unused blanks as **Not taken**; unknown/awaiting entries still prevent finalization.
- **Best N submissions:** for example, 10 opportunities, best 8, 0.5 points each. Select Submitted, Confirmed not submitted, Not due yet, or Not confirmed. The maximum is 8 × 0.5 = 4; four submissions secure 2/4 points, not a 100% average. The result settles when all included outcomes are known or the cap is already reached. An unresolved lower bound is shown separately from the unit's current average.
- Changing counts excludes excess entries without deleting their history. Numeric grades are retained when using completion rules; they do not automatically imply submission. These entries do not create calendar events or change completion checkboxes.
- Canvas import still requires review. It **does not automatically map retake attempts or turn text results into binary marks**, and will not overwrite these user-configured rules. Existing simple points/equal-weight imports keep their previous behavior.

For isolated browser QA: `node node_modules/vite/bin/vite.js --config scripts/grade-rules-qa/vite.config.mjs --port 5191 --strictPort`. This fixture uses invented entries and localhost-only storage, not the account API. Reset synthetic data using its button. Stop the server when finished.

## Local development

Requires Node **22.13+** and npm.

```sh
npm ci
npm run build
```

For a **new local database only**, apply both migrations in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_noisy_plazm.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_lyrical_iron_patriot.sql
npm run dev
```

For an existing database, apply only missing migrations; do not reset it or rerun initial SQL blindly. Preview normally runs at `http://127.0.0.1:5173`. Local sign-in uses the bundled test identity; hosted sign-in uses the platform. Local database files live under ignored `.wrangler/`.

Checks (synthetic data; no real Canvas writes):

```sh
node node_modules/typescript/bin/tsc --noEmit
for check in scripts/check-*.ts; do node --import tsx "$check" || exit 1; done
node scripts/check-backup-storage.mjs
npm --prefix extensions/semester-connect test
npm run build
```

See [PROGRESS](PROGRESS.md) for the code map and verification limits.

## Scope and privacy

- Current import support targets standard USYD Semester 1/2, 2026, not intensives or arbitrary institutions.
- Use Australia/Sydney time and teaching weeks; breaks are not teaching weeks.
- Never invent due dates, preparation scope, released marks or grading rules. Activity timing, availability and submission deadlines are different facts.
- Desktop usability is the current focus. Native iOS is a future direction; mobile-web-specific redesign is not a current workstream.
- Sign-in and cloud persistence already exist. Friends, autonomous Canvas checking, public extension distribution and broader platform work are not shipped features.
- Never commit private timetable links, credentials, Canvas grade exports, account backups, databases or personal screenshots. Tests use synthetic fixtures.
- Git backs up source, not user data. Ignoring a private file is not backing it up.

Documentation changes do not deploy the app or publish/update an installed extension. Preserve the existing hosting identity and sharing settings when releasing; see [PROGRESS](PROGRESS.md).
