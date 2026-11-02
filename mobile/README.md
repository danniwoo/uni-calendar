# Semester iPhone experiment

An Expo/React Native preview with an **invented sample semester and device-local personal tasks**. Version 0.3.2 retains compact Home, Today, Month and Assessments views, two rectangular Lock Screen widgets and a medium work overview. A separate Google + D1 proof screen can authenticate and update synthetic cloud tasks once its staging environment is configured. The original Sites connection diagnostic is preserved. No production timetable, Canvas connection, analytics or production-data migration is implemented. The existing website remains the production app.

## Independent Google + D1 proof — 0.3.2 (6)

Open **Widgets → Test Google + D1 connection**. This screen is separate from the sample screens, personal tasks and sample widgets. If configuration is missing, it explicitly says **Setup needed**; it does not simulate a successful login.

1. Copy `staging.env.example` to ignored `.env.local` and set the new Supabase URL, **publishable** key and independent staging Worker URL. Expo embeds these public values at build/export time. Never put a service-role key, Google client secret or database password in this file.
2. Enable Google OAuth in the staging Supabase project. Google’s authorised callback is the Supabase project callback shown in its Google provider settings. Add the exact mobile return `semester-preview://auth/callback` to Supabase’s redirect allowlist. Web and mobile use the same staging Auth project.
3. Install this worktree's dependencies, then rebuild the native app: the new `expo-secure-store` and `expo-crypto` modules are not in the existing 0.3.1 binary. The configured 0.3.2 (6) build was installed on the paired iPhone on 2026-11-02.
4. Use **Continue with Google**, then **Load / refresh test semester**. The app opens the system authentication browser, exchanges the returned code using a stored S256 PKCE verifier, and sends the resulting **Supabase access token** to the Worker. Opening a website alone is not treated as connected.
5. If the API confirms that this account has no board, use **Create my sample semester**. Repeated creation is idempotent on the API; it must not replace an existing board.
6. Toggle a preparation task. The request changes just that task’s `completed` value with `expectedRevision`; compare by refreshing the web proof. A 409 clears the stale board and requires refresh before retrying. No automatic overwrite/retry occurs.
7. Sign out or switch accounts and confirm the previous board disappears. An account-generation guard aborts requests and rejects late results. Synthetic board data is held only in component memory; auth sessions/PKCE verifiers are stored in private, device-only Keychain chunks. There is no refresh token in AsyncStorage or widget storage.

The API origin must use HTTPS on a physical iPhone. HTTP loopback is allowed for a local Simulator API only; it does not refer to the Mac when used on a physical device.

**Live phone evidence, 2026-11-02:** Daniel supplied a 0.3.2 screenshot showing Google sign-in, verified API identity, revision 2 and the task previously checked on the web. He then checked the second task on the iPhone and reported revision 3. Refreshing the web independently returned revision 3 with both tasks checked. Native login, an authenticated read and a narrow task write visible on the other device have passed, in both directions using explicit refresh.

**Current limits:** phone restart/session persistence, token refresh, real multi-account provider testing and cloud widgets remain unverified. The successful login is not a complete Keychain lifecycle test. Cold launch partway through browser sign-in requires retrying login. Existing widgets remain sample-only; connecting a separate widget to the cloud proof is still pending.

Validation in the isolated worktree: TypeScript and eight new tests passed, covering configuration/callback validation, DTO validation, bearer and revision request shape, account-switch request invalidation, chunked Unicode storage/failed-write preservation, and a real pinned-SDK S256 exchange/session/sign-out lifecycle with a simulated Auth server. iOS Metro/Hermes export passed. The physical-device Release build and strict deep signature verification passed; app and widget are 0.3.2 (6), retaining the shared App Group with no push entitlement. The staging API URL is present in bundled JavaScript, and SecureStore/Crypto are in the native binary. Installation succeeded without uninstalling the prior app. No Simulator was opened. Build log: `/private/tmp/semester-ios-v032-device.log`.

Sources: [Supabase Expo social auth](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-sign-in), [Google provider setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Expo SecureStore](https://docs.expo.dev/versions/v55.0.0/sdk/securestore/). Pinned SDK source was also inspected for PKCE flow IDs and session-coordination behaviour.

Stage 2 investigation has started: see [hosting/authentication findings and the disposable API check](feasibility/README.md). The status-only connection test is not a native authentication implementation.

## Try the website connection

Open **Widgets → Test website connection → Start connection check**. Continue into the iOS authentication browser and sign in to the existing Semester website if prompted. Once the website opens, tap **Cancel** in the browser to return. This closes the diagnostic browser; it does not establish whether website sign-in succeeded or failed. The site currently has no automatic callback to this app.

The screen compares a native API HEAD request before and after the browser and lets you record whether the website opened. **Check app access only** retries without opening sign-in. Record the Before/After statuses and your website observation. A 200 JSON header is only an API response, not verified identity; 403 does not distinguish access policy from request restrictions. A redirect or HTML page is never treated as a connected session. A 405/501 means HEAD is unsupported, not that native auth is impossible.

Only response status, content type and the destination's match to the expected API are inspected. The app does not read a semester response body, extract browser cookies, receive a supported token, write records, persist diagnostic results or publish them to analytics/widgets. These results test direct browser-session reuse only. An authenticated read, account isolation, refresh/revocation and a narrow synthetic write remain separate acceptance checks.

## Try the journey

1. Open **Semester Preview → Home**. Identify the sample teaching week, this week's deadlines, next week and dates needing confirmation. Counts describe dated deadlines, not estimated workload.
2. Open an assessment, inspect its exact date/requirements, record a preparation step, close and reopen the app, then Undo. Preparation never marks work submitted or changes a grade.
3. Open **Today → My plan → Add task**. Enter a task, optionally choose a unit, and plan it for Today or Tomorrow. Save; tap the row to edit it. Complete a task and Undo, or expand Completed to reopen it. Unfinished tasks from earlier dates stay visible under **Still on your list**; future plans stay under **Planned ahead**. **Suggested steps → + Today** copies a sample preparation step into your plan without duplicate active copies. Personal task completion does not change assessment submission, grades or the separate sample preparation record. Delete from Edit task, confirm, and use Undo immediately. Close/reopen the app to verify persistence. Refreshing the sample week must preserve your tasks.
4. Open **Month**. Move between months, select a marked day, inspect the named assessment, and return to the selected date. Unknown-date work remains in a separate section below the grid. Use **Jump to today** to return.
5. Open **Assessments** and filter by unit. Switch to **Grades**: invented marks and an unreleased result, with no overall grade calculation.
6. Open **Widgets** in the top bar. Select one or more units and turn **Show assessment titles** on/off. Tap **Save widget content** to persist these choices and request an update to both deadline widgets and Work overview. The sample board and original next-class widget are unaffected. Compare **One deadline**, **Two deadlines** and **Overview** below; changing this layout preview does not change the layout already added through iOS. **Try where this widget opens** uses the displayed filtered deadline.
7. On the Lock Screen, touch and hold → **Customise → Lock Screen → Add Widgets → Semester Preview**. Add **Next deadline · Sample** or **Two deadlines · Sample**. The single widget opens its assessment; the two-item widget opens all assessments. Test readability and actual taps on the phone.
8. On the Home Screen, touch and hold → **Edit → Add Widget → Semester Preview → Work overview · Sample**. The medium widget includes upcoming work plus unknown/past-date context. The original **Next class · Sample** remains available for comparison.
9. Use **Widgets → Refresh sample week** only when you want new dates and reset preparation. Cancel leaves the stored sample unchanged.

Semester dates, teaching weeks, rooms, weights, requirements and marks are invented. Personal task titles and planned days are supplied by the user. The sample teaching week is anchored at week 10 on the Monday of the seed week; it is not USYD's academic calendar. Existing 0.1.0 seed/progress is retained, so an older installed sample may show past dates until explicitly refreshed.

Work widgets publish entries at Sydney midnights (21 days ahead) and every future deadline. Passed dates are counted as “past date · check”, not assumed unsubmitted. Undated work is never assigned a made-up day. iOS controls actual refresh timing; the app republishes on launch/foreground. These widgets are not notification reminders. Background refresh and physical Lock Screen readability require device observation.

## Prototype boundaries

The widget gallery is deliberately small. No favourite/winning design, retention tracking, grade-update feed or automatically generated live checklist is implemented. Broader ideas stay in [Notion](https://app.notion.com/p/40bd6bfd790e81c1800cdf60f250174f). Today offers sample suggestions and user-created personal tasks with Today/Tomorrow planning. It has no automatic scheduling or prioritisation engine. Task planned days are not assessment due dates and are not added to the assessment calendar or deadline widgets.

## Local development

### Preserved comparison version

The independently authenticated preview with verified bidirectional synthetic task updates is preserved at **`ios-preview-v0.3.2`**. It uses the staging Google/Supabase/D1 environment; cloud widgets and production migration remain separate work.

The status-only connection diagnostic is preserved at **`ios-preview-v0.3.1`**. Its sign-in trial is separate from the local preview's sample data and personal tasks.

The personal-planning preview is preserved at **`ios-preview-v0.3.0`**. Widget content customisation remains at **`ios-preview-v0.2.1`**, commit **`45ab767`**. These checkpoints preserve source, not a backup of tasks stored on the phone.

The 0.2.0 work-dashboard prototype is separately preserved at **`ios-preview-v0.2.0`**, commit **`cc69f40`**.

The first physical-iPhone-tested preview is saved at Git tag **`ios-preview-v0.1.0`**, commit **`6f544ba`**. This is a local source checkpoint including the dependency lockfile and native generation configuration. It preserves the original UI for comparisons and rebuilding; it is not an App Store release or a backup of device data.

Compare subsequent changes with `git diff ios-preview-v0.1.0 -- mobile lib/sydney-time.ts`. To rebuild the baseline without replacing current work, run `git worktree add --detach ../semester-ios-v0.1.0 ios-preview-v0.1.0` from the repository root, then follow the development steps in that worktree's `mobile/` directory. Native build tools and valid signing are still required. Do not move this tag when making the next prototype.

### Build and run

Use Node 24 LTS (see `.nvmrc`), Xcode 26.2 and CocoaPods. This local experiment pins Expo SDK 55 to match the installed Xcode. SDK 58 requires Xcode 26.4+ and failed inside its native framework with the installed compiler; no framework source was patched. Expo Widgets is alpha in SDK 55, so reassess the SDK/widget choice before a public release.

```sh
npm ci
npm run typecheck
npm test
npm run export:ios
npx expo run:ios --configuration Release --device 'iPhone 17 Pro' --no-bundler
```

The Release simulator build bundles JavaScript and can reopen without Metro. For development, use `npm run ios`, then `npm start` as needed. Expo Go does not contain the native widget module.

SDK 55's widget plugin adds a push entitlement even with push disabled. `plugins/withLocalWidgets.js` removes only that unused entitlement; both targets retain `group.dev.semester.preview`. It is registered before `expo-widgets` because entitlement mods execute in reverse registration order. This preview does not use remote push. After changing native configuration, use `npx expo prebuild --clean --platform ios`: repeated non-clean prebuilds in this SDK can duplicate the widget target. `ios/` is generated; do not keep hand-written changes there.

Physical iPhone: connect/unlock/trust the phone, enable Developer Mode if required, then run `npx expo run:ios --configuration Release --device --no-bundler` and select the phone. This bundles the sample so the trial does not need Metro or a connection to the Mac. Signing must use your own Apple development team. The widget requires a shared App Group; available signing capabilities depend on the team. Do not remove the widget entitlement just to make installation appear successful. No App Store/TestFlight upload is part of this stage.

The separate `package-lock.json` fixes mobile dependencies. Generated `ios/`, Pods, builds and simulator data are ignored; app configuration regenerates the widget target. Root web TypeScript/ESLint exclude this separate app. `lib/sydney-time.ts` is the single pure timezone helper shared with web reminders; no other web/server dependencies enter the mobile bundle.

## Scope and validation

Personal tasks use the separate `semester.preview.personal-plan.v1` key. The store retains task IDs, titles, optional unit, planned day, creation/completion timestamps and an optional sample-suggestion identity. It rejects unreadable storage rather than silently dropping user tasks. Writes update visible task state only after successful persistence, with a save lock to prevent competing changes. Failed writes retain the previous plan and editable draft. Undo applies to the last completion/deletion while the controller remains mounted; it is not a persistent Trash.

The app also persists a synthetic fixture seed and per-assessment preparation booleans under `semester.preview.sample.v1`, plus widget unit/title preferences under `semester.preview.widgets.v1`. Widget choices are shared across all deadline/overview widget instances on this device. They are not per-instance iOS Edit Widget configuration. Draft changes affect the in-app preview; only a successful Save updates widget timelines. Closing the sheet discards unsaved choices. The app prevents saving an empty unit selection, and sample refresh retains saved widget preferences. Only known item IDs are restored. Storage failures retain previous visible progress and show an error. Refresh requires confirmation. Widget deep links accept only known local sample items.

Stage 1 acceptance and outstanding student/device trials remain in **../ROADMAP.md → IOS-01**, the single status tracker. Passing a simulator or automated check is not proof of student usefulness or physical-device behaviour.

### 0.3.0 implementation evidence — 2026-11-02

- TypeScript, all 18 model/storage/timeline tests and production iOS JavaScript export passed. Tests include malformed personal storage, Sydney-day carryover, planning-day validation and suggestion deduplication.
- Simulator and physical-device Release builds passed with 0 errors / 4 warnings each. `devicectl` confirms **0.3.0 (4)** installed on the paired iPhone. Build logs: `/private/tmp/semester-ios-v03-export.log`, `/private/tmp/semester-ios-v03-simulator.log`, `/private/tmp/semester-ios-v03-device.log`.
- Simulator UI verified blank-title prevention, creating a task with a unit, editing its title and moving it to Tomorrow, copying a suggestion, completion/Undo, confirmed deletion/Undo, and retaining both personal tasks after sample refresh and full close/reopen. Widget preferences survived the upgrade.
- Phone task usability, background widget refresh and broader Stage 1 usefulness remain unverified. Personal tasks do not yet appear in widgets or sync with the website. No live records or hosted application were changed.

### 0.3.1 connection diagnostic evidence — 2026-11-02

- TypeScript, all 21 tests and production iOS JavaScript export passed. New tests cover status/redirect classification, HEAD-only requests without reading bodies, timeout and cancellation; no response establishes a verified account.
- Simulator and device Release builds passed with 0 errors / 4 warnings each. Installer completed, `devicectl` confirmed **0.3.1 (5)**, and Daniel confirmed 0.3.1 appears on his iPhone. Logs: `/private/tmp/semester-ios-v031-export.log`, `/private/tmp/semester-ios-v031-simulator.log`, `/private/tmp/semester-ios-v031-device.log`.
- Simulator UI verified the settings entry and instructions, disabled controls while checking, retained widget preferences, and arrival at the Google/OpenAI sign-in browser. On resuming the existing session at Daniel's request, the Semester website was visibly open. Closing only the browser sheet completed the diagnostic: **Before 401 / After 401**, both labelled API requires sign-in. Website opened was recorded as Yes. Browser sign-in did not establish native API access in this trial; other supported Sites integrations remain unverified. Physical-phone results remain unreported. See [interpretation and next experiment](feasibility/README.md#on-device-session-probe--preview-031).

The experiment asks: can a student see the week and upcoming work across units, notice unknown dates, distinguish deadlines from preparation, and use a Lock Screen widget? Ask them to perform these tasks without coaching and record missed items and assistance needed. Stage 2 owns authentication/hosting feasibility and live cross-device writes.

Native widget API reference: https://docs.expo.dev/versions/v55.0.0/sdk/widgets/
