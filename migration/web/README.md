# Browser connection trial

Independent, synthetic-data proof for Google → Supabase Auth → Cloudflare API → D1. This is not the replacement Semester website and is not published through Sites. It does not import existing student records.

## Local setup

Use Node 22.13+ (the existing Node 24 toolchain is also suitable). From this directory:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with the staging Supabase project URL, its **modern publishable key** (`sb_publishable_…`), and staging API origin. All `VITE_` settings are public browser configuration. Do not add a secret/service-role key, Google client secret or database password. Missing/invalid configuration shows a setup screen and never claims a successful connection.

Open **http://localhost:4174/**. Use this exact origin consistently so PKCE verifier storage remains in the same browser origin. Add `http://localhost:4174/` to the staging Supabase redirect allowlist. Configure the Google OAuth client with the callback URL Supabase provides (`https://<project-ref>.supabase.co/auth/v1/callback`), not the localhost app URL. The API must allow `http://localhost:4174` in its exact-origin CORS list. A future hosted trial must use HTTPS and its own exact redirect/origin settings.

Google OAuth uses PKCE, and this client explicitly exchanges the returned code with Supabase. It clears the code/error fragment from the address bar before exchange and rejects implicit token callbacks. The Supabase SDK stores the staging session in browser localStorage under a dedicated project-scoped key and renews it. This is a browser-only proof, not SSR auth. API calls use the Supabase session access token. No user-supplied owner ID is sent. The API remains responsible for validating tokens and enforcing ownership.

## Trial

1. Continue with Google using an allowed staging test account.
2. Verify the API identity and load the account's test board; missing data is an explicit state.
3. Select **Create test semester** if needed. The API's sample endpoint must keep existing test data.
4. Open the phone staging trial with the same Google account.
5. Tick a preparation task here, then refresh on the phone; do the reverse as well. This proof uses explicit refresh, not realtime subscriptions or offline writes.
6. Check a second account sees its own board. Sign out and confirm no previous board remains.
7. With a stale revision on one device, confirm a 409 reloads the latest version without automatically overwriting the other device's change.

Pending requests are invalidated when identity changes or the user signs out. API rejection clears the displayed board; sign-out must complete before signing in again. Network failure leaves the displayed board unchanged and reports failure; it does not report a save. This proof does not yet add Apple Login, account linking, existing JSON imports, user-facing email or the full current website UI.

## Validation

```sh
npm test
npm run build
```

The local tests cover configuration, callback cleanup, API token/body/redirect handling, unexpected data, logout and account-switch races, stale updates, expired/rejected sessions, explicit seeding and refreshed tokens.

Live verification on 2026-11-02: Google sign-in through the staging Supabase provider succeeded; the deployed Worker verified the account, created its synthetic semester, and saved a preparation task from revision 1 to revision 2. A full page reload restored the session and fetched the same checked task. A separate aggregate D1 query confirmed one account, one identity, one board and revision 2. This establishes the web-to-cloud path; physical iPhone sync, real multi-account provider testing and cloud widgets remain pending. Google external Testing mode did not restrict this basic-identity flow to the displayed test-user list; do not treat it as an application access allowlist.

Sources: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [PKCE code exchange](https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession), [session guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide).
