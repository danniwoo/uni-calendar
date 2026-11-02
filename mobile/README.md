# Semester iPhone experiment

Stage 1 only: an Expo/React Native app with an **invented sample semester and device-local personal tasks**. Version 0.3.0 explores compact Home, Today, Month and Assessments views, two rectangular Lock Screen widgets and a medium work overview. No sign-in, live timetable, Canvas access, analytics, cloud writes or migration. The existing website remains the production app.

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

The experiment asks: can a student see the week and upcoming work across units, notice unknown dates, distinguish deadlines from preparation, and use a Lock Screen widget? Ask them to perform these tasks without coaching and record missed items and assistance needed. Stage 2 owns authentication/hosting feasibility and live cross-device writes.

Native widget API reference: https://docs.expo.dev/versions/v55.0.0/sdk/widgets/
