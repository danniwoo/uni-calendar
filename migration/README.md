# Independent migration setup

Status: local preparation only, 2026-11-02. Daniel selected Cloudflare Workers + D1, Supabase Auth and Resend, starting on free plans. Cloud resources have not been provisioned by this setup. Daniel has a Supabase account; Cloudflare, Resend and sending-domain access are still needed.

## Isolation

- Branch: `migration/d1-supabase-free`, based on `1145eec219ae68187591df4773768f99c241f20d`.
- Worktree: `/Users/Daniel/USYD/Project/UNI_calendar/semester-migration`.
- Original checkout: `/Users/Daniel/USYD/Project/UNI_calendar/semester`.
- The existing Sites publication remains the live app. The inherited `.openai/hosting.json` identifies that production Site. Do not publish this worktree through Sites or reuse its database identity for the new environment.
- This folder provides a database-management configuration template, an environment checklist and read-only measurement queries. It does not yet provide an authenticated Worker, deployable replacement website, or data migration.
- Git preserves source code, not live user data. Export/restore and account linking must be validated separately before cutover.

Product decisions remain in [Semester's Notion notebook](https://app.notion.com/p/40bd6bfd790e81c1800cdf60f250174f).

## Account setup order

1. **Cloudflare Free:** create an account, sign in locally with Wrangler when ready, and confirm the account ID. Create a new D1 database named `semester-staging` with an Oceania location hint (`oc`). A hint is not a data-residency guarantee. Keep Workers on Free; do not enable a paid subscription automatically.
2. **Supabase Free:** use Daniel's existing account. Check existing projects before creating a dedicated `semester-staging` project. Choose Sydney (`ap-southeast-2`) if available. Keep a generated database password in a password manager; do not put it in chat or source control. An account alone does not mean a project already exists. The Supabase plugin can manage the project once connected.
3. **Resend Free:** create an account. For student-facing mail, verify a domain/subdomain whose DNS Daniel controls. The current `chatgpt.site` address is not a sending domain Daniel controls. No domain purchase is necessary for the local groundwork.
4. Configure Resend in **Supabase Auth's SMTP settings**: host `smtp.resend.com`, port `465`, username `resend`, password the Resend API key, sender name `Semester`, sender address on the verified domain. Store the key there, not in the website/iPhone bundle. Add only Resend's required verification records; preserve existing website and mail records.

Supabase implements verification/reset/login; Resend delivers those emails. Supabase's default SMTP is restricted to team addresses and is not the intended student-facing sender. Retain email confirmation. Set the exact web/iPhone auth redirect URLs after the staging origins and native callback are confirmed.

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

The intended replacement has two main databases: D1 for academic/app records and Supabase's Postgres for authentication users/sessions. During staging, the old Sites D1 remains as a third database alongside these two new resources. Resend is an email service, not another academic database. No new cloud database has been created in this preparation step.

## Architecture to implement next

```text
Web + iPhone -> Supabase Auth -> signed access token
Web + iPhone -> Cloudflare API (validates token and ownership) -> D1
Supabase Auth -> Resend SMTP -> verification/recovery mail
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
3. Link old and new identities through verified ownership of both accounts; never auto-merge solely because an email matches. Keep existing mobile personal tasks during the transition.
4. Reconcile intervening web changes from the original branch. Validate old and new records, all write paths, extension origins and device links.
5. Schedule a short final write pause on the old app, transfer the final consistent data, verify, then point users at the new app. The old `chatgpt.site` URL cannot be moved by changing DNS on a domain we own. Exact redirect/access behaviour remains to be established.
6. Retain a rollback checkpoint. If users have written to the new system, reconcile those writes before rolling back; restoring a stale pre-cutover copy would lose them.

No cutover date or zero-downtime guarantee has been set. This setup does not modify the live app, DNS, authentication, mail delivery, subscriptions or cloud data.

Sources: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Supabase pricing](https://supabase.com/pricing), [Supabase regions](https://supabase.com/docs/guides/platform/regions), [Supabase JWTs](https://supabase.com/docs/guides/auth/jwts), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Resend pricing](https://resend.com/pricing), [Resend SMTP integration](https://resend.com/docs/send-with-supabase-smtp).
