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

## Mobile planning

Evolving mobile flows, widget concepts and product ideas now live in [Semester — Mobile & widget ideas](https://app.notion.com/p/40bd6bfd790e81c1800cdf60f250174f) in Notion, following the user’s preference. They are exploratory, not an implementation backlog. This repository retains implementation decisions, build/test evidence and version checkpoints. The working sample prototype remains preserved at `ios-preview-v0.1.0` (`6f544ba`); earlier idea notes remain available in Git history.

## Course planning & friends

2026-11-02：使用者認可 web 延伸主線 **規劃多年／各學期 units → 找同學期同科朋友 → 協調同一 tutorial group → 確認實際 allocation**。Course plan 在帶入課表之前就可用，與現有 semester 的考核／準備資料分開；未來才連接正式在修學期。

Sharing 是整份計畫的一個選擇：**所有 accepted friends，或 nobody**；涵蓋所有年份／學期與之後新增 units，沒有逐科或逐位朋友權限。未開啟 sharing 時保持 private；不分享 grades、assessments、私人 calendar events 或 timetable URL。接受新朋友沿用當下的整體設定。

Final results 是計畫內的私人資料：使用者可記錄 final mark／grade code，並查看以 credit points 加權的 standard WAM estimate。這些欄位、WAM 與個人排除設定永遠不給朋友，不隨 course-plan sharing 開啟。WAM 只根據已記錄且合資格的數字結果；不從 assessment 進度推算官方 final grade，也不自動把 grade 當成課程完成或學分認可。

Considering／Planned／Enrolled／Completed 都是學生自行記錄，不能冒充官方 enrolment、credit recognition 或 degree audit。Tutorial preference 與實際 allocated 必須分開；辨識 university、unit、year、session、activity 與 group ID，同時段不同 group 不算同班。第一個 slice 與驗收狀態見 [SOCIAL-01](ROADMAP.md#social-01)。

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
