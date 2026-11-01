# Semester iPhone experiment

Stage 1 only: an Expo/React Native app and a medium Home Screen widget with **invented, device-local data**. No sign-in, live timetable, Canvas access, analytics, cloud writes or migration. The existing website remains the production app.

## Try the journey

1. Open **Semester Preview**. Its next sample class is 45–60 minutes after first launch. All dates, rooms, weights and tasks are invented; Sydney time is explicit.
2. Inspect the next class, then select different dates in Schedule, including an empty day.
3. Open **Assessments → Project report**. Record its preparation action, close/relaunch the app, and check that it remains recorded. Undo it. This never marks a submission or grade.
4. Open the database quiz: its teaching week is known but its date remains unconfirmed.
5. On the Home Screen, touch and hold → **Edit → Add Widget → Semester Preview → Next class · Sample**. Add the medium widget. Tap it to open the matching class.
6. Use **Sample preview → Refresh sample week** to replace only this app's synthetic data and reset preparation progress.

The widget uses the same sample board as the app. Its timeline has entries at class starts and ends, including a final empty state. It is read-only. iOS controls actual refresh timing. The app republishes the timeline on launch/foreground, not continuously. A sample generated days ago is retained until explicitly refreshed.

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

The experiment asks: can a student find the next class/room, distinguish deadlines from preparation, understand uncertain timing, and find the widget useful? Ask them to perform these tasks without coaching and record confusion and assistance needed. Stage 2 owns authentication/hosting feasibility and live cross-device writes.

Native widget API reference: https://docs.expo.dev/versions/v55.0.0/sdk/widgets/
