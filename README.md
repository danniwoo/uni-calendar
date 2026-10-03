# Semester — USYD MVP

A semester-first tracker for assessments and unfinished weekly learning. Built for standard USYD semesters in 2026; usually four units.

## Use

1. Sign in and paste your Sydney Timetable subscription URL.
2. The app detects units and follows each unit page to the matching published outline.
3. Review **Needs details** and **Import details**. Public outlines do not contain every Canvas/Ed deadline.
4. Tick completed assessments and learning. Click a task to edit its date, add a planned start, or connect known quiz coverage to lecture weeks.
5. Wait for **Saved** before closing. Use **Manage → Refresh current timetable** after changing classes. Your edits and ticks are preserved.

Progress is stored in D1, keyed to the signed-in user. Local preview data and hosted data are separate. Exported JSON backups omit the private timetable subscription URL. A restore interface is not included yet.

## Local development

Requires Node 22.13+ (a current LTS is recommended) and npm.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_noisy_plazm.sql
npm run dev
```

Apply that initial migration once to a new local database. Local preview normally runs at http://127.0.0.1:5173. Its sign-in link uses the bundled local test identity; production uses platform sign-in. Local database files are under ignored `.wrangler/`.

Checks:

```sh
node node_modules/typescript/bin/tsc --noEmit
node --import tsx scripts/check-import.ts
npm run build
```

The integration tests use synthetic data only. Real outline/timetable testing was performed separately without committing personal feeds.

## MVP boundaries

- Standard Semester 1/2, 2026 only; no intensive or mixed-semester imports.
- USYD individual-event ICS export supported. Unexpanded event recurrence rules fail explicitly.
- Published assessment table and weekly topics are extracted deterministically, with no paid AI service.
- Explicit class-based rules can bind to unique timetable classes. Exceptional timing/reattempt rules are flagged, not silently guessed.
- Unknown or multi-part schedules remain visible. Create individual occurrences from a multi-part task when its actual dates are known.
- No Canvas/Ed login, notifications, PDF/OCR, grades, hurdle-pass tracking, or day/month view.
- Outline information can be inconsistent or change. Source links and original wording remain available; manually overridden fields stay yours on refresh.
- The private hosted site must be explicitly shared before friends can access it. Their data is isolated by signed-in identity.

## Recovery and privacy

Source checkpoints are pushed to `https://github.com/danniwoo/uni-calendar`. Read `PROGRESS.md` to resume development. Never commit timetable URLs, ICS downloads, credentials, database files, exported progress, or screenshots containing personal data. Sites publishing reuses `.openai/hosting.json`; do not register another site.
