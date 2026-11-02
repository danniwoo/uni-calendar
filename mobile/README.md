# Semester iPhone experiment

Stage 1 only: an Expo/React Native app with **invented, device-local data**. Version 0.2.0 explores compact Home, Today, Month and Assessments views, two rectangular Lock Screen widgets and a medium work overview. No sign-in, live timetable, Canvas access, analytics, cloud writes or migration. The existing website remains the production app.

## Try the journey

1. Open **Semester Preview → Home**. Identify the sample teaching week, this week's deadlines, next week and dates needing confirmation. Counts describe dated deadlines, not estimated workload.
2. Open an assessment, inspect its exact date/requirements, record a preparation step, close and reopen the app, then Undo. Preparation never marks work submitted or changes a grade.
3. Open **Today**: due-today items, suggested preparation already populated from the sample, and a compact class list. A checked item remains visible and can be undone.
4. Open **Month**. Move between months, select a marked day, inspect the named assessment, and return to the selected date. Unknown-date work remains in a separate section below the grid. Use **Jump to today** to return.
5. Open **Assessments** and filter by unit. Switch to **Grades**: invented marks and an unreleased result, with no overall grade calculation.
6. Open **Widgets** in the top bar. Compare **One deadline**, **Two deadlines** and **Overview**; use **Try where this widget opens** to inspect each destination. This selects an in-app preview, not a system widget preference.
7. On the Lock Screen, touch and hold → **Customise → Lock Screen → Add Widgets → Semester Preview**. Add **Next deadline · Sample** or **Two deadlines · Sample**. The single widget opens its assessment; the two-item widget opens all assessments. Test readability and actual taps on the phone.
8. On the Home Screen, touch and hold → **Edit → Add Widget → Semester Preview → Work overview · Sample**. The medium widget includes upcoming work plus unknown/past-date context. The original **Next class · Sample** remains available for comparison.
9. Use **Widgets → Refresh sample week** only when you want new dates and reset preparation. Cancel leaves the stored sample unchanged.

All dates, teaching weeks, rooms, weights, requirements and marks are invented. The sample teaching week is anchored at week 10 on the Monday of the seed week; it is not USYD's academic calendar. Existing 0.1.0 seed/progress is retained, so an older installed sample may show past dates until explicitly refreshed.

Work widgets publish entries at Sydney midnights (21 days ahead) and every future deadline. Passed dates are counted as “past date · check”, not assumed unsubmitted. Undated work is never assigned a made-up day. iOS controls actual refresh timing; the app republishes on launch/foreground. These widgets are not notification reminders. Background refresh and physical Lock Screen readability require device observation.

## Prototype boundaries

The widget gallery is deliberately small. No favourite/winning design, retention tracking, grade-update feed or automatically generated live checklist is implemented. Broader ideas stay in [Notion](https://app.notion.com/p/40bd6bfd790e81c1800cdf60f250174f). The v0.2 task list uses explicit sample suggestions; it has no scheduling or prioritisation engine.

## Local development

### Preserved comparison version

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

The only persisted data is a synthetic fixture seed and per-assessment preparation booleans under `semester.preview.sample.v1`. Only known item IDs are restored. Storage failures retain previous visible progress and show an error. Refresh requires confirmation. Widget deep links accept only known local sample items.

Run results and outstanding student/device trials are recorded in **../ROADMAP.md → IOS-01**, the single status tracker. Passing a simulator or automated check is not proof of student usefulness or physical-device behaviour.

The experiment asks: can a student see the week and upcoming work across units, notice unknown dates, distinguish deadlines from preparation, and use a Lock Screen widget? Ask them to perform these tasks without coaching and record missed items and assistance needed. Stage 2 owns authentication/hosting feasibility and live cross-device writes.

Native widget API reference: https://docs.expo.dev/versions/v55.0.0/sdk/widgets/
