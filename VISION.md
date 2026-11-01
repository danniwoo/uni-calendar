# Vision / 產品方向

## 為誰、解決什麼？

Semester 幫助大學生把分散的課表、考核、準備進度與成績放回同一個學期脈絡。第一個驗證對象是使用 USYD 課表與 Canvas、通常同時修幾科的學生。

我們想讓使用者從 **「什麼時候有什麼」走到「這份作業，我現在要做哪一步」**，減少搬資料、來回找資訊與重新理解進度的負擔。不是只把 Canvas 換一個外觀，也不是重建一套無所不包的 Notion。

## 使用者主線

**帶入資料 → 看懂安排 → 找出缺口 → 決定下一步 → 執行與更新 → 回顧結果**

| 階段 | 使用者要回答的問題 |
| --- | --- |
| 帶入資料 | 課程、作業和成績都在嗎？來源可信嗎？ |
| 看懂安排 | 什麼時候有什麼？哪些日期仍未確定？ |
| 找出缺口 | 這份作業／Quiz 還需要準備什麼？ |
| 決定下一步 | 我現在具體先做哪件事？ |
| 執行與更新 | 做完怎麼記錄？明天怎麼接著做？ |
| 回顧結果 | 我這科進度如何？成績和目標差多少？ |

這是評估體驗的主線，不是「全部已完成」的宣告。各階段成熟度、缺口與測試在 [ROADMAP](ROADMAP.md)。

## 各 view 的分工

| 介面 | 主要問題 | 使用時機與界線 |
| --- | --- | --- |
| Semester | 每週、每科有哪些重要事情？ | 看整學期分布與跨科安排；不塞入所有私人 tasks/events。 |
| Week / Month | 事情在哪一天？和課程／其他行程怎麼排？ | 近期安排、截止與時間衝突；不是成績資料庫。 |
| Subject → Up next / Learning record | 這科跟到哪？近期考核需要補哪些內容？ | 單科準備與學習記錄；未知範圍不等於沒準備。 |
| Subject → Assessments & requirements | 這科有哪些考核、規則和權重？ | 查單科要求與來源，沿用相同 assessment 記錄。 |
| Assessments → Overview | 所有作業有哪些？要盤點／更新哪一份？ | 緊湊、排序、篩選、編輯與填成績；預設不展開所有細節。 |
| Assessments → Steps & schedule | 一份考核有哪些步驟？下一個排程是什麼？ | 檢查子步驟與日期；與 Overview 共用資料，不另造待辦。 |
| Grades（Assessments 內） | 已記錄的成績如何？目標還需要多少？ | 單科才顯示統計／目標；與完成勾選分開，不等於官方成績單。 |
| Semester Connect | Canvas 有哪些可確認的來源資料？ | 讀取、比對、匯出給 app 審核；不是另一套 planner。 |

同一資料可以出現在不同視角；不代表重複儲存或重複計分。新增頁面前，先確認現有 view 為什麼無法完成該任務。

<a id="mobile-user-flows"></a>

## Mobile user flows / iPhone design exploration

2026-11-01: user wants to start with student situations and information needs before choosing a layout. These are design hypotheses for the next sample prototype, not implemented features or validated research. The current sample app is preserved as `ios-preview-v0.1.0`. Delivery status remains in ROADMAP → IOS-01.

The central mobile need is **understand the academic picture quickly, then inspect or act without losing context**. A deadline list alone does not show coverage across units or future weeks; a dense matrix alone may make today's exact obligations harder to read. Compare both against the same flows. Do not fix tabs or remove class access before this comparison.

| Student situation | Information needed immediately | Flow and useful outcome |
| --- | --- | --- |
| First opening / returning after setup | Which semester and units are included; where data came from; what is missing or stale | Check coverage → resolve or acknowledge missing information → see a populated overview. Existing users should not recreate their web board on the phone. Live onboarding/sync belongs to later integration; use explicit sample coverage now. |
| Brief check between activities | Current date and teaching week; overdue items, today's deadlines/events and chosen preparation; any unresolved dates | Open app/widget → understand today's obligations and nearby deadlines → optionally inspect one item. No assumption that unrecorded work is unfinished. |
| Weekly planning / checking the bigger picture | All included units, this week and coming weeks, exact dated items versus known-week/unknown-date work, concentration of deadlines | Move across weeks → notice a cluster or uncertainty → inspect an assessment → return to the same week/filter. Counts measure events/deadlines, not effort. |
| Choosing what to work on tonight | Upcoming due dates, requirements, known preparation scope, recorded progress and the student's chosen next action | Inspect relevant work → choose or write one preparation action → keep it linked to its assessment. Do not force a task breakdown, infer work hours, or automatically equate weight/urgency with priority. |
| Checking one assignment or quiz | Unit, exact due date/time, activity time, requirements/weight, source link, scope and unknowns | Open from any overview → read enough to act → inspect original source if needed → return with overview context preserved. Keep exam/demo time separate from submission deadline. |
| Finishing a small piece of work | The specific preparation action, current state and whether the change was saved | Record → clear save feedback → Undo if needed → later resume consistently. Preparation completion is not submission, grade, or verified learning. Current preview saves locally; cross-device sync is a later dependency. |
| Checking progress within one unit | Related assessments, upcoming milestones, known learning scope and records; optional grades/targets | Narrow to unit → connect preparation to assessment → return to cross-unit view. Missing records do not establish that material was not studied. |
| Returning after information changes / while offline | Freshness, known changes/conflicts, pending saves, missing source coverage | See a compact trust/status cue → inspect changes or retry → retain unsaved work and honest last-known information. Live change detection is future work, not a current guarantee. |

Information should have three levels:

- **At a glance:** date/teaching week, active range, all-unit coverage, today's/overdue obligations, upcoming deadline distribution and visible unknowns. Prioritize a few answers, not every field at once.
- **One tap:** exact times, assessment requirements/source, preparation scope, progress and quick actions.
- **Deeper inspection:** full semester/unit records, grading rules, imports and complex editing. Phone access may still be useful; the web can remain the more comfortable place for lengthy setup.

Classes remain available as supporting context. Students who already use Apple/Google Calendar may gain more from academic work coverage than a large next-class card; do not assume this is true for every student. The widget's next job is also open: next deadline, a chosen action or a compact workload summary may be more useful than the baseline class widget.

Prototype comparison: use identical invented records in the preserved baseline, a week-by-unit overview and a week agenda with unit labels. Include four units, a deadline cluster next week, an unknown-date assessment, a unit with no dated deadlines, a completed preparation action with an upcoming submission, and an older source timestamp. Keep fixtures separate from real student data.

Ask a student, without coaching: “Which week is this?”, “What is due today?”, “Which week has several deadlines?”, “What does this unit have coming up?”, “What still needs confirmation?” Then ask them to inspect one assignment, choose/record a preparation action and return. Observe time to correct answer, missed items, confusion, taps and recovery; speed alone is not success. This experiment should determine the layout and navigation, rather than using a layout to dictate the tasks.

## 設計原則

- 重要資訊能直接掃到；細節漸進展開，不為了整潔把必要內容全部藏起來。
- 日期、週次、availability、活動時段、正式截止各有語意，不互相代替。
- 自動填寫只提供可見、可改的合理建議，不覆蓋手動選擇、不猜未知事實。
- 任務、行程、正式考核與個人準備行動可以相關，但不混成同一種東西。
- 不強迫每份作業拆成許多 steps。活動週與提交截止可以屬於同一 assessment。
- 未記錄、未完成、未公布、未確認是不同狀態。空白成績不是零分。
- 資料可靠性先於功能數量；匯入要可預覽，來源和手動內容要能分辨。
- 用真實情境驗證流程，而非以「功能存在」判定使用者能順利完成。

## 當前 MVP 邊界

**必須可靠：** 課程與考核資料帶入／保存、學期和近期安排、基本新增編輯、準備缺口導覽、進度更新，以及目前已有成績功能的正確解釋與資料保護。

**平台範圍：** USYD 標準 2026 S1/S2、desktop web，Connect 為本機 Chrome extension。帳戶登入及雲端保存已存在。

**不作為這階段通過條件：** 原生 iOS、Friends、公開 Chrome Web Store 發行、背景檢查更新、獨立 Today／大型 Dashboard、廣泛跨校支援。不投入手機 web 專項重設計。

**不承諾：** 取代官方成績單、保證通過 hurdle、推測隱藏成績、猜測 outline/Canvas 沒提供的資訊、無確認覆寫手動資料。

PDF/OCR 自動匯入、Ed 整合與完整筆記系統不在當前 MVP。未來方向、優先順序與實際工作狀態統一記在 [ROADMAP](ROADMAP.md)，不在這裡再維護一份待辦。
