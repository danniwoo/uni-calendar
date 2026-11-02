# Independent migration setup

Status: independent staging implementation, 2026-11-02. Daniel selected Cloudflare Workers + D1 and Supabase Auth, starting on free plans. The first provider is now Google; Apple will follow during public-release preparation. Resend, SMTP and Email+Password are deferred. A new Supabase project and D1 database have been created; the old Sites app remains unchanged.

## Isolation

- Branch: `migration/d1-supabase-free`, based on `1145eec219ae68187591df4773768f99c241f20d`.
- Worktree: `/Users/Daniel/USYD/Project/UNI_calendar/semester-migration`.
- Original checkout: `/Users/Daniel/USYD/Project/UNI_calendar/semester`.
- The existing Sites publication remains the live app. The inherited `.openai/hosting.json` identifies that production Site. Do not publish this worktree through Sites or reuse its database identity for the new environment.
- `api/` contains an authenticated synthetic-data Worker and isolated `pilot_*` schema. `web/` contains a separate Google-login proof client. The iPhone proof is under `mobile/`. These are not yet the complete replacement website or a production data migration.
- Git preserves source code, not live user data. Export/restore and account linking must be validated separately before cutover.

Product decisions remain in [Semester's Notion notebook](https://app.notion.com/p/40bd6bfd790e81c1800cdf60f250174f) and the [problem/decision log](https://app.notion.com/p/40cd6bfd790e81f6b844f3331ee4928a).

## Account setup order

1. **Cloudflare Free:** create an account, sign in locally with Wrangler when ready, and confirm the account ID. Create a new D1 database named `semester-staging` with an Oceania location hint (`oc`). A hint is not a data-residency guarantee. Keep Workers on Free; do not enable a paid subscription automatically.
2. **Supabase Free:** use Daniel's existing account. Check existing projects before creating a dedicated `semester-staging` project. Choose Sydney (`ap-southeast-2`) if available. Keep a generated database password in a password manager; do not put it in chat or source control. An account alone does not mean a project already exists. The Supabase plugin can manage the project once connected.
3. **Google Cloud:** Daniel selected the existing `automation-468207` project. Add a dedicated Semester OAuth client there, using basic identity scopes, the Supabase callback, and Google provider settings. Its existing n8n client and shared `automation` branding remain in use. Do not request Calendar access for sign-in. Use the same Supabase project for web and iPhone.
4. **Deferred: Resend Free.** Only needed when we add email sign-in or other application email. At that point verify a controlled sending domain, then configure Supabase SMTP (`smtp.resend.com`, port `465`, username `resend`, API key as password). Keep the API key in SMTP settings, not clients. The current `chatgpt.site` address is not a sending domain Daniel controls.

Google-only sign-in does not depend on SMTP. This is not a workaround that disables email verification for password accounts. Web proof redirect: `http://localhost:4174/`; iPhone callback: `semester-preview://auth/callback`. Google itself redirects to the Supabase `/auth/v1/callback`; Supabase then redirects to the applicable client. Add exact allowed URLs, not broad wildcards.

Resources provisioned for this proof:

- Supabase: `semester-staging`, project `xpzlynkwgjxomkptvcpr`, Sydney, Dany's Org (Free). API URL: `https://xpzlynkwgjxomkptvcpr.supabase.co`.
- D1: `semester-staging`, ID `4828c6ae-17a7-41fa-8d7e-edaf25880d6c`, Cloudflare account `3a439d79638e3207aa913fea43be6ab0`, Oceania hint. Empty new database initially reported 12.29 kB. This is not the old Sites database's size.
- Supabase Site URL is `http://localhost:4174/`; exact allowed redirects are `http://localhost:4174/` and `semester-preview://auth/callback`.
- Local verification passed: API 9 tests plus typecheck/dry-run bundle, web 10 tests plus production build, and mobile 8 new staging tests plus typecheck/iOS JavaScript export. Native 0.3.2 (6) Release build and strict signature verification passed, and installation on the paired iPhone succeeded. Both targets retain the shared App Group without push entitlement; widgets remain sample-only.
- Cloudflare setup: Daniel explicitly approved Wrangler's `account:read`, `user:read`, `workers_scripts:write` and `d1:write` scopes; OAuth completed. `0001_pilot.sql` was applied to the new D1 only. The three pilot tables were verified empty; allocated size was 53,248 bytes (52 KiB) after migration.
- Deployed API: `https://semester-staging-api.594danielwu.workers.dev`, version `79d9124c-f676-420e-ad76-89989e3b2627`, built from `fb2a83c`. Seven live checks passed: health 200, four unauthenticated read/write endpoints 401, allowed localhost preflight 204, and an unapproved origin 403. Supabase's public JWKS returns ES256. Initial workers.dev provisioning briefly failed TLS; HTTPS subsequently passed without disabling verification.
- Google Cloud: Daniel switched the selected existing project to `automation-468207`. The unsubmitted Auth form in `test-firebase-c7e93` was cancelled and its temporary display-name change was reverted. After Daniel's explicit approval, `Semester Staging - Supabase Auth` was created with origin `http://localhost:4174` and redirect `https://xpzlynkwgjxomkptvcpr.supabase.co/auth/v1/callback`, and its credentials were saved in the staging Supabase Google provider. Google is enabled; nonce checks remain enabled, and email/anonymous sign-in remain disabled. No existing client or shared branding was edited. Project IDs cannot be renamed; deleting a project continues to use quota during its 30-day recovery window.
- Live web proof passed: real Google sign-in returned through Supabase, the Worker verified the account, a synthetic semester was created at revision 1, and one preparation task was saved at revision 2. A full page reload restored the session and reloaded the checked task. A separate read-only D1 query confirmed one account, one identity, one board and revision 2; allocated storage remains 53,248 bytes. Browser evidence is in ignored `outputs/setup/web-google-d1-verified.jpg`.
- Physical-phone proof passed: Daniel's 0.3.2 screenshot shows successful Google sign-in, verified API identity, revision 2 and the task previously checked on the web. Daniel then checked the second task on the iPhone and reported revision 3; refreshing the web independently showed revision 3 with both tasks checked. This verifies both directions using explicit refresh. Phone restart/session renewal, real multi-account isolation and cloud widgets remain unverified. Browser evidence: ignored `outputs/setup/web-phone-sync-revision3.jpg`.
- No real semester data has been copied. Google external Testing status is not an application-level user allowlist; basic-identity sign-in succeeded for the setup account without adding it to the displayed test-user list. Add explicit pilot-access controls before inviting users or storing real records.

`runtime.env.example` documents future application settings. It is not consumed by the current Sites application. `wrangler.d1.example.jsonc` is for independent D1 management only, not Worker deployment. Copy it to ignored `migration/wrangler.d1.local.jsonc` and replace both placeholders with the confirmed new account/database IDs before using it. Never put the Sites-managed database ID there.

Once a new database has been created, the documented read-only commands below can inspect it. Run from this worktree, using the repository's installed Wrangler:

```sh
node node_modules/wrangler/bin/wrangler.js d1 info semester-staging --config migration/wrangler.d1.local.jsonc --json
node node_modules/wrangler/bin/wrangler.js d1 execute semester-staging --config migration/wrangler.d1.local.jsonc --remote --file migration/measure-storage.sql
```

The SQL expects all seven current tables to exist. Applying schema to the new staging DB is a separate step; it has not been run. The measurement scans tables and consumes read allowance, so use it on demand, not as a frequently polled endpoint. No production credentials or user data are needed for the first synthetic-data proof.

## Current database inventory

Sites' live database overview returned one binding, `DB`, and seven user tables on 2026-11-02, without truncation. Source schema: `db/schema.ts`.

| Table | Contents |
| --- | --- |
| `semesters` | One active board per owner: units, assessments, tasks, grades, preferences and import history stored as JSON |
| `semester_recovery` | One recovery board per owner |
| `course_plans` | Planned/enrolled/completed unit records and results |
| `friend_profiles` | App profile and sharing preference |
| `friend_invites` | Hashed invitations and expiry/revocation state |
| `friendships` | Connections and their state |
| `friend_rate_limits` | Bounded per-owner/action counters |

There is no separate assessment database. Sites currently supplies login identity outside these tables. Its owner IDs cannot simply be treated as new Supabase account IDs.

The intended replacement has two main databases: D1 for academic/app records and Supabase's Postgres for authentication users/sessions. During staging, the old Sites D1 remains as a third database alongside these two new resources. Resend is an optional email service, not another academic database. Existing unrelated Supabase projects are outside this count and have not been changed.

## Architecture to implement next

```text
Web + iPhone -> Supabase Auth -> signed access token
Web + iPhone -> Cloudflare API (validates token and ownership) -> D1
Google (later Apple) -> Supabase Auth
Supabase Auth -> optional future Resend SMTP -> application email
iPhone -> minimal account-scoped local snapshot -> widgets
```

Use asymmetric Supabase signing keys; validate signature, issuer, audience and expiry using the project's public JWKS. Map `(issuer, subject)` to an app-owned account identity. Supabase RLS does not protect D1: all D1 access must be authorised in the API. Do not trust `oai-authenticated-user-*` headers on the independently hosted service, or accept a client-supplied owner ID.

Keep academic writes behind the shared API so web and phone use the same validation, grade rules and revision checks. A phone update should change only its intended field; do not send a reduced mobile board to the existing whole-board PUT route. Define session expiry/revocation handling and clear account-scoped caches when signing out or switching users.

Next proof: test account signs in on web and iPhone, loads a synthetic D1 board, changes one preparation item, sees it on both clients and in the widget cache. A second account must not read/update the first account's data. Test expired tokens and save conflicts before importing real records.

## Capacity and cost checks

**Live database MB: unknown.** The Sites database tools exposed table names/rows but no storage-size metric. Local SQLite files, sample fixtures, JSON export sizes and row counts are not a measurement of the live D1 allocation. On the independently owned D1 database, use Cloudflare's storage metric / `d1 info` for actual size.

`measure-storage.sql` returns only aggregates: seven table row counts, UTF-8 bytes of active/recovery JSON, and their combined average/maximum per board owner. It does not return IDs, names or board contents. JSON bytes exclude other columns, course plans, friendships, indexes, SQLite pages and free space. Do not present them as total database size or as a complete count of registered users.

For planning only: a 500 MB budget divided by an assumed 100 KB **total** per user is about 5,000 users; at 500 KB it is about 1,000. These are arithmetic illustrations, not measured Semester capacity. Reserve headroom and measure actual allocated storage, query usage and Worker CPU during the pilot. At 50,000 users, 500 MB permits only about 10 KB/user before shared overhead.

Provider allowances checked on 2026-11-02 (USD):

- D1 Free: 500 MB per database, 5 GB per account across up to 10 databases; 5 million rows read/day and 100,000 rows written/day. The 5 GB pool does not increase the individual database limit.
- Workers Free: 100,000 requests/day and 10 ms CPU/request. Full web rendering may need optimisation or a paid plan even before storage is full. Test on Free; discuss any upgrade before enabling it.
- Supabase Free: 500 MB/project, 50,000 MAU, 5 GB uncached egress, separate cached allowance, two active projects; projects can pause after a week of inactivity. Auth tables still use storage. These resources are separate from D1's quota.
- Resend Free: 3,000 emails/month, at most 100/day. Verification, OTP, resend and reset emails each use this allowance. Existing Supabase sessions reduce the need to send a new login email on every visit.
- All three service fees can start at $0 inside allowances. A sending domain and eventual Apple distribution are separate costs. Fewer than 50,000 users does not guarantee a free production deployment.

## Cutover sequence

1. Build/test the independent staging environment while the old website stays available.
2. Validate a full data export and restore, including recovery, course plans, friends and account ownership. An ordinary board export alone is not a complete site backup.
3. For Daniel's first small pilot, test a user-owned Semester JSON export/import into the new signed-in account. This does not automatically transfer account ownership or all seven tables. If automatic/bulk migration is later required, link identities through verified ownership of both accounts; never auto-merge solely because an email matches. Current iPhone samples need no production migration; preserve local personal tasks until deliberately replaced.
4. Reconcile intervening web changes from the original branch. Validate old and new records, all write paths, extension origins and device links.
5. Schedule a short final write pause on the old app, transfer the final consistent data, verify, then point users at the new app. The old `chatgpt.site` URL cannot be moved by changing DNS on a domain we own. Exact redirect/access behaviour remains to be established.
6. Retain a rollback checkpoint. If users have written to the new system, reconcile those writes before rolling back; restoring a stale pre-cutover copy would lose them.

No cutover date or zero-downtime guarantee has been set. Only the new staging resources are being configured; the live Sites app, production data, DNS and paid subscriptions remain unchanged. See each proof component's README for implemented checks and outstanding integration tests.

Sources: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Supabase pricing](https://supabase.com/pricing), [Supabase regions](https://supabase.com/docs/guides/platform/regions), [Supabase JWTs](https://supabase.com/docs/guides/auth/jwts), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Resend pricing](https://resend.com/pricing), [Resend SMTP integration](https://resend.com/docs/send-with-supabase-smtp).
