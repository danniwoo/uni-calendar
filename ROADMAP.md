# ROADMAP — 現在在哪裡，下一步做什麼？

## GROWTH-01 · Invitation self-onboarding

**Stage 1 · staging core path accepted; remaining browser matrix deferred by owner · 2026-11-10**

- Added append-only staging migration `0006_invitation_access.sql`: private opaque invitation hashes, atomic bounded redemptions and explicit account access states. Existing `backup_trial_members` become active `legacy_pilot` accounts without consuming invitations.
- Supabase `(issuer,sub)` still creates only the stable D1 identity mapping. Every academic API route separately requires active enrolment. Suspended/deletion-state rows override legacy membership.
- The Pages flow removes the token from the fragment immediately, preserves it in same-tab session storage across PKCE, redeems after authentication and opens `/board/` only after the Worker confirms access. Invalid, expired, revoked and exhausted links remain on the account page with bounded messages.
- Operator-only local/remote Wrangler CLI creates or revokes private links; local is the default and remote requires an explicit flag. No administrator HTTP route, campaign, friend referral, attribution or analytics was added.
- Staging migration `0006` and the Stage 1 Worker/Pages builds were deployed only to `semester-staging-api` / `semester-pilot`. Worker version `55717d88-cc6b-44b9-96bf-94c1e0ed4d41`; pre-migration D1 export and Worker/Pages rollback artifacts are retained under ignored `migration/private/backups/`.
- Real acceptance passed for a clean Google identity: invitation preview → Supabase OAuth → automatic D1 mapping/enrolment → empty board → synthetic DEMO1001 JSON import → full reload persistence. Existing pilot access and the migration backfill were also verified. The owner then explicitly deferred further browser UI/UX work; live uninvited-account denial, live two-account isolation, interrupted OAuth and a hosted final-slot race remain unclaimed (their automated coverage passes).

## GROWTH-02 · Society campaigns + unified friend referrals

**Stage 2 · deployed to isolated staging / live referral chain not yet accepted · 2026-11-11**

- Added append-only `0007_growth_referrals.sql`: society campaigns, invitation context, immutable first-touch acquisition, referral ancestry, minimal public friend profiles, request/accept/block relationships and independent friend rate windows.
- One personal opaque link now has two server-separated effects: it may enrol a new account and record `friend_referral`, then only after explicit recipient confirmation creates a pending request. The inviter must still accept. Existing enrolled recipients consume no acquisition capacity and never have original attribution overwritten.
- Society links record direct `society` acquisition. Friend descendants record their immediate referrer plus the original root campaign. A forwarded society URL remains direct society acquisition. Tokens remain hash-only; public Friends responses exclude internal account IDs and attribution.
- The staging account page has minimal profile, create/revoke/copy link, request confirmation and accept/decline/remove/block controls. Existing Sites Friends tables were used as the behavioral reference but were not migrated or modified.
- Local evidence: 25/25 Worker/API tests, 13/13 web tests, both typechecks, Worker dry-run, staging-web build, root production build and existing Friends privacy/scaling regressions pass. The synthetic test covers SYNCS A → B → C ancestry, explicit consent/acceptance, idempotent duplicate requests, self-referral, exhausted acquisition quota for an existing user and response privacy.
- Migration `0007` and the combined Stage 3 Worker/Pages build are now on isolated staging. Existing 5/5 access rows were preserved and all 5 accounts received non-destructive attribution backfill. The remaining acceptance gate is a real society A → friend B → friend C chain plus existing-user friendship behavior; it must not be described as passed yet.

## GROWTH-03 · Semester Admin — Growth & Invitations

**Stage 3 · deployed to isolated staging / owner dashboard smoke accepted · 2026-11-11**

- Added migration `0008_admin_growth.sql`: explicit D1 administrator roles, append-only audit records, revisioned draft/published growth policy, campaign-wide capacity and separately attributable distribution links. Admin authority is bound to the verified Supabase `(issuer, subject)` through the existing D1 account mapping; email and editable metadata never grant it.
- Added authenticated Worker management APIs and `/admin/` for growth-stage suggestions, draft/review/publish access controls, private invitations, campaigns and distribution URLs, user suspension/restoration, and audit history. The student-facing board shows the Admin link only after server confirmation.
- Published policy is enforced by public redemption and Friends routes. Drafts are inert; stage presets only suggest values; publishing needs explicit confirmation plus both draft and published revision checks. Pausing new enrolments does not affect existing active accounts. New-account referral enrolment and existing-user friend requests remain separate controls.
- Admin responses intentionally exclude boards, imports, grades, plans and other academic content. Raw invitation tokens are returned once at creation and never stored or audited. Public Semester enrolment remains disabled until its authorization model is implemented safely.
- Evidence: 30/30 Worker/API tests, 15/15 web tests, API/web/root typechecks and builds, Worker dry-run, and existing course-plan/Friends privacy and scaling regressions pass. Before remote migration, a full D1 export was SQLite-restored with `integrity_check=ok`; SHA-256 `546c58df078fe2bb548786f1df9b48c5963944e551b5281510aedd1f1b8ed718`.
- Staging migrations `0007` and `0008` applied with no pending ledger entries. Worker version `1daea0c8-2986-43f5-a915-80eed98d3552` is live; health, existing protected-route 401s, admin-route 401s and Pages-origin CORS 204 passed. The verified active account for `594danielwu@gmail.com` was provisioned as the sole owner and its hosted dashboard visibly loaded `Verified owner`, Published v1 and 5 enrolled accounts. No policy mutation/invitation/campaign/suspension was exercised through the hosted UI yet. Stage 4 owns activation/retention analytics, conversion tables and decision guidance.

## GROWTH-04 · Growth, retention & product analytics

**Stage 4 · deployed to isolated staging / hosted OAuth and multi-account acceptance still pending · 2026-11-11**

- Added additive migration `0009_growth_analytics.sql`. It begins prospective, versioned event measurement; compacts repeated feature use to one account/feature/day row; retains only a coarse academic period key; and backfills the root distribution-link ID for existing A → B → C ancestry without inventing historical activity.
- Worker-authoritative signals cover enrolment attribution, imports, saved planning/task outcomes and Friends transitions. The only public browser event is an invitation landing: it validates the opaque link server-side, stores a one-way hash of a random tab-scoped visit ID, deduplicates per link/tab and is bounded per link/hour. Raw tokens, IP identity, fingerprints, email, course names, grades, WAM, task text and semester JSON are not stored in analytics.
- `/admin/` now has real Acquisition, Conversion, Retention, Referral and Engagement views: date/campaign/channel/source filters, onboarding funnel, per-distribution performance, mature Week-1/2/4 cohorts, referral amplification, feature adoption, aggregate CSV and deterministic evidence/caveat/action observations. Empty, immature, untracked and small-cohort states are explicit; sample mockup values are never shown as measurements.
- Activation means the first server-observed import or meaningful saved planning/task outcome. Login and passive views do not activate. Retention excludes accounts whose observation window has not elapsed. Existing-user friendship does not become acquisition. Campaign descendants preserve the root link but remain distinct from direct joins.
- Local evidence was rerun before deployment: API 34/34 and Web 16/16 tests, API typecheck, Worker dry-run and the staging web build pass. Tests cover migration backfill, token-safe landing/auth correlation, admin isolation, campaign filters, a mature five-person cohort, 60% Week-2 retention, A → B → C descendants, small-cohort suppression and fail-open product mutations.
- The pre-`0009` D1 export restored locally with `integrity_check=ok` (SHA-256 `9304f26d047839ccfae289b7700422c4f11cb3412952bcf5b6a08975e9635cd8`), and the exact Stage 3 Pages artifact was preserved (SHA-256 `d598a3f189c527a59687a6a2c2c4e346ab8365aca8b69f8589b6516b38562600`). `0009` then applied only to `semester-staging`; the existing 5 accounts, 5 active access rows, 5 attribution rows and sole owner remained unchanged.
- Stage 4 Worker version `2b0123fc-6aac-4e3f-b118-2a292bb449fb` and Pages deployment `9c1e9cef-c34e-4981-a669-3c3cf9708608` (`cf21bb3`) are live. Health, unauthenticated admin denial, hosted owner dashboard load, landing-event dedupe and revoked-link rejection passed. A real invited Google account, uninvited account, import persistence, cross-account isolation and full SYNCS → A → B → C chain remain manual hosted acceptance and are not claimed as passed. Week-2 results remain unavailable until cohorts mature.
- USYD's current network intercepts `semester-pilot.pages.dev` with a certificate issued by `fortigate.sydney.edu.au`; the personal Mac does not trust that interception chain and correctly shows a privacy error. The Worker domain retains a valid Let's Encrypt chain. Do not bypass the warning: complete browser acceptance over a mobile hotspot/non-USYD network and request a USYD whitelist before campus rollout.
- Rollback remains Stage 3 Worker `1daea0c8-2986-43f5-a915-80eed98d3552` plus the preserved Stage 3 Pages artifact. The additive `0009` objects can remain while Stage 3 ignores them; restoring the pre-`0009` export is emergency-only and requires separate destructive approval.

本輪狀態（2026-11-02）：Web **0.24.0** navigation dropdown／compact course plan 已依 UI 回饋實作並發布（Sites 68）；0.23.0 已發布（Sites 67），含 invitation status／semester filters／cursor pages／request limits。全朋友／不分享、private grades/WAM 與 Connect **0.5.0** 不變。下一步是版面使用者回饋及 SOCIAL-01 真實雙人試用。


10 人試用檢查補充：Connect **0.4.4** 已替換 Drive 試用 ZIP／指南，修正只開 Canvas 首頁不能 Check all 的問題；2026-11-01 使用者確認 0.4.3 已完成，可與 0.4.4 修正一併整理提交。Web 仍為 Sites 59。10 月 31 日的 57 extension tests、89 瀏覽器解析檢查、24 Web regressions、TypeScript、SQL、production build 與假資料互動通過；**不是實機 T11 或十人負載驗收**。本次提交前重跑 extension 與相關匯入回歸，未改 runtime 或重新發布；證據見 PROGRESS。先做下方 T11，再擴到十人；所有試用者需有網站邀請。

0.14.0：首次匯入直接呈現準備好的成績、可改的建議連結／新增作業，一次 Import；未出分 backlog 收起。使用者明確要求修復朋友首次使用的阻斷，不代表跳過 M1 或宣布 M2 完成。Synthetic 首次、重複匯入與保護檢查通過；T11／新使用者試用仍待驗收。

這是唯一的工作／測試狀態總表。產品用途見 [VISION](VISION.md)，工程細節見 [PROGRESS](PROGRESS.md)。**功能已寫好 ≠ 已發布 ≠ 你已測過 ≠ 流程順。**

## 打開先看這裡

| 看什麼 | 目前位置 | 從哪裡繼續 |
| --- | --- | --- |
| **現在主線** | M1：可靠地管理自己的學期；尚未完成整條使用者驗收 | 先完成 [CONNECT-01](#connect-01) 的真實四科比對 |
| **等你測** | Connect 已修；assessment、準備、成績等改動仍缺完整試用結論 | [測試佇列](#test-queue)，優先 T01 → T02 |
| **本次交付** | FLOW-01：Week／Month 直接列出週次作業、頂部分類切換、完成留在原位＋Undo | Web 0.15.0 已發布（Sites 58）；假資料測試通過，待使用者試用。歷史紀錄延後，本次未改 Connect 或真實資料；CONNECT-01／T11、T09／T10 續接保留 |
| **暫放** | 輕量 Planning 還沒收斂；不因新增功能而當作已完成 | [PLAN-01](#plan-01)：先看真實作業怎麼拆下一步 |
| **接著做** | 修復測試發現的問題，再走一份作業的完整流程 | T03 → T04；不要先再增加頁面 |
| **原生實驗** | IOS-01：使用者批准 Stage 1，獨立 sample-only iPhone app／widget | [IOS-01](#ios-01)；不改 M1、Canvas 試用或正式發布 gate |
| **Web course planning** | SOCIAL-01：多年選課計畫、朋友邀請、同科比對與 private WAM；0.20.0 已發布 | [SOCIAL-01](#social-01)；整份計畫只可分享給全部 accepted friends 或完全不分享；Sites 64，待雙人試用 |
| **之後再決定** | 自動 Canvas 更新、平台演進 | [Later / Ideas](#later-ideas)，不是本輪交付承諾 |

CONNECT-01 首次匯入修復已發布、等待試用。多條工作線可以並存；Now 同時推進最多 1–3 條，其餘留續接點。

## 狀態與更新規則

- **待做**：已決定要做但未開始。**進行中**：目前正在處理。
- **待驗證**：改動存在，但還沒完成對應使用情境。**待修正**：測試發現問題，需修完重測。
- **暫放**：刻意切去別的工作，保留停止原因和下一動作。**阻塞**：缺少明確前提，註明需要什麼。
- **完成**：該工作卡的驗收條件有結果與證據，不只 code/test 通過。
- 優先級：**P0** 資料安全／正確性／核心阻斷；**P1** 核心體驗；**P2** 增益或擴展。優先級不是狀態。
- 本表「待驗證」表示**目前沒有足夠的完整驗收紀錄**，不是斷言從未測過。歷史問題也不直接當作目前仍可重現的 bug。
- 每次切換工作：更新原卡的「停在哪／下一步／證據」，不要只在聊天裡留下提示。回來看同一 ID，不複製新清單。
- 發布時更新 CHANGELOG；收到使用者結果才更新驗收。只有正式版本進版本紀錄；MVP 階段不與 SemVer 綁定。

## MVP 階段

| 階段 | 目標與離開條件 | 狀態 |
| --- | --- | --- |
| **M1 · 自己可靠使用** | 四科資料可核對、匯入保護手動內容、保存可恢復；真實作業從找到→準備→更新走完；已提供的成績功能不誤導 | **目前階段**；T01–T07 尚有待驗證項目 |
| **M2 · 朋友能獨立開始** | 一位新使用者不用旁人逐步指導，能設定自己的學期並完成核心流程；持續試用一週，回來仍能接續 | 待 M1 主要問題解除；T08 |
| **M3 · 擴展** | 根據 M1/M2 回饋選擇下一個最有價值的方向，再定驗收條件 | 順序未承諾；iOS / Friends 等不阻擋 M1 |

不必等所有功能想法都做完才有 MVP。登入和 D1 雲端保存已實作，不列成「未開始建資料庫」。手機 web 專項優化不在目前範圍。

## 使用者主線的成熟度

| 流程 | 已有基礎 | 還要磨順／確認 | 對應工作 |
| --- | --- | --- | --- |
| 帶入資料 | 課表／outline、Connect 匯入預覽與配對、保存／還原 | 四科真實成績、配對信任、刷新與還原保護 | CONNECT-01、DATA-01 |
| 看懂安排 | Semester、Week、Month、Assessment Overview | 一眼找到重要事項，理解各 view；不被 recurring／細節淹沒 | FLOW-01 |
| 找出缺口 | Quiz scope、準備連結、Subject learning record | 找得到該補的內容；區分未知範圍、缺課表與未記錄 | PREP-01 |
| 決定下一步 | Notes、planned start、assessment steps、personal tasks | 個人準備行動不應被誤當正式提交；Planning 工作流未收斂 | PLAN-01 |
| 執行與更新 | 編輯、完成勾選、steps 導覽、共享資料 | 更新後回得去、換 view 找得到，日後能接續 | FLOW-01、DATA-01 |
| 回顧結果 | 個別／總成績、單科摘要與目標估算 | recurring/parts 合計、未知分數與目標文案是否容易理解 | GRADE-01 |

## 工作卡：每條線的續接點

<a id="social-01"></a>
### SOCIAL-01

**Web course plan & friends** · P2 · **待驗證（Web 0.24.0 / Sites 68 已發布）** · 2026-11-02

- 2026-11-02／Web 0.24.0：依使用者回饋把不常用入口收進 dropdown，整理 board toolbar；course plan 直接進 unit cards、WAM 收在下方 expandable row。假資料 UI 檢查通過，待使用者體感回饋；不再先擴新功能。
- 2026-11-02／Web 0.23.0：邀請狀態、expiry、撤銷後 reload；修正 create invite panel；好友／shared units／blocked users 分頁與精確學期 filter；D1 rate windows／pending caps。測試與發布憑據見 PROGRESS，不代表雙人或負載驗收。
- 待真實雙人試用後：修復 onboarding 阻斷，再加入 course-plan restore（目前只有 export）及精確 tutorial group／preferred vs allocated。網站 audience 仍維持現有邀請制。
- 2026-11-02／Web 0.22.0 / Sites 66 已發布：Profile & settings 已放在兩個主要頁面；整合 display name／全朋友分享／blocked users／export／sign out。Friend links 保留 explicit request + acceptance、profile onboarding 後回原邀請，code fallback 仍在；網站 access 仍要由 owner 邀請，未擴大 audience。假帳戶 UI/API/privacy 驗證通過；正式發布憑據見 PROGRESS。
- 本輪之後：兩位真實使用者完整走邀請／登入／profile／request／accept／分享 off／reload／block。本輪已補按學期查詢／分頁／request throttling，仍需真實試用與負載驗證；接著才做精確 tutorial group、preferred 與 allocated 狀態。沒有把這些後續工作或 M1/M2 當作完成。

- 使用者認可方向：跨年／學期規劃選課 → 看同學期同科朋友 → 之後協調同一 tutorial group。第一個 slice 為計畫、friend requests、同科比對與可複製的聯絡文字；不是重做現有 semester board。
- 使用者明確修正 sharing：**整份 course plan 分享給所有 accepted friends，或完全不分享**。包含所有年份、學期與日後新增 units；沒有 per-unit／per-friend permission。預設 private；grades、assessments、私人行程／feed URL 不在共享資料內。
- 已寫 `/plan`、獨立 D1 tables／append-only migration、Considering／Planned／Enrolled／Completed、移動學期／年份、手動 credits、計畫 JSON export。朋友流程含 display name、七日 invitation code、接受／拒絕／取消、remove／block／unblock；只比對同校、同 code、同年與學期，completed 不算一起將修課。
- 使用者追加 private final grades 與總平均，並選擇 **WAM**。已加入 final mark／grade code、跨年 standard WAM estimate、私人的排除選項與計算說明；grade／WAM 永不因朋友分享開啟而公開。數字失敗與重修 attempts 各自計入、未知不是零、非數字／incomplete codes 排除；external credit／exchange／2025 起 OLE 等由使用者排除，faculty weighting／CWAM 未支援。新增 migration 0003 與獨立 privacy／WAM／舊資料 migration tests；假資料 UI 已驗證改分、reload、排除但保留 mark。
- 驗證：production SQL 的 disposable SQLite／HTTP tests、TypeScript、production build 通過。UI 假帳戶驗證 invitation → request → accept、從朋友清單新增 unit、全計畫 sharing 保存／reload、移動到 2028 S2。原 backup／storage／import regressions 通過。全 30 個 Web checks、66 個 extension tests、TypeScript、SQL 與 production build 通過；Sites 64 發布成功並含 migrations 0002/0003。未操作真實帳戶，尚非雙人正式站或負載驗收。
- 下一步：在既有邀請制網站，兩位使用者各加同一學期同一科 → invitation/request/accept → 分享開關 → 核對朋友可見內容與 marks/WAM 私密；重新登入核對保存。之後才做 tutorial preferences／allocated 狀態、可靠 options 來源及精確 group ID；同一時間不等於同一 tutorial。官方 prerequisites／degree audit、聊天與陌生人探索未實作。M1／M2 驗收不因此完成。

<a id="ios-01"></a>
### IOS-01

**iPhone Stage 1 · 原生用途實驗** · P2 · **進行中** · 2026-11-01 使用者批准

- 決策：直接做 React Native／Expo 原生小實驗，不先重做 mobile web。Schedule → class／assessment details → 一個本機 preparation action，以及 read-only next-class Home Screen widget。先測每日用途；不承諾完整 iOS 產品。
- 範圍：`mobile/` 為獨立依賴／build；僅 synthetic sample，明確標示 sample／Sydney time／device-only。沒有登入、API、Canvas、真實學生資料、網站部署或 migration。原有 assessment steps 的「準備 ≠ 提交／成績」語意保留。
- 已寫：七日 agenda、空日、dated／week-only assessment、儲存／Undo／重新開啟本機準備紀錄、sample reset 確認、widget start/end timeline／empty state／class deep link。只抽出既有純 `sydneyInstant`，web reminders 繼續共用；未重組整個 repository。
- 驗證：mobile TypeScript、5 個 sample timeline／link／persistence／DST checks、iOS JS production bundle、web TypeScript／reminder regression／production build 已通過。Xcode 26.2 的 Release Simulator build 通過；實際 UI 已確認 Schedule、class／report details、空日、未定日期 quiz、refresh cancel／confirm、準備紀錄在關閉 app 後保留與 Undo，無需 Metro。
- Widget 實機試用：使用者回覆「yes it works」並提供 Home Screen 截圖，確認 sample widget 顯示課堂、時間及地點；使用者回報操作正常。這不代表 background refresh／跨日更新皆已驗證。
- Toolchain：本機用 Node 24、Expo SDK 55 配合 Xcode 26.2。SDK 58 需要較新 Xcode，曾在原生 framework compile 失敗；未 patch framework。SDK 55 的 widget module 為 alpha，公開版本前需重新評估。
- 2026-11-01 實機進度：使用者已連接 iPhone 16 Pro；paired／Developer Mode 已啟用。Release device build 通過並安裝 `Semester Preview 0.1.0`，`devicectl` 確認存在；app／widget provisioning 都保留同一 App Group。使用者已確認 app 可開啟並顯示 sample Schedule，後續回報 widget 正常並提供截圖。preparation 實機 persistence／Undo 與快速理解的用途驗收仍未完成。操作與 sample 試用路徑見 [mobile README](mobile/README.md)。
- 實機修正：SDK 55 widget plugin 即使關閉 push 仍加入 `aps-environment`，造成 personal team signing 失敗；local config plugin 僅移除未使用的 push entitlement，保留 App Group。重複 non-clean prebuild 另會產生重複 widget targets，已重新生成乾淨 native project；之後變更 native config 使用 clean prebuild。
- 離開條件：實際原生 app 可開、課堂／assessment 導覽正確、preparation 重開後保留、widget 顯示與點擊符合 sample、學生完成無教學短試用並回報 widget 是否有價值。Simulator 通過不代表實機或學生驗收。
- 第一輪使用者回饋：技術可行，但無法一眼理解今天、下一堂、assignment 到期、這週／下週及目前 teaching week。卡片佔位過大；next-class hero 與 agenda 重複同一課堂，deadline 被推到畫面下方。使用者認可第一階段成果，但 glanceability 尚未達標。
- 版本保留：使用者要求可比較／rollback；目前 sample 原型已 commit 為 `6f544ba` 並建立 local tag `ios-preview-v0.1.0`，包含 mobile source、lockfile、native config plugin 及 shared timezone helper。未 push／部署；可用獨立 worktree 重建基線，操作見 mobile README。
- 產品探索已依使用者偏好移至 Notion：[Semester — Mobile & widget ideas](https://app.notion.com/p/40bd6bfd790e81c1800cdf60f250174f)。User flows、Lock Screen／較大 widget、Today checklist 與預先提供有用內容均仍為 ideas；不在 Git 維護第二份探索筆記。
- 2026-11-02 使用者批准下一個 sample prototype，已實作 **0.2.0 (2)**：Home 的 this/next week 與待確認資訊、Today preparation checklist、Month 日期選取／返回、Assessments unit filter／sample grades、widget preview/setup。新增兩個 rectangular Lock Screen widgets（single/two deadlines）與 medium work overview；保留原 next-class widget 與 0.1.0 tag。沒有選出 winning widget、沒有 analytics/live grade feed。
- 0.2 驗證：TypeScript、9 個 model/timeline/month/DST checks、iOS JS export、Simulator／device Release builds 通過（各 0 errors／4 warnings）。Simulator 實際確認四個 tabs、month 日期→details→原選取日期、unknown-date quiz、unit filter／未發布 grade、widget preview 的列表目的地、prep full-close/reopen persistence 與 Undo。`devicectl` 已確認實機安裝 0.2.0 (2)。
- 0.2 待驗收：Simulator 可進 Lock Screen Add Widgets，但 CUA scroll/coordinate 操作返回 `noWindowsAvailable`，尚未完成實際 widget render/tap 驗證；已請使用者在實機試加 single/two deadlines。原生 readability、tap destination、background refresh／跨日，以及無教學 glanceability 試用仍待實測。Stage 2 hosting/native auth/live sync 尚未開始。
- 2026-11-02 widget follow-up：使用者確認 sample deadlines 有顯示，要求 customise widget content。**0.2.1 (3)** 已安裝；Widgets 可選多個 units、隱藏／顯示 titles、Save 後更新兩個 Lock Screen designs 與 Work overview，偏好共用於此 iPhone，非每個 widget 的 Edit Widget intent。TypeScript／13 tests／JS export／Simulator 與 device Release builds 通過；Simulator 驗證 save、空選取 guard、完整關閉重開 persistence，並讀取 App Group 確認三個 timeline 的 25 entries 都已套用 filter／title setting。仍待實機觀察 Save 後畫面 refresh 與 tap；Stage 2 未開始。

- 2026-11-02 follow-up: **0.3.0 (4)** personal tasks installed and preserved at `ios-preview-v0.3.0`; Today supports add/edit, Today/Tomorrow, optional unit, suggestion copy, completion/delete Undo and unfinished carryover. 18 tests, native builds and Simulator persistence/reset checks passed; phone task trial remains pending. User then authorised **Stage 2 investigation**. The local API contract check passed and exposed whole-document replacement risk; native Sites auth/token handoff remains unverified. See [technical evidence](mobile/feasibility/README.md). Next: resolve the supported native login/API environment and test one synthetic board plus a narrow preparation update. No live integration, hosting migration or Stage 1 acceptance claimed.

- 2026-11-02 connection trial: **0.3.1 (5)** installed and user-confirmed; Widgets → Test website connection compares native HEAD before/after the system browser and records whether the website opened. 21 tests, TypeScript, export and both Release builds passed. Direct observation of the existing Simulator session confirmed **website opened; native Before 401 / After 401**. Browser sign-in did not establish native API access in this trial; physical-phone statuses remain unreported. **Next: establish a supported native login path, then read one synthetic board, perform a narrow preparation update visible in a web test client, and feed a minimal dated snapshot to a widget.** If no supported current-host login path can be established, use an isolated shared auth/API experiment before choosing a production migration. Status-only checks are not token validation or live sync, and this result does not rule out every Sites route. See [trial instructions](mobile/README.md#try-the-website-connection) and [technical evidence](mobile/feasibility/README.md).

- 2026-11-02 independent cloud trial: **0.3.2 (6)** installed on Daniel's iPhone. Google → Supabase Auth → Workers → new D1 is configured in the isolated migration environment. Web saved task 1 at revision 2; Daniel's phone screenshot confirms native login, API identity and the same checked task. Daniel checked task 2 on the phone; web refresh independently confirmed revision 3 with both tasks checked. **Bidirectional synthetic-data updates passed with explicit refresh.** Phone restart/session renewal, real second-account checks, live conflict handling and cloud-widget snapshot remain pending. Existing Sites and production data remain unchanged. See [migration evidence](migration/README.md).

- 2026-11-02 cloud widget trial: **0.3.3 (7)** built, signature-verified and installed on the paired iPhone. New **Cloud deadline · Trial** supports rectangular Lock Screen and medium Home Screen layouts, syncing on app foreground and successful cloud requests. The account listener now survives closing the connection sheet. Private cache ownership, shared-data minimisation, sign-out/account-switch clearing, stale/expired timelines and failure handling are covered by 11 new tests (40 total pass), typecheck and JS export. Daniel confirmed the SOFT2412 deadline and Synced time appeared on his iPhone Lock Screen and tapping the widget opened the cloud connection sheet. Sign-out redraw remains pending. Main tabs/personal tasks remain local and no production records have been imported.

- 0.3.5 (9) · Imported Assessments uses the authenticated account's restore point with the web grade rules and unit filters for dated work, grades and 日期待確認. Authenticated staging readback, source comparisons, signature verification and device installation/launch passed. For the proposed rollout, dependencies and device acceptance, see the [mobile roadmap in Notion](https://app.notion.com/p/40bd6bfd790e81c1800cdf60f250174f).

### REMIND-01

**Apple Calendar 式多提醒 → Chrome 系統通知** · P1 · **待驗證** · 使用者明確批准的增量

- 2026-11-02／0.21.0：依提醒時間回饋，新增作業「前日 18:00／當日 09:00／24 小時前／無」與「1／2／3／6 小時前／無」兩列選項；新設定預設前日 18:00＋2 小時前，舊設定連通知文字也維持原樣，明確 Save 才採用新版選項。太接近的同一時程提醒合併、早於 09:00 的 deadline 改前晚準備、首次晚啟用僅在安靜時段外且截止前補一次；不推測未知時間。Synthetic 計算、Cancel、重載、失敗／重試、完成／恢復與 controller Undo regression 已測。下一步：refresh → Reminders → Upcoming deadlines 選時間，先核對預覽再 Save；實機送達、聲音及使用者接受度仍待驗證，沒有替使用者改真實設定。

- 2026-11-02／0.19.0：使用者批准三類自動提醒：截止前、已排好的 quiz／activity、已知本週但日期待確認。上方 Reminders 一次開啟（預設 off），支援單筆關閉、自訂優先、完成停送、quiet hours 與同時刻合併；不猜 available-until 截止或可選 attempt。Synthetic 取消、儲存失敗／重試、單筆關閉／reload、自訂優先及 controller 完成／Undo 已測。下一步：使用者 refresh → Reminders 開啟並保存 → 核對 Upcoming notifications，再自行選測試項目實機驗收；本次未改真實資料。已知限制：新加入的週次待定項若已過週一提醒時間，不追補當週通知；仍會在 Week／Month 的待確認區出現。聲音、Chrome 關閉時送達、native Snooze 和跨裝置即時同步未承諾。

- 2026-11-01／0.17.0：依 Apple／Google Calendar 參考，提醒改為 Alert · None 直接選、每筆緊湊列／移除／新增；裝置狀態常駐、說明預設收起。當日使用者已回報看到測試橫幅並提供通知中心截圖；**聲音及關分頁後的定時通知仍未驗證**。本次 synthetic 測過取消不寫入、兩種時間方式、預覽跟隨、增刪／自訂提醒與儲存重載；發布狀態見 PROGRESS。

- 2026-11-01：使用者選擇設定留在 Semester、Connect 發系統通知、Chrome 必須運行；不使用 n8n、不做 Apple Calendar 匯出／同步，也不擴大到分類或歷史紀錄。
- 已實作 Web 0.16.0／Connect 0.5.0：每個 dated assessment step／personal task/event 最多五個提醒、準確 Sydney 時刻、取消不改排程、保存失敗保留舊排程、完成／刪除撤銷未來提醒；日期改動與 Undo 重建未來排程。週次未定日期不猜時間；提醒設定沿用帳戶／backup／refresh／conflict 保護。
- 已發布 Sites 60；25 個 Web regression scripts、TypeScript、SQL、66 個 extension tests、production build 與 synthetic UI 通過，發布證據見 PROGRESS。**未代表已驗證使用者電腦真正收到通知。** T11 四科試用與 M1/M2 gates 不因此完成。
- 下一步：使用者更新 unpacked Connect 0.5.0、Reload、在同一 Chrome profile 開 Semester → Desktop reminders 明確授權 → Send test notification；用自己選的測試項目設定近時提醒，關 Semester 分頁但不退出 Chrome，核對一次通知／點回正確項目／修改時間／取消與重啟。其他電腦修改需重新開 Semester 才更新本機；Sleep/Focus 不保證準點。

### CONNECT-01

- 2026-10-31／0.15.1：依新 quiz 試用問題，分開「待設定結果／可匯入更新／需檢查設定」。新 attempt 只建議同科同 quiz 編號、不猜最高分規則；直接開單筆設定。舊 attempt 的群組警告合併成每份 assessment 一組，列真正權重／drop-rule 前後差異；群組改名不再誤報。確認保留原計分後只更新該來源基準，Import 數量、Cancel、Undo 與合計同步。24 個 pure checks、TypeScript、SQL 及假資料實際 UI 操作通過；**已發布 Sites 59、待使用者驗收**，未碰真實資料。發布憑據見 PROGRESS。

- 0.14.6 已發布（Sites 57）：依回饋將其他項目分成「已連結・無更新／尚未連結／手動紀錄保留」；藍點可點選已讀，開作業詳情也標已讀。Synthetic 已驗證重載、再次更新、取消、Undo 與不改成績／日期／完成狀態。下一步請使用者確認分類與提示是否直覺；不視為整體 T11 驗收完成。

**Canvas 四科 → 核對 → 配對匯入** · P0 · **待驗證** · Now

- 2026-10-30 日常增量：補上共同 Canvas planner 的 8 科上限，避免預覽接受第 9 科、Import 後才被保存 API 拒絕。整批累計檢查，超額不產生部分匯入；已存在科目的成績仍可處理。新增 synthetic 紅／綠測試，驗證第 8／9 科、同科多項、整批超額、備份、確認與 JSON/direct 一致；23 個 Web regression scripts、TypeScript 與 SQL storage 通過。**已實作、未發布、未做真實使用者驗收**；保留 T11 的 Chrome reload → 四科檢查 → 僅預覽續接點，未改 extension 或真實資料。

- 0.14.5：使用者肯定更新／合計呈現，要求單筆設定再縮小。已將結果類型／計算並排、縮短標籤與留白，synthetic 296px 高；取消／Undo／規則保護通過。下一步只驗收緊湊版是否容易操作，不重新擴大配對或計分範圍。

- 0.14.4：每筆先顯示更新前後，父作業合計由整批 preview 計算一次，標出增加／不變與單位。Complete 不當數字成績；規則／配對依據／手動保護 no-op 收起。取消改動與 Undo 合計回復已加 synthetic 測試。下一個驗收：一眼分辨這次哪筆更新、合計變多少，而非閱讀技術說明；未操作真實匯入。發布證據見 PROGRESS。

- 0.14.3 已實作／synthetic 通過：Complete 與數字更新同列，Import 依 planner 真正變更計數；僅新增連結分開標示，略過仍可 Undo。單筆設定不重複下拉／比較，按鈕改為 Cancel changes。下一個使用者驗收：四科預覽的可見更新與 Import 數量一致，取消修改／Undo 是否順手；不代使用者確認匯入。發布證據見 PROGRESS。

- 0.14.2 已發布（Sites v53）：依本次回饋，prepared 卡片中的「Only part of an assessment?」只展開當前項目，保留作業選擇；取消不改配對、stage 後可 Undo，編輯未完成不能 Import。Review 優先實際變更、收起全批選取總數。下一個試用：同一筆點開 → 取消／選規則 → Undo，是否不再迷失到整科清單；synthetic 通過不等同使用者驗收，完整證據見 PROGRESS。

- 2026-10-27 使用者／朋友回報：首次使用呈現 50+ 配對項目，看不到立即可用的成果。先前 returning-user UI 不足以處理此問題。
- 0.14.0 已實作：JSON/direct 共用 prepared preview；預填有依據的暫定配對並可改／Skip／Undo，未找到相似對象的已公布數字成績可準備新增作業；缺少單一且同學期課程時新增 raw-results unit。預設不把未出分清單當待辦；普通匯入按一次 Import，已確認特殊規則仍重用，未知規則不猜。成功後直接打開 Show grades。
- 證據：新增 64 項／4 已出分與 64 已出分自動建議 synthetic cases，JSON parity、ID 重用、重複零變更、備份／refresh 保留課程、手動日期／分數／清空保護、browser Import／改錯／撤回／取消／新批次／stale guard。未匯入真實資料。
- 下一個驗收：朋友以沒有 canvasImports 的 board 開啟新預覽，是否先看到可用成績，而非配對工作；修改一個建議並 Undo、取消零保存。只有使用者自己決定 Import 才保存。未解規則不阻擋其他可用成績；既有手動子項目／錯配修復仍未交付。

- 已做：Connect 0.2.2 修正舊 API `muted` 誤擋已公布分數、支援 Complete/Incomplete 文字結果並檢查版本一致；Web 0.4.0 重用配對、顯示來源分數差異並保護手動內容。文字結果目前不轉成網站數字成績。
- 前期證據：34 Node tests、81 真實 DOMParser synthetic 斷言與匯入保護測試通過。使用者已 reload 並提供新版四科匯出，數字／文字結果與先前 Canvas 可見資料一致，格式驗證通過。工具仍無法操作 extension URL；真實保存與重複匯入進度見最新驗收。
- 已補：Web 0.5.0 的配對／確認兩步流程、相似名稱候選、原有成績對照、重考群組防平均、明確選計算方式及審核失效保護；Connect 0.2.3 修正有 posted_at 卻沒有結果的標記。
- 前期紀錄：先匯入 17 筆使用者授權配對，保存後 reload 核對通過，沒有新增 assessment；當時特殊重考／prework 尚未匯入，後續結果見下方。
- Web 0.7.0：已接上明確選取來源的 highest／completion 規則匯入，首次 Stage → Review → Confirm，後續以來源 ID 重用配對。規則不自動猜測；Complete 只依確認的完成制轉換，未知不算零。
- 最新驗收（2026-10-23 記錄）：使用者已確認 13 筆特殊規則匯入；Saved 後 reload 核對規則與未確認結果通過。同檔預覽自動重用全部 30 筆配對，0 項變更、0 新增，確認按鈕停用；手動未交判定保留。
- 最新來源預覽：已在登入網站核對單科來源更新，確認新分數會進既有配對、手動判定保護、新來源項目仍 Skip；沒有按確認。新四科整體回測與保存仍待使用者驗收，不將單科預覽視為全部完成。
- 2026-10-26 / Web 0.11.0：將重複的群組／規則／逐項表單改成「Canvas 群組 → 多份獨立 Semester 作業」左右對照；顯示權重、已連結／這次略過／待配對狀態，勾選來源後才展開個別結果規則。保留原 matcher、JSON、手動保護及逐項分數；synthetic 回歸與零寫入 UI 測試通過。使用者故事／驗收見 [matching stories](docs/CANVAS-MATCHING-USER-STORIES.md)。
- 明確續接：既有手動子項目精確連結、誤配 overall → child 修復、保留 incoming 與 manual 雙值並明確接受差異尚未實作。先設計 provenance／衝突／重載驗收，不自動搬移已儲存配對，也不套用另一科的 best-N 規則。
- 0.12.0 改進：日常更新不以未出分 backlog 當待辦；已出結果未連結才提示選目的地。管理連結一次一科、Canvas 緊湊列、先選作業與權重再選總成績／個別紀錄，沿用已確認規則；選取留在原列可撤回。補手動延長截止日不被 Canvas 成績更新還原的 JSON／direct 回歸。
- 0.13.0／T11 下一個試用：在更新摘要直接選一筆結果的作業，檢查名稱／權重／前後分數，Add to review → Undo／Review → Back，取消不存。檢查新批次通知不會替換目前草稿；Check all 的每科時間可展開。既有手動子項目連結與舊錯誤整份連結修復仍待模型增量，不應用重複新增繞過。
- 下一步：先完成下方 CONNECT-02 的正式 Chrome 授權／reload → pending review 回測；JSON 仍可測相同規則。先預覽、不確認真實匯入，不先全部選新增。
- 驗收：四科成功或明確報錯；可見已公布分數吻合；隱藏不是零；配對無歧義；確認後才保存；手動資料不變；重複匯入不重複新增。
- 證據：初版實作 `0374e9c`、規則匯入 `d4af3a8`；synthetic reader/import QA；真實保存／重載及同檔零變更預覽通過，最新來源更新待驗收。

#### Canvas → Semester 同步順序（2026-10-22 使用者確認）

這是已決定的演進順序，不代表後續階段已實作或已授權寫入真實資料。

| 順序 | 交付範圍 | 進入下一階段前要確認 |
| --- | --- | --- |
| **1 · 現在／CONNECT-01** | JSON → 配對與規則預覽 → 使用者確認匯入。首次確認目標作業與規則後，以 Canvas 帳戶／課程／作業 ID 記住配對。 | 特殊規則確認、保存／重載和同檔零變更已核對；T02 最新來源更新仍待驗收，未考／未公布不算零。 |
| **2 · 已實作待驗證／CONNECT-02** | 明確啟用後，開啟／reload 已選 Canvas 課程時檢查該科，直接傳到同一 Chrome profile 的 Semester「待確認更新」。 | 本機 synthetic 驗證通過；先部署、reload extension、使用者授權，再測四科真實傳送。只預覽，不自動確認。 |
| **3 · 穩定後／CONNECT-02** | 使用者可選擇自動更新已確認配對且沒有手動衝突的成績。 | 新作業、規則變動、不確定配對及衝突仍需確認；前兩階段驗證穩定後才開啟。 |

- 全程為 **Canvas → Semester 單向同步**，不回寫 Canvas；保留手動資料與手動清空，不以來源資料靜默覆蓋。
- 未考、未公布、隱藏或缺項不推定為 0；明確確認未交且規則要求零分才記 0。
- 登入失效時提示重新登入；不承諾關閉瀏覽器後仍持續同步。
- 保留 JSON 匯出／匯入作為測試與備用途徑；未來直接同步共用配對、規則計算、差異預覽和確認流程，避免兩條路徑行為分歧。
- 續接點：階段 1 的保存／重載、同檔零變更與單科最新來源預覽已核對；階段 2 已實作，下面接真實 Chrome 回測；階段 3 未開始。

### CONNECT-02

- 2026-10-31／0.15.1：Semester 到達／回到頁面時，若已授權且批次過期／不完整，透過既有 bridge 檢查全科一次；不輪詢、不自動保存、不替換開著的預覽。首頁顯示最舊讀取時間、失敗原因與待檢查設定數。假 bridge 驗證初次／返回、重複訊息不重查、預覽抑制、失敗可見；**不是實機 T11 通過**。仍需同一 Chrome profile 開著一個已登入 Canvas 課程頁；未修改未提交的 extension，也不宣稱 dashboard-only 支援。

**Reload → 待確認更新** · P0 · **待驗證** · Now

- 2026-10-27／Web 0.14.1：使用者要求 Connect 沒連上也保留入口與連接步驟，Manage 不再整頁攤開。已實作固定精簡狀態列、展開說明／Retry／JSON、收起課表／備份／舊學期；synthetic 畫面與保護回歸通過，Sites 52 已發布。未動真實資料、未更動 extension 連接授權。下一步：使用者重讀課程後回到網站，入口仍可找到且能自行重新連接；不把本機模擬當實機驗收。

- 已做：Web 0.8.0 分清新結果、未配對、手動資料保護、規則需核對；Connect 0.3.0 加入固定兩站 optional permission、選科/account 綁定、單科 reload checks、session pending preview、固定站點 bridge。JSON 入口保留。
- 邊界：每科每分鐘最多一次，只在選定課程頁完整載入時檢查，沒有 timer polling。權限撤回／關閉／帳戶錯誤清理 preview；登入失效與失敗有提示。未配對不新增，未知不是零，絕不自動確認或回寫 Canvas。
- 證據：reader／mocked lifecycle/security tests、TypeScript、web regression、production build；synthetic web UI 驗證 JSON 和 pending banner 共用 preview、並行更新不替換已開預覽、stale review 停用、取消零寫入、只確認一項假成績時手動值／清空保留。
- 新增：Web 0.9.0 / Connect 0.4.0 的 **Check all N courses** 只讀已授權科目，單一 Canvas 分頁即可；一次全部成功才提供預覽。日常更新預設摘要，未變更項目收起；未配對可明確沿用既有規則，未知仍不是零。
- Web 0.9.0 已發布（Sites v46 / `dd534e4`）。下一步／T11：Chrome reload Connect 0.4.0、關舊 preview 並 reload Semester → 確認已授權四科 → **同一 Chrome profile** 保持一個登入的 Canvas 課程頁 → Check all 4 courses → 核對四科讀取時間、成績及手動保護，暫不確認真實匯入。前版單科傳送已觀察到，不等於四科批次驗收。
- 待核對：真實 Chrome 事件/權限/worker 重啟、四科逐項結果與失敗提示、關閉檢查後不再讀取。工具限制仍不允許操控 extension URL；mock 測試不是實機驗收。
- 2026-10-26 使用者截圖已見四科待確認批次，但配對清單過長且選取後消失。Web 0.10.0 改為真正成績變更優先、待配對／保護收起、選取保留與 Undo、已確認匯入紀錄、成績未讀提示及跳至該科成績。紀錄只在確認時保存，非自動匯入；不回填歷史。已發布 Sites v47（`d3fad54`），自動化與假資料 UI 測試通過，實機使用者驗收待完成。
- 下一步／T11 補充：先預覽真實批次，確認沒有變更時不要求處理所有未配對；選一筆後可見、撤回、取消。只有使用者之後明確確認的匯入才測 Saved → reload → history／New 小點 → 點開清除，小點消失後紀錄仍可回看。保留手動值及 JSON；本輪不替使用者確認匯入。

### FLOW-01

- 2026-11-01 / Web 0.18.0 candidate: retake 的 **Attempts & schedule** 共用一筆 attempt 身分；日期／時間或週次＋課堂、提醒、成績放同張卡。Semester W13、Week 與 Month 投影同一排程；原有 schedule 必須明確選擇沿用，不按名稱／順序猜配對。合計仍只計 parent 權重一次。Synthetic 取消、保存、Undo、reload 與三 view 已實際操作；使用者回測待完成。發布收據見 PROGRESS。

- 2026-11-01／0.17.0：作業編輯新增明顯 Date & time／Week & class 切換；Week 13＋Tutorial 從本人的課表帶入日期／開始／結束，多堂需選、缺課表只保留週次。保存不把課堂時段轉回 deadline；跨分頁時程整組處理衝突。假資料核對取消、保存／重載、缺課與多堂、提醒換算及手動成績／筆記保留。下一步：使用者確認編輯入口與兩種選擇是否直覺；不宣稱整體 T03／FLOW-01 已驗收。發布證據見 PROGRESS。

**作業新增／編輯／回到原位置** · P1 · **待驗證** · Next

- 2026-10-28／0.15.0：依朋友試用回饋，只處理三項已批准的日曆改善：只有週次的作業直接列在 Week／Month 對應週；頂部獨立切換作業／課堂／個人安排；Keep visible 勾選留在原位並可 Undo。Set date 開既有編輯器，取消不保存，不猜日期。歷史紀錄、個人分類擴展及外部日曆同步延後。
- 開發驗證：八種分類組合、休假／跨月週、課堂 quiz 保留、擁擠日期位置穩定、偏好 migration；假資料完整 board 測取消、完成／Undo、切換／重載、側欄與 1280／1024 畫面。未接觸真實資料。發布證據見 PROGRESS；下一步請使用者只看待交作業，檢查 Week 11 未定日期是否一眼可見、勾選後是否不再以為消失。仍非 T03 全部驗收。
- 已做：Task / Event / Assessment 分流、步驟預設、parent 編輯、追加提交截止、活動週與 due 分開、緊湊 assessment table。
- 停在哪：舊回饋促成多次修正；缺少修正後一份真實作業從頭走完的結論。
- 下一步：T03，以一份有 demo 和 submission 的作業試用，不強迫所有作業拆 steps。
- 驗收：新增後仍能找到編輯／due；日期語意清楚；不同 view 是同一筆資料；取消不儲存；更新後可返回並續接。個人 event/task 不混進正式考核總表。
- 證據：歷史實作／synthetic QA 見 archive；**使用者完整重測：待記錄**。

#### FLOW-01-F1 · 手動新增 assessment 無法刪除

- 2026-10-20 使用者回報；P1，Web 0.4.1 **已修、待使用者驗證**。
- 原因：個人 Task/Event 有刪除入口，但 assessment detail/edit 沒有；`manual` 也可能代表匯入資料被編輯，不能單靠該旗標放行。
- 已修：僅手動建立的 assessment root 可刪；確認範圍包含其 steps、grades、completion；提供立即 Undo、過期確認／衝突保護。保留 Canvas ledger 防止舊匯入復活。
- 開發驗證：新增 deletion regression；全 web regression、storage 與 TypeScript；隔離假資料的完整 board UI 驗證入口、取消、刪除、Undo 還原分數／勾選、group 範圍與來源保護。未刪真實資料。
- 下一步：T09，使用者以一份可丟棄的手動 assignment 測刪除／Undo。這不代表 FLOW-01 其他編輯流程已驗收。

### PREP-01

**準備缺口 → Subject → 更新學習紀錄** · P1 · **待驗證** · Next

- 已做：準備提示連到 scope-linked lectures，Subject 提供 Up next、Learning record、Assessments & requirements。
- 停在哪：不能把「這些畫面存在」當成「使用者知道該補什麼」。
- 下一步：T04，從快到的 Quiz 出發，不提示點擊路徑；先確認範圍而非猜範圍。
- 驗收：能找到缺口、辨別未知資料、更新一項並返回；相同學習紀錄在其他 view 一致。
- 證據：Subject regression 與歷史本機互動檢查；**真實 Quiz 試用：待記錄**。

### PLAN-01

**這份作業，我現在要做哪一步？** · P1 · **暫放／待收斂** · Next after flow feedback

- 已有基礎：notes、planned start、正式 assessment steps、personal tasks；不等於已完成輕量 Planning。
- 為什麼暫放：先驗證現有新增／準備流程，避免再建一套重複待辦。
- 下一步：T05，觀察一份真實作業的個人下一步要記在哪、如何安排到這週；只補觀察到的缺口。
- 驗收：可留下具體行動、日後找回並更新；計畫日期不改官方 due；個人準備不憑空增加考核權重。
- 證據：產品方向已討論；**具體方案、實作與試用尚未完整確認**。

### GRADE-01

- 0.18.0 的整合範圍為 highest-attempt retakes；普通加總 parts／週週提交保留既有功能。本輪沒有把所有 item 類型強行合併。既有 Canvas source ID 可延續更新；尚無 source ID 的已排程 attempt 不會按位置自動接入新結果，後續配對 UX 仍需補齊。使用者下一步：Quiz → Attempts & schedule → Attempt 2 選 W13 tutorial（有既有 Part 2 時明確沿用），核對三 view，先 Cancel，再自行決定是否保存。

**個別成績 → 合計 → 單科目標** · P1 · **待驗證** · Next

- 已做：overall / individual grades、recurring/parts 合計、Show grades 與 Hide recurring 控制、單科統計及有條件的目標估算。
- 停在哪：成績已不是「以後才做」；目前要驗證輸入與理解。Connect group 計算仍需明確確認，不能猜 drop rules。
- Web 0.6.0 已加：現有作業內的 highest attempt、binary best-N，次數／取幾次／完成分數可設定；門檻獨立檢查。未知不當零、原始成績保留、partial completion 不混入目前平均。開發回歸與隔離 UI 測試通過，尚待使用者 T10；未代填真實 ELEC 資料。
- 下一步：T06，用 synthetic 範例先驗證邏輯，再自願核對真實資料。
- 驗收：不用手算每 part 總分；分母／權重／缺成績清楚；不重複計入 parent/child；篩選不改整科統計；hurdle 不因估算達標而自動通過。
- 證據：grades / grade-parts regression；**使用者理解及完整試用：待記錄**。

### DATA-01

**保存、刷新、備份還原的信任** · P0 · **待驗證** · M1 gate

- 2026-10-29 日常增量：修正兩分頁修改同一 activity 時，逐欄合併會產生無效「週次＋時間／多日區間＋時間」且未提示衝突的問題。活動時間改為整組衝突選擇，其他筆記／完成狀態仍可合併；截止日與成績不變。新增 synthetic 失敗重現與 local／remote、清空、相同修改、備份回讀測試；22 個 Web regression scripts、TypeScript 與 SQL storage 通過。**已實作、未發布、未做真實使用者驗收**；沒有新增週次＋課堂 UI，也未觸碰真實資料。下次發布可帶入，T07 仍以隔離資料確認跨分頁保存。
- 已做：account-scoped D1、保存狀態、refresh 保留、backup review/restore、前一 board recovery、舊 client／競爭寫入保護。
- 停在哪：歷史開發檢查已做；目前版本的完整使用者回歸結論未記錄。這不是已知資料遺失的宣告。
- 下一步：T07，在隔離測試帳戶／本機 synthetic board 驗證；不要直接替換真實 board 來測試。
- 驗收：Saved 後 reload 保留；refresh 不抹手動內容；還原前可看差異；不同帳戶／board 不混合。
- 證據：backup/storage/sync regression、歷史本機互動檢查；**當前端到端試用：待記錄**。

<a id="test-queue"></a>
## 等你測的佇列

目前全部是「待驗證／待安排」，不是要求一次做完。先 T01，無誤再 T02；其餘逐次挑一個情境。

| ID / 工作 | 起點與任務 | 特別觀察 | 狀態 |
| --- | --- | --- | --- |
| **T01 / CONNECT-01** | Reload Connect 0.2.2 → 讀四科 → 逐科與 Canvas 比對名稱、due、已公布分數及 Complete 結果 | 漏項／漏分？單科失敗有無明確原因？不要以總數相同代替逐項核對 | 新版真實匯出成績核對通過；日期／特殊規則仍待確認 |
| **T02 / CONNECT-01** | 私人 JSON → app 配對預覽 → 使用者確認 → Saved → 再匯同檔 | 手動資料被保留？來源更新可辨認？無重複？先備份；可先用 synthetic board | 17＋13 筆已保存並 reload 核對；同檔 30 筆重用配對、0 變更通過。下一步只預覽最新來源更新，不確認匯入 |
| **T03 / FLOW-01** | Assessment → 新增／編輯 demo＋submission → Week/Month → 返回修改 | due 在哪？parent/step 編輯清楚嗎？活動範圍與提交日期混淆嗎？不必猜示範日期寫入真實資料 | 待驗證 |
| **T04 / PREP-01** | Week 的一個 Quiz → 範圍 → 未記錄 lecture → 更新 → 返回 | 不知道點哪？未知是否被當成未完成？返回丟位置嗎？ | 待驗證 |
| **T05 / PLAN-01** | 選一份真實作業 → 記「現在要做的下一步」→ 安排本週 → 隔天找回 | 要去別的 app 才記得住嗎？被迫建立正式 assessment step 嗎？ | 待觀察／方案未定 |
| **T06 / GRADE-01** | 單科 Show grades → 14/20、權重 10% → 再測 recurring/parts 與一筆空白 | 能理解 70% 和總評貢獻 7 分的差別？空白不是零？隱藏 recurring 不改統計？ | 待驗證 |
| **T07 / DATA-01** | 隔離 board 編輯 → Saved/reload → refresh → backup/restore → 切換帳戶 | 保護手動值／清空、還原差異、身份隔離；不拿正式資料冒險 | 待安排 |
| **T08 / M2** | 新使用者自行設定自己的學期，完成找作業／更新，再使用一週 | 哪裡需要開發者解說？下次打開能續接嗎？不用抄錄私人對話 | 待 M1 核心問題解除 |
| **T09 / FLOW-01-F1** | Web 0.4.1 → 開一份可丟棄的手動 assessment → Delete assessment → 取消，再確認 → Undo | 入口可見？取消不改資料？group 提示範圍？Undo 還原？確認 Saved 後才 reload；Undo 本身不跨 reload 保留 | 已通過 synthetic QA；待你回測 |
| **T10 / GRADE-01** | Show grades → 現有 Quiz 的 Individual grades / rules → 最高分與門檻；再測 10 次 prework 取最佳 8 | 未考不是 0？完成／未交／未確認容易分辨？2/4 secured 和平均分不同？Apply count、取消、保存重開是否清楚？ | Web 0.6.0 開發測試通過；待使用者試用。先手動確認，不自動匯入特殊規則 |
| **T11 / CONNECT-02** | Web 0.15.1、安裝／reload Connect 0.4.4 → 核對授權選課 → 同一 Chrome 只留登入的 Canvas 首頁 → 回 Semester／Check all → pending preview | 各科讀取時間與結果正確；建議可修改、未知規則不猜；Cancel／Undo 不保存；手動值保留；失敗不提供半批；單科 reload／JSON 仍可用 | 2026-10-31 假資料回測通過；首次安裝權限／worker 實機與四科傳送仍待驗證，先取消不匯入真實資料 |

### 每次測完只補這張紀錄

```text
測試 ID / 日期 / Web 與 Connect 版本：
測試者：自己／新使用者（不記私人身分資料）
測到哪一步：
結果：通過／部分完成／發現問題／未測
預期 vs 實際：
卡住／需要提示的地方：
關聯修正 ID（例如 FLOW-01-F1）：
下次從哪一步繼續：
重測結果：
```

未測完就保留原 ID；發現問題將對應工作卡改為「待修正」，記下可重現步驟與驗收。修完後回到同一測試，不因新版本發布而清掉。Repository 只放去識別化結果；成績、匯出與私人截圖留在私人儲存並自行備份。

<a id="later-ideas"></a>
## Later / Ideas — 不混成現在要交付的功能

| ID | 方向 | 分類／何時重新討論 |
| --- | --- | --- |
| CONNECT-03 | 可選自動保存已確認配對且沒有手動衝突的成績 | Later；目前 CONNECT-02 只送待確認預覽。T11 穩定後再討論，沒有授權自動保存。 |
| DIST-01 | Chrome Web Store 發行與自動更新 | Later；先完成讀取驗收、安全／隱私與發行準備，目前仍 unpacked。 |
| IOS-01 | 原生 iOS app | Stage 1 sample-only 實驗已獲批准，見上方工作卡；live sync／public app 仍未承諾。不做手機 web 專項重設計。 |
| SOCIAL-01 | Friends／course planning | 本機第一個 slice 與使用者確認的全朋友或不分享規則，見 [工作卡](#social-01)；tutorial coordination／陌生人探索留待後續。 |
| PLATFORM-01 | 帳戶／後端與資料平台演進 | Idea／需求待釐清；已有 sign-in + D1，不預設必須重建或遷移。由 iOS、分享、可攜性需求決定。 |
| EXPLORE-01 | 獨立 Today、大型 Dashboard、廣泛跨校／PDF/Ed 匯入 | 暫不投入；先說明現有 view 的具體缺口，再評估價值。 |

不把個人成績、學生資料或私人商業筆記寫進這份表。未來若改用 Issues/Projects 管任務，應遷移狀態來源而不是同時維護兩套。

## 已實作基礎，不再重開相同開發項目

Semester / Month / Week、Subject 與準備提示、Assessment inventory、編輯與多步驟、活動時間、成績、備份還原、Canvas reviewed import 都已有實作。**仍需驗證的項目已掛在上面的工作卡，不在這裡重複列待辦。**

版本變更見 [Web changelog](CHANGELOG.md) 和 [Connect changelog](extensions/semester-connect/CHANGELOG.md)；較早背景見 [archive](docs/archive/IMPLEMENTATION-2026-10-20.md)。
