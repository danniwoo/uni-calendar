# Semester staging API

Independent staging API for the Web, iPhone and widget trials. It never reads or writes the seven production tables. Stage 1 adds private invitation enrolment to the separately owned staging D1 database; Supabase authentication alone does not grant academic-route access.

## Setup

Use Node 24 or newer. Run `npm ci` in this folder, then `npm test` and `npm run typecheck`.

Copy `wrangler.example.jsonc` to ignored `wrangler.local.jsonc`. Set the new Cloudflare account and staging database IDs, the project's standard Supabase URL, and a comma-separated list of exact web origins. Local HTTP is allowed only for `localhost`/`127.0.0.1`. Native requests without Origin are allowed but still require authentication.

The API requires an asymmetric Supabase signing key (ES256 or RS256). It fetches public keys from the configured project's JWKS endpoint; neither a service-role key nor the Google OAuth secret belongs in this Worker. Google credentials belong in the Supabase provider settings. The client sends a Supabase **access token**, not Google's token.

Apply the versioned migrations in `migrations/` to the independent staging DB after confirming its ID. For local development, use `npx wrangler d1 migrations apply semester-staging --local --config wrangler.local.jsonc`, then `npm run dev`. `npm run build` bundles with `--dry-run`; it does not publish. There is deliberately no deployment script in package.json.

## HTTP contract

All responses use `Cache-Control: no-store`. Private routes need `Authorization: Bearer <Supabase access token>`.

| Method/path | Request | Response |
| --- | --- | --- |
| `GET /health` | None | `{status:"ok",mode:"synthetic-pilot"}`; process health, not a database/auth readiness check |
| `POST /v1/access/invitation` | `{token}`; no session | Validates a private invitation without creating an account. |
| `POST /v1/access/redeem` | Bearer token, `{token}` | Atomically redeems the invitation and grants active D1 access. Repeating it for the same active account is idempotent. |
| `GET /v1/session` | Bearer token | Stable app identity plus access state. A mapped identity may still be unenrolled. |
| `GET /v1/semester` | Bearer token | `SemesterResponse`, or 404 if no sample exists |
| `POST /v1/semester/sample` | Empty body or `{}` | Creates an explicitly labelled synthetic board once; subsequent calls return the existing board unchanged |
| `POST /v1/backup-trial/:accountId` | Raw web backup JSON; enrolled owner only | 201 creates an independent immutable snapshot. Identical bytes return 200, a different file returns 409. |
| `GET /v1/backup-trial/:accountId` | Enrolled owner only | Original JSON bytes read from D1, or 404 when no snapshot exists. |
| `GET /v1/recovery/:accountId` | Enrolled owner only | Current version and full backup (semester, Today plan, occurrence completion) from a single database read. |
| `POST /v1/recovery/:accountId` | `{file,expectedVersion}` | Atomically applies a previewed website export or full backup to the verified owner. A stale preview returns 409. |
| `GET /v1/imported/assessments` | Enrolled owner from verified session | Unit grade summaries, recorded marks and plans, and dated or undated work from the currently active semester. |
| `PATCH /v1/imported/completion` | Enrolled owner, `{id,done,expectedRevision}` | Saves progress for one imported occurrence. The assessments projection includes its current state and revision. A stale write returns 409. The original backup export remains byte-identical. |
| `GET /v1/today/plan` | Enrolled owner with restore point | Personal tasks and revision (initially empty at revision 0). |
| `PATCH /v1/today/plan` | Same owner | Validates the plan and atomically saves only at the supplied `expectedRevision`. A stale save receives 409. |
| `PATCH /v1/tasks/:id` | `{completed:boolean,expectedRevision:number}` | Updated `SemesterResponse`; 409 on stale revision |

Every route containing Semester, backup, Today or imported academic data requires `account_access.state='active'`. Existing `backup_trial_members` are lazily backfilled as `legacy_pilot` access and continue to work. `suspended`, `deletion_pending` and `deleted` states override legacy membership, so an existing JWT cannot bypass a disabled account.

## Private invitation operator procedure

Migration `0006_invitation_access.sql` must be applied after `0001`–`0005`. The invitation CLI requires the ignored `wrangler.local.jsonc` and local Cloudflare/D1 authority; there is no public invitation-management HTTP route. It uses the local D1 unless `--remote` is explicitly supplied.

```sh
# Local disposable D1, single use, seven days
npm run invite:create -- --hours 168 --uses 1 --base-url http://localhost:4174/

# Revoke using the UUID printed by the create command
npm run invite:revoke -- --id REPLACE_INVITATION_UUID
```

For a future staging deployment, add both `--remote` and `--base-url https://semester-pilot.pages.dev/` only after explicitly applying the migration to the staging D1. The raw 256-bit token is printed once in the link; D1 stores only its SHA-256 hash. Labels, expiry and the use limit are operator-controlled. Stage 1 creates only `private` invitations; campaign and friend-referral behavior is deferred.

`SemesterResponse` is defined in `src/contract.ts`: `{semester:{id,title,weekLabel,assessments:[{id,unitCode,title,dueAt,weightLabel}],tasks:[{id,title,unitCode,completed}]},revision}`. Dates are ISO strings and the initial revision is 1. Sample deadlines are relative to initial creation time and do not continually move with refreshes.

Errors use `{error:{code,message}}`. Clients should preserve their last visible data on network/503 failure, refresh on 409, and return to sign-in or attempt a session refresh on 401. Do not automatically retry a conflicting mutation with a newer revision without confirming its intent.

## Identity and persistence

Only a verified `(issuer, sub)` resolves an account. Email, user metadata, query parameters, body owner IDs and Sites identity headers never select the account. Mapping creates identity, not access. Access tokens must have the expected issuer/audience, valid signature/expiry, an authenticated nonanonymous role, UUID subject and session ID. Key fetching is pinned to the configured Supabase hostname, not a JWT header.

Account creation uses a D1 transaction (`batch`) and unique identity mapping. Each account owns exactly one pilot board. Updates load that board, change only the selected task's completed flag, and save with an atomic account/revision predicate. Concurrent edits produce 409 instead of silently dropping the other edit.

## Verification and limits

Tests execute the actual SQL against in-memory SQLite and verify real ES256 signatures using disposable keys. They cover different accounts, spoofed headers/metadata, forged signatures, wrong issuer/audience, expiration, anonymous/admin tokens, malformed requests, stale/concurrent updates, idempotent seeding and exact-origin CORS. They do not substitute for a live Google → Supabase → Worker → D1 device trial.

This first proof checks signed access tokens locally. Revoking a refresh token, deleting an Auth account or signing out does not immediately invalidate an already issued access token; it remains usable until expiry. The D1 access-state check still blocks suspended/deletion-state accounts on every academic request. Before real-data release, complete Auth-account deletion, required revocation checks, session lifetime policy, abuse controls and data migration. The private backup route accepts only a validated website export with an empty feed URL and limits streamed input to 1.8 MB. Admission now requires an atomic invitation redemption or preserved legacy membership; Google Testing mode alone does not enforce this. The synthetic endpoints cannot read or overwrite private restore points.

The staging sample endpoint now also requires active Semester access. A Supabase project opened for unrestricted sign-up would create mapped identities, but those identities cannot open academic routes without an invitation or preserved legacy membership. No API token, raw invitation token or SQL value is logged.

Sources: [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts), [JWT claims](https://supabase.com/docs/guides/auth/jwt-fields), [D1 transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/).
