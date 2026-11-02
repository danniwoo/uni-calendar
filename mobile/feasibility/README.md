# Stage 2: hosting and native authentication investigation

Initial investigation: 2026-11-02, source `74bd034` (the preserved 0.3.0 preview). The original findings below describe that historical audit. The independent 0.3.2 experiment has since verified native login and bidirectional synthetic-data updates; see the follow-up below. Stage 1 usefulness and cloud-widget trials remain open.

## Independent 0.3.2 follow-up — 2026-11-02

Daniel selected isolated Cloudflare Workers + D1 and Supabase Auth with Google first; setup and reproducible details are in [migration/README.md](../../migration/README.md). The old Sites website remains the production app. No production records have been imported.

The web proof signed in with Google, obtained a verified API identity, created a synthetic board and saved a task at revision 2. Daniel's physical iPhone screenshot shows the same signed-in account, verified API identity, revision 2 and checked task. He then checked the second task on the phone and reported revision 3; a web refresh independently showed revision 3 with both tasks checked. This establishes native authentication and narrow task updates shared with the independent web proof, using explicit refresh. It does not establish sync with the existing Sites website.

Remaining acceptance work includes phone restart/session renewal, real multi-account sign-in and isolation, live conflict/retry behaviour, and an account-scoped widget snapshot with sign-out clearing and freshness. Existing automated checks cover several of these failure paths, but device and live-service validation remain separate.

## Decision

The next experiment should prove **native sign-in → read one synthetic board → change one preparation task → observe that change in a web test client**. Keep it isolated from existing student accounts and records. Reuse the semester model and revision safeguards, but expose a narrow task update instead of saving a reduced mobile board through the existing whole-document PUT.

There is **no verified native sign-in/token handoff for the current Sites project** in the inspected platform documentation, tool configuration or application code. That is a capability gap to resolve, not proof that Sites can never support native clients. Do not choose a full migration solely from this audit. If a supported native flow cannot be established, use an isolated shared API/auth backend as the first migration experiment; no provider, paid service, new account or production cutover has been selected.

## Evidence and limits

| Area | Observed evidence | Implication |
| --- | --- | --- |
| Hosting | `.openai/hosting.json` identifies the existing Sites project and `DB` D1 binding. Sites metadata reports active/custom access, configured authentication, and version 63 deployed successfully. | Keep the existing audience. D1 is supplied to the Worker; there is no mobile database credential or supported external database access established here. |
| User identity | `app/chatgpt-auth.ts` reads `oai-authenticated-user-id` and email supplied by Sites dispatch. It does not validate an app bearer token. | A phone must use a supported authentication path; sending a user ID or copying display email is not authentication. The local harness simulates trusted dispatch only. |
| Browser sign-in | The platform owns `/signin-with-chatgpt`, `/signout-with-chatgpt` and `/callback`; its documented return path is same-origin and relative. The actual helper normalises a native-scheme return path to `/`. | Opening the website's sign-in page does not establish an authenticated native API client. Native client registration, token exchange/refresh and a callback to the app remain unverified. |
| Service access | Sites documentation says its service access bearer supplies no visitor identity. | A service credential is not a student's login and must not be shipped in the app or widget. It does not solve the per-user API contract. |
| Live anonymous request | Unauthenticated GETs to `/api/semester` and the sign-in entry returned 403. Only status, content type and redirect location were inspected; no response body or cookies were read. | This automated caller did not reach a signed-in API. These responses alone do not distinguish platform access controls from automated-request restrictions or prove a browser/native flow impossible. |
| API read | The local GET reads the owner's semester/revision and recovery snapshot; it also returns a reminder owner key. Success is `no-store`. | A mobile-specific read projection can avoid sending recovery data, private feed URLs and unrelated import metadata. Preserve source IDs, actual teaching weeks and unknown dates. |
| API write | The local PUT replaces the whole semester using an expected revision and checks client `syncVersion`; current web saves use 10. | Revision guards prevent stale saves, but do not protect omitted fields in a current-revision replacement. Do not serialise `SampleBoard` or `PersonalTask[]` into this endpoint. |
| Ownership | The web data is keyed by the Sites user ID. Platform documentation says these IDs are scoped to a Site. | A new Site/auth provider will need explicit account linking or a reviewed migration. Do not assume IDs are portable or merge accounts by matching email alone. |
| Local personal tasks | Preview tasks use `plannedFor`; web tasks have their own date/deadline and preparation relationships. | Planning a day and setting an assessment deadline must remain distinct. Personal-task sync needs a separate mapping decision; it is not automatically covered by the first completion test. |

Sites metadata was read for project `appgprj_6ac0f83ad8dc81919c1b72c323f6bc50`; successful deployment `appgdep_6ae7e56cfa508191ada987eed59fbb56`, version 63, source `9185172d3588813c423e14892c794233d603a858`. That source object is not available in this local checkout. The handler tests below apply to the local files, not a byte-for-byte verification of the published bundle. No source token was created to inspect it, and no hosted changes were made.

## Reproducible local check

From `mobile/`, using the existing Node 24 toolchain and installed dependencies:

```sh
node --import tsx feasibility/check-current-api.mjs
```

The check transpiles the actual local authentication helper and GET/PUT handlers, uses their real import/grade/activity/Canvas/reminder validation helpers, and executes the SQL against disposable in-memory SQLite. Only the framework request headers and D1 binding are substituted. Network calls fail explicitly. It does not change application code, local user databases, fixtures on the phone or the hosted service.

Passed:

- Missing trusted identity gives 401. A synthetic bearer header alone produces no user. Native-scheme sign-in return paths are normalised to the site root.
- Synthetic Alice/Bob records remain isolated. A disallowed browser Origin gives 403 without saving. A full-snapshot preparation completion retains the parent assessment's grade, due date and an unknown future field.
- A stale revision gives 409 without changing storage. A client too old to preserve existing reminders is also rejected.
- **Characterised limitation:** a reduced snapshot with the current revision/client version is accepted and removes the omitted grade/unknown field in the disposable database. This demonstrates existing whole-document semantics, not a mobile-safe patch endpoint. The test intentionally records this limitation; it must not become a requirement for a future narrow API.

These checks do not validate hosted sign-in, Sites header sanitisation, production D1 behaviour, simultaneous network races, native token storage, offline queues, or cross-device/widget refresh. A fake identity in the test harness is not evidence of successful native authentication.

## Bounded next experiment

1. **Resolve the supported login path.** Establish native public-client registration, an allowed redirect, authorization-code exchange with PKCE, token audience/validation, renewal and revocation. If Sites cannot provide this, select an isolated auth/API environment with a synthetic account and no production migration. Reusing a server-side Sites OAuth client ID in the phone is not a verified solution.
2. **Read one board.** Use an authenticated, versioned projection with board identity/generation, revision, units, stored teaching weeks and assessment dates/requirements. Retain unknown dates/times instead of inventing them. Exclude recovery snapshots and private import/feed data. The current 2026 schema limit is real; do not silently widen it in the phone.
3. **Write one preparation completion.** Proposed shape: `PATCH /mobile/v1/tasks/:id/completion` with `{ boardGeneration, expectedRevision, done, mutationId }`. These are proposed names, not existing routes. The server derives the owner from verified authentication, loads the current full board, verifies the exact task and its preparation meaning, changes only its completion and saves atomically. It never takes an owner from the body. A retry of a successful mutation returns its prior result instead of toggling twice; an unseen stale revision or replaced board returns a conflict.
4. **Observe the same state in a web test client.** Both clients use the same test backend and account. A separate unrelated native database does not demonstrate sync with the current website. Connecting the production website later requires an explicit data/access transition, account mapping, backup and rollback rehearsal.
5. **Add honest failure and widget behaviour.** A failed/offline write stays visibly unsaved; no invented success. Clear account-specific cache and widget content on sign-out/account change. Widgets receive only a minimal display snapshot plus successful-sync time, never account credentials. App foreground refresh and actual OS widget refresh are distinct acceptance checks.

Exit evidence: native login returns to the app; Alice cannot access Bob; sign-out/revocation prevents later access; web and phone read the same synthetic revision; one completion and Undo affect only that preparation task; two-client conflicts and a lost-response retry retain all other fields; widget display identifies its freshness. Until these pass, describe the experience as a local preview or isolated integration trial.

## On-device session probe — preview 0.3.1

Daniel authorised trying the current site before considering migration or another solution. The preview adds a bounded **Widgets → Test website connection** diagnostic. It checks a native `HEAD /api/semester`, opens the existing same-origin Sites sign-in with Expo's system authentication browser, and checks HEAD again after the user closes the browser. The user separately records whether the website actually opened. No production route or audience is changed.

The configured native return URL is only an observation endpoint in the app; it is not supplied as an unsupported Sites `return_to` and the website does not implement a callback. The user therefore closes this browser with Cancel. A returned URL is not trusted as authentication. No authorization-code exchange or native token implementation is claimed. This experiment can show whether direct browser-session reuse works, not whether every possible supported Sites integration will work.

The diagnostic never reads response bodies or sends explicit credentials/identity headers. It allows the native network stack's own cookie handling, does not extract browser cookies, and retains only status classifications in screen state. Redirects, HTML, network failure, timeouts, API rejection and unsupported HEAD are distinct. Even a 200 JSON response remains identity-unverified. Real login, authenticated synthetic reads, isolation, renewal/revocation and sync still need separate proof. The app's local sample/task/widget storage is unchanged.

The added system browser uses `ASWebAuthenticationSession` on iOS, per [Expo's SDK 55 WebBrowser contract](https://docs.expo.dev/versions/v55.0.0/sdk/webbrowser/). It is not an embedded WebView. A successful browser login by itself is not evidence that native fetch has an authenticated session.

Validation: 21 tests, TypeScript, JS export and both native Release builds passed. Daniel confirmed 0.3.1 is installed on his iPhone; `devicectl` independently confirms 0.3.1 (5). After Daniel reported the existing Simulator session was ready, direct UI inspection confirmed that the Semester website had opened in the system sign-in browser. The browser sheet was closed without reopening or restarting the app. The completed diagnostic showed **Before: API requires sign-in (401)** and **After: API requires sign-in (401)**. The local website-open observation was set to Yes. Physical-phone Before/After results remain unreported.

This establishes that the website opens in the iOS system browser, while the native HEAD request in this Simulator trial remains unauthenticated after browser sign-in. Direct reuse of that browser session did not establish native access. It does not prove that all supported Sites integration paths are unavailable, nor test a widget's background access. The next step remains the bounded native-authentication/shared-data experiment above, starting with a supported login path; a production migration is not yet selected. Preview source is preserved at `ios-preview-v0.3.1` (`ea6360d`). Concurrent website work has advanced the hosted application beyond the version-63 audit above; the status probe sends no board or sync-version payload and makes no compatibility claim for writing to those later APIs.

## Alternatives

| Route | When it helps | What it does not prove |
| --- | --- | --- |
| Supported Sites native auth, if confirmed | Keeps the current hosting and owner identity while adding a narrow API. | Documentation and an end-to-end native trial are still needed; an `auth_client_id` alone is insufficient. |
| Isolated shared API/auth experiment | Tests the account/API boundary that a future migration will need, while retaining the native UI and reusable domain logic. | It does not sync existing production users until both clients and owner mapping are deliberately connected. |
| Explicit file import or browser handoff | Can test realistic read-only display or let students use the existing website. | Neither is automatic cross-device sync or authenticated background widget access. This is a fallback, not the chosen implementation. |

## References

- Local evidence: `app/chatgpt-auth.ts`, `app/api/semester/route.ts`, `lib/storage.ts`, `lib/semester.ts`, `lib/sync.ts`, `mobile/src/model.ts`, `mobile/src/personal-plan.ts`.
- Installed [Sites identity contract](/Users/Daniel/.codex/plugins/cache/openai-curated-remote/sites/1.1.2/skills/sites/references/identity-and-secrets.md) and [storage contract](/Users/Daniel/.codex/plugins/cache/openai-curated-remote/sites/1.1.2/skills/sites/references/storage.md), inspected 2026-11-02. These describe the supported platform surface; no undocumented AuthAPI was called.
- [Expo SDK 55 AuthSession](https://docs.expo.dev/versions/v55.0.0/sdk/auth-session/) supports browser-based OAuth/OIDC and requires a configured callback; it does not supply an identity provider or add native support to Sites. Its authorization-code request defaults to PKCE with S256.
- [RFC 8252, OAuth for Native Apps](https://www.rfc-editor.org/rfc/rfc8252) specifies an external user agent and PKCE for public native clients. Browser sign-in state and a token usable by the app are separate parts of that flow.

Product options and decisions continue in [the Notion notebook](https://app.notion.com/p/40bd6bfd790e81c1800cdf60f250174f). This directory retains the reproducible technical evidence, not a second product backlog.
