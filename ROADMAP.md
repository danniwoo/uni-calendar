# ROADMAP — 現在在哪裡，下一步做什麼？

更新：2026-10-20 · Web **0.4.1** / Connect **0.2.2**

這是唯一的工作／測試狀態總表。產品用途見 [VISION](VISION.md)，工程細節見 [PROGRESS](PROGRESS.md)。**功能已寫好 ≠ 已發布 ≠ 你已測過 ≠ 流程順。**

## 打開先看這裡

| 看什麼 | 目前位置 | 從哪裡繼續 |
| --- | --- | --- |
| **現在主線** | M1：可靠地管理自己的學期；尚未完成整條使用者驗收 | 先完成 [CONNECT-01](#connect-01) 的真實四科比對 |
| **等你測** | Connect 已修；assessment、準備、成績等改動仍缺完整試用結論 | [測試佇列](#test-queue)，優先 T01 → T02 |
| **本次插入修正** | 手動新增 assignment 缺少刪除入口：FLOW-01-F1 | 程式與 synthetic QA 完成；接 T09 回測，不清掉原本 Connect 待測 |
| **暫放** | 輕量 Planning 還沒收斂；不因新增功能而當作已完成 | [PLAN-01](#plan-01)：先看真實作業怎麼拆下一步 |
| **接著做** | 修復測試發現的問題，再走一份作業的完整流程 | T03 → T04；不要先再增加頁面 |
| **之後再決定** | 自動 Canvas 更新、iOS、Friends、平台演進 | [Later / Ideas](#later-ideas)，不是本輪交付承諾 |

目前沒有另外宣稱正在編碼的功能。多條工作線可以並存；Now 同時推進最多 1–3 條，其餘留續接點。

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

### CONNECT-01

**Canvas 四科 → 核對 → 配對匯入** · P0 · **待驗證** · Now

- 已做：Connect 0.2.2 修正舊 API `muted` 誤擋已公布分數、支援 Complete/Incomplete 文字結果並檢查版本一致；Web 0.4.0 重用配對、顯示來源分數差異並保護手動內容。文字結果目前不轉成網站數字成績。
- 停在哪：34 Node tests、81 真實 DOMParser synthetic 斷言與匯入保護測試通過。使用者已 reload 並提供新版四科匯出，數字／文字結果與先前 Canvas 可見資料一致，格式驗證通過；尚未驗收真實配對與保存。工具仍無法操作 extension URL。
- 下一步：用新版檔案做 T02 的配對預覽，先核對、不自動確認匯入；補查日期與重考規則。另修正「已帶 posted_at 但沒有結果」的 released metadata（目前未算成零或納入成績數量）。
- 驗收：四科成功或明確報錯；可見已公布分數吻合；隱藏不是零；配對無歧義；確認後才保存；手動資料不變；重複匯入不重複新增。
- 證據：實作 `0374e9c`；synthetic reader/import QA；**真實驗收：待記錄**。

### FLOW-01

**作業新增／編輯／回到原位置** · P1 · **待驗證** · Next

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

**個別成績 → 合計 → 單科目標** · P1 · **待驗證** · Next

- 已做：overall / individual grades、recurring/parts 合計、Show grades 與 Hide recurring 控制、單科統計及有條件的目標估算。
- 停在哪：成績已不是「以後才做」；目前要驗證輸入與理解。Connect group 計算仍需明確確認，不能猜 drop rules。
- 下一步：T06，用 synthetic 範例先驗證邏輯，再自願核對真實資料。
- 驗收：不用手算每 part 總分；分母／權重／缺成績清楚；不重複計入 parent/child；篩選不改整科統計；hurdle 不因估算達標而自動通過。
- 證據：grades / grade-parts regression；**使用者理解及完整試用：待記錄**。

### DATA-01

**保存、刷新、備份還原的信任** · P0 · **待驗證** · M1 gate

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
| **T02 / CONNECT-01** | T01 通過 → 私人 JSON → app 配對預覽 → 使用者確認 → Saved → 再匯同檔 | 手動資料被保留？來源更新可辨認？無重複？先備份；可先用 synthetic board | 待 T01 |
| **T03 / FLOW-01** | Assessment → 新增／編輯 demo＋submission → Week/Month → 返回修改 | due 在哪？parent/step 編輯清楚嗎？活動範圍與提交日期混淆嗎？不必猜示範日期寫入真實資料 | 待驗證 |
| **T04 / PREP-01** | Week 的一個 Quiz → 範圍 → 未記錄 lecture → 更新 → 返回 | 不知道點哪？未知是否被當成未完成？返回丟位置嗎？ | 待驗證 |
| **T05 / PLAN-01** | 選一份真實作業 → 記「現在要做的下一步」→ 安排本週 → 隔天找回 | 要去別的 app 才記得住嗎？被迫建立正式 assessment step 嗎？ | 待觀察／方案未定 |
| **T06 / GRADE-01** | 單科 Show grades → 14/20、權重 10% → 再測 recurring/parts 與一筆空白 | 能理解 70% 和總評貢獻 7 分的差別？空白不是零？隱藏 recurring 不改統計？ | 待驗證 |
| **T07 / DATA-01** | 隔離 board 編輯 → Saved/reload → refresh → backup/restore → 切換帳戶 | 保護手動值／清空、還原差異、身份隔離；不拿正式資料冒險 | 待安排 |
| **T08 / M2** | 新使用者自行設定自己的學期，完成找作業／更新，再使用一週 | 哪裡需要開發者解說？下次打開能續接嗎？不用抄錄私人對話 | 待 M1 核心問題解除 |
| **T09 / FLOW-01-F1** | Web 0.4.1 → 開一份可丟棄的手動 assessment → Delete assessment → 取消，再確認 → Undo | 入口可見？取消不改資料？group 提示範圍？Undo 還原？確認 Saved 後才 reload；Undo 本身不跨 reload 保留 | 已通過 synthetic QA；待你回測 |

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
| CONNECT-02 | 開啟／使用 Canvas 時檢查更新，提供差異確認 | Later；先證明 CONNECT-01 正確，再定權限、登入失效與通知行為。不承諾離線／背景持續同步。 |
| DIST-01 | Chrome Web Store 發行與自動更新 | Later；先完成讀取驗收、安全／隱私與發行準備，目前仍 unpacked。 |
| IOS-01 | 原生 iOS app | Later 方向；desktop 核心流程穩定後選原生 MVP，不做手機 web 專項重設計。 |
| SOCIAL-01 | Friends：看朋友修哪些 units | Idea；先定自願分享、可見範圍與撤回。現有登入不代表已有社交功能。 |
| PLATFORM-01 | 帳戶／後端與資料平台演進 | Idea／需求待釐清；已有 sign-in + D1，不預設必須重建或遷移。由 iOS、分享、可攜性需求決定。 |
| EXPLORE-01 | 獨立 Today、大型 Dashboard、廣泛跨校／PDF/Ed 匯入 | 暫不投入；先說明現有 view 的具體缺口，再評估價值。 |

不把個人成績、學生資料或私人商業筆記寫進這份表。未來若改用 Issues/Projects 管任務，應遷移狀態來源而不是同時維護兩套。

## 已實作基礎，不再重開相同開發項目

Semester / Month / Week、Subject 與準備提示、Assessment inventory、編輯與多步驟、活動時間、成績、備份還原、Canvas reviewed import 都已有實作。**仍需驗證的項目已掛在上面的工作卡，不在這裡重複列待辦。**

版本變更見 [Web changelog](CHANGELOG.md) 和 [Connect changelog](extensions/semester-connect/CHANGELOG.md)；較早背景見 [archive](docs/archive/IMPLEMENTATION-2026-10-20.md)。
