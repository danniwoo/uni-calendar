# Original Semester web board on staging

The [private pilot](https://semester-pilot.pages.dev/) signs students in with the same Google account as Semester Preview on iPhone. Signed-in students land on the original [semester board](https://semester-pilot.pages.dev/board/). Semester, Month, Week and Assessments use the original React components. Account & backups opens the import, export and Today tools. Empty accounts can import their semester or try the DEMO1001 practice semester.

The staging Worker reads the active D1 snapshot and applies occurrence completion records shared with iOS. Board saves check the loaded revision. Refresh the page or the phone’s Assessments view to see changes from the other device. The first backup remains available through Account & backups. Course plan, Friends, timetable import and the Canvas browser connection still use the original Sites environment.

## Local setup

Use Node 22.13+ (the existing Node 24 toolchain is also suitable). Install the locked dependencies at the repository root for the original board, then install the web client dependencies. From this directory:

```sh
npm ci --prefix ../..
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with the staging Supabase project URL, its **modern publishable key** (`sb_publishable_…`), and staging API origin. All `VITE_` settings are public browser configuration. Do not add a secret/service-role key, Google client secret or database password. Missing/invalid configuration shows a setup screen and never claims a successful connection.

Open **http://localhost:4174/** for local development. Supabase must allow the exact return URL for each web origin, including the trailing slash. Keep the localhost and `semester-preview://auth/callback` entries alongside the hosted URL. The Google OAuth client continues to use the project's Supabase callback. The API accepts only the explicitly configured web origins.

## Hosted deployment

From `migration/web`, install the locked dependencies and run `npm run build` with the public staging settings. Publish the contents of `migration/web/dist` to the **semester-pilot** Pages Direct Upload project. The API is deployed separately with the existing staging Wrangler configuration. Set its exact allowed web origin to `https://semester-pilot.pages.dev` and its pilot landing URL to `https://semester-pilot.pages.dev/`. Keep the iPhone API URL on the Worker.

For a second-account rehearsal, verify the staging Google identity against its D1 account and approve admission for that account alone. On the hosted site use **Preview a practice semester** and confirm the destination account. **Pilot reflection** is due the next day at 17:00 Sydney. Sign into Semester Preview with the same Google account to compare Home and Deadline focus. An existing imported semester cannot be replaced through the practice shortcut.

Google OAuth uses PKCE, and this client explicitly exchanges the returned code with Supabase. It clears the code/error fragment from the address bar before exchange and rejects implicit token callbacks. The Supabase SDK stores the staging session in browser localStorage under a dedicated project-scoped key and renews it. This is a browser-only proof, not SSR auth. API calls use the Supabase session access token. No user-supplied owner ID is sent. The API remains responsible for validating tokens and enforcing ownership.

## Trial

1. Continue with Google using an allowed staging test account.
2. Verify the API identity and load the account's test board; missing data is an explicit state.
3. Select **Create test semester** if needed. The API's sample endpoint must keep existing test data.
4. Open the phone staging trial with the same Google account.
5. Tick a preparation task here, then refresh on the phone; do the reverse as well. This proof uses explicit refresh, not realtime subscriptions or offline writes.
6. Check a second account sees its own board. Sign out and confirm no previous board remains.
7. With a stale revision on one device, confirm a 409 reloads the latest version without automatically overwriting the other device's change.

Pending requests are invalidated when identity changes or the user signs out. API rejection clears the displayed board; sign-out must complete before signing in again. Network failure leaves the displayed board unchanged and reports failure; it does not report a save. This proof does not yet add Apple Login, account linking, general-purpose migration, user-facing email or the full current website UI.

## Validation

```sh
npm test
npm run build
```

The local tests cover configuration, callback cleanup, API token/body/redirect handling, unexpected data, logout and account-switch races, stale updates, expired/rejected sessions, explicit seeding and refreshed tokens.

Live verification on 2026-11-02: Google sign-in through the staging Supabase provider succeeded; the deployed Worker verified the account, created its synthetic semester, and saved a preparation task from revision 1 to revision 2. A full page reload restored the session and fetched the same checked task. A separate aggregate D1 query confirmed one account, one identity, one board and revision 2. Daniel's iPhone screenshot then confirmed the same verified account and revision 2 task state. After Daniel checked the second task on the phone, a web refresh independently returned revision 3 with both tasks checked. Both directions passed using explicit refresh; real multi-account provider testing and cloud widgets remain pending. Google external Testing mode did not restrict this basic-identity flow to the displayed test-user list; do not treat it as an application access allowlist.

Sources: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [PKCE code exchange](https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession), [session guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

## Private restore trial

Use **Download full backup** to save the current semester, personal Today tasks and work completion changes from the signed-in account. **Download original import** retrieves the first immutable website file. Choose either a website export or a full backup to preview current and resulting counts before confirming the destination. Scheduled attempts expand to show the date and mark of each attempt.

A website export updates the semester and retains existing progress. A full backup restores all three parts to its owner. The client reads the result again after saving. If the account or any saved progress changes after preview, preview again. New files do not replace the first immutable restore point.
