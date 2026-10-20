# Semester

A desktop-first semester planner for USYD students: bring together classes, assessments, preparation and grades, then move from **“what happens when?”** to **“what should I do next?”**

Current source versions: **Semester Web 0.4.0** · **Semester Connect 0.2.1**. Connect is a locally loaded Chrome extension, not a Chrome Web Store release. Implementation and automated checks do not mean every workflow has passed a real-user trial.

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
| [Historical checkpoints](docs/archive/IMPLEMENTATION-2026-10-20.md) | Past implementation milestones; not current priorities or proof of user acceptance. |

## What works today

- Timetable import discovers units and real class instances; matching public outlines supply assessment rules and weekly topics.
- **Semester** shows the cross-unit teaching-week picture; **Week / Month** show dates, classes, deadlines and personal tasks/events.
- **Subject** connects preparation gaps to learning records and unit requirements.
- **Assessments** provides a searchable/filterable inventory, a clean Overview and a separate Steps & schedule mode.
- Assessment editing supports multiple steps, demos/submissions, availability, and an activity week/date window separate from the submission deadline.
- Grades support overall or individual-part results, single-unit summaries and conditional target estimates. Blank/hidden marks are not zero; completion and grades are independent.
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
