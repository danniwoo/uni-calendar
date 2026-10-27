# ROADMAP — 現在在哪裡，下一步做什麼？

更新：2026-10-27 · Web **0.14.0** 已發布（Sites 51）/ 本次發布來源 Connect **0.4.0**

0.14.0：首次匯入直接呈現準備好的成績、可改的建議連結／新增作業，一次 Import；未出分 backlog 收起。使用者明確要求修復朋友首次使用的阻斷，不代表跳過 M1 或宣布 M2 完成。Synthetic 首次、重複匯入與保護檢查通過；T11／新使用者試用仍待驗收。

這是唯一的工作／測試狀態總表。產品用途見 [VISION](VISION.md)，工程細節見 [PROGRESS](PROGRESS.md)。**功能已寫好 ≠ 已發布 ≠ 你已測過 ≠ 流程順。**

## 打開先看這裡

| 看什麼 | 目前位置 | 從哪裡繼續 |
| --- | --- | --- |
| **現在主線** | M1：可靠地管理自己的學期；尚未完成整條使用者驗收 | 先完成 [CONNECT-01](#connect-01) 的真實四科比對 |
| **等你測** | Connect 已修；assessment、準備、成績等改動仍缺完整試用結論 | [測試佇列](#test-queue)，優先 T01 → T02 |
| **本次交付** | CONNECT-01／02：首次先看準備好的成績、預填建議、可改／Skip／Undo，一次 Import 後直接看成績 | Web 0.14.0 已發布；本次未改 Connect。朋友首次使用與 T11 仍待驗收，不能把 synthetic 通過當作使用者接受。既有手動子項目連結／修復另續接。T09／T10 保留 |
| **暫放** | 輕量 Planning 還沒收斂；不因新增功能而當作已完成 | [PLAN-01](#plan-01)：先看真實作業怎麼拆下一步 |
| **接著做** | 修復測試發現的問題，再走一份作業的完整流程 | T03 → T04；不要先再增加頁面 |
| **之後再決定** | 自動 Canvas 更新、iOS、Friends、平台演進 | [Later / Ideas](#later-ideas)，不是本輪交付承諾 |

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

### CONNECT-01

**Canvas 四科 → 核對 → 配對匯入** · P0 · **待驗證** · Now

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

**Reload → 待確認更新** · P0 · **待驗證** · Now

- 已做：Web 0.8.0 分清新結果、未配對、手動資料保護、規則需核對；Connect 0.3.0 加入固定兩站 optional permission、選科/account 綁定、單科 reload checks、session pending preview、固定站點 bridge。JSON 入口保留。
- 邊界：每科每分鐘最多一次，只在選定課程頁完整載入時檢查，沒有 timer polling。權限撤回／關閉／帳戶錯誤清理 preview；登入失效與失敗有提示。未配對不新增，未知不是零，絕不自動確認或回寫 Canvas。
- 證據：reader／mocked lifecycle/security tests、TypeScript、web regression、production build；synthetic web UI 驗證 JSON 和 pending banner 共用 preview、並行更新不替換已開預覽、stale review 停用、取消零寫入、只確認一項假成績時手動值／清空保留。
- 新增：Web 0.9.0 / Connect 0.4.0 的 **Check all N courses** 只讀已授權科目，單一 Canvas 分頁即可；一次全部成功才提供預覽。日常更新預設摘要，未變更項目收起；未配對可明確沿用既有規則，未知仍不是零。
- Web 0.9.0 已發布（Sites v46 / `dd534e4`）。下一步／T11：Chrome reload Connect 0.4.0、關舊 preview 並 reload Semester → 確認已授權四科 → **同一 Chrome profile** 保持一個登入的 Canvas 課程頁 → Check all 4 courses → 核對四科讀取時間、成績及手動保護，暫不確認真實匯入。前版單科傳送已觀察到，不等於四科批次驗收。
- 待核對：真實 Chrome 事件/權限/worker 重啟、四科逐項結果與失敗提示、關閉檢查後不再讀取。工具限制仍不允許操控 extension URL；mock 測試不是實機驗收。
- 2026-10-26 使用者截圖已見四科待確認批次，但配對清單過長且選取後消失。Web 0.10.0 改為真正成績變更優先、待配對／保護收起、選取保留與 Undo、已確認匯入紀錄、成績未讀提示及跳至該科成績。紀錄只在確認時保存，非自動匯入；不回填歷史。已發布 Sites v47（`d3fad54`），自動化與假資料 UI 測試通過，實機使用者驗收待完成。
- 下一步／T11 補充：先預覽真實批次，確認沒有變更時不要求處理所有未配對；選一筆後可見、撤回、取消。只有使用者之後明確確認的匯入才測 Saved → reload → history／New 小點 → 點開清除，小點消失後紀錄仍可回看。保留手動值及 JSON；本輪不替使用者確認匯入。

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
- Web 0.6.0 已加：現有作業內的 highest attempt、binary best-N，次數／取幾次／完成分數可設定；門檻獨立檢查。未知不當零、原始成績保留、partial completion 不混入目前平均。開發回歸與隔離 UI 測試通過，尚待使用者 T10；未代填真實 ELEC 資料。
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
| **T02 / CONNECT-01** | 私人 JSON → app 配對預覽 → 使用者確認 → Saved → 再匯同檔 | 手動資料被保留？來源更新可辨認？無重複？先備份；可先用 synthetic board | 17＋13 筆已保存並 reload 核對；同檔 30 筆重用配對、0 變更通過。下一步只預覽最新來源更新，不確認匯入 |
| **T03 / FLOW-01** | Assessment → 新增／編輯 demo＋submission → Week/Month → 返回修改 | due 在哪？parent/step 編輯清楚嗎？活動範圍與提交日期混淆嗎？不必猜示範日期寫入真實資料 | 待驗證 |
| **T04 / PREP-01** | Week 的一個 Quiz → 範圍 → 未記錄 lecture → 更新 → 返回 | 不知道點哪？未知是否被當成未完成？返回丟位置嗎？ | 待驗證 |
| **T05 / PLAN-01** | 選一份真實作業 → 記「現在要做的下一步」→ 安排本週 → 隔天找回 | 要去別的 app 才記得住嗎？被迫建立正式 assessment step 嗎？ | 待觀察／方案未定 |
| **T06 / GRADE-01** | 單科 Show grades → 14/20、權重 10% → 再測 recurring/parts 與一筆空白 | 能理解 70% 和總評貢獻 7 分的差別？空白不是零？隱藏 recurring 不改統計？ | 待驗證 |
| **T07 / DATA-01** | 隔離 board 編輯 → Saved/reload → refresh → backup/restore → 切換帳戶 | 保護手動值／清空、還原差異、身份隔離；不拿正式資料冒險 | 待安排 |
| **T08 / M2** | 新使用者自行設定自己的學期，完成找作業／更新，再使用一週 | 哪裡需要開發者解說？下次打開能續接嗎？不用抄錄私人對話 | 待 M1 核心問題解除 |
| **T09 / FLOW-01-F1** | Web 0.4.1 → 開一份可丟棄的手動 assessment → Delete assessment → 取消，再確認 → Undo | 入口可見？取消不改資料？group 提示範圍？Undo 還原？確認 Saved 後才 reload；Undo 本身不跨 reload 保留 | 已通過 synthetic QA；待你回測 |
| **T10 / GRADE-01** | Show grades → 現有 Quiz 的 Individual grades / rules → 最高分與門檻；再測 10 次 prework 取最佳 8 | 未考不是 0？完成／未交／未確認容易分辨？2/4 secured 和平均分不同？Apply count、取消、保存重開是否清楚？ | Web 0.6.0 開發測試通過；待使用者試用。先手動確認，不自動匯入特殊規則 |
| **T11 / CONNECT-02** | Web 0.9.0、reload Connect 0.4.0 → 已授權四科 → 同一 Chrome 保持一個 Canvas 課程頁 → Check all 4 → pending preview | 不自動保存；新項目 Skip；手動值保護；一次四科時間清楚；失敗不提供半批預覽；單科 reload／JSON 保留 | 開發回測通過；前版單科傳送已觀察到；本版四科實機與取消零寫入待驗證 |

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
| IOS-01 | 原生 iOS app | Later 方向；desktop 核心流程穩定後選原生 MVP，不做手機 web 專項重設計。 |
| SOCIAL-01 | Friends：看朋友修哪些 units | Idea；先定自願分享、可見範圍與撤回。現有登入不代表已有社交功能。 |
| PLATFORM-01 | 帳戶／後端與資料平台演進 | Idea／需求待釐清；已有 sign-in + D1，不預設必須重建或遷移。由 iOS、分享、可攜性需求決定。 |
| EXPLORE-01 | 獨立 Today、大型 Dashboard、廣泛跨校／PDF/Ed 匯入 | 暫不投入；先說明現有 view 的具體缺口，再評估價值。 |

不把個人成績、學生資料或私人商業筆記寫進這份表。未來若改用 Issues/Projects 管任務，應遷移狀態來源而不是同時維護兩套。

## 已實作基礎，不再重開相同開發項目

Semester / Month / Week、Subject 與準備提示、Assessment inventory、編輯與多步驟、活動時間、成績、備份還原、Canvas reviewed import 都已有實作。**仍需驗證的項目已掛在上面的工作卡，不在這裡重複列待辦。**

版本變更見 [Web changelog](CHANGELOG.md) 和 [Connect changelog](extensions/semester-connect/CHANGELOG.md)；較早背景見 [archive](docs/archive/IMPLEMENTATION-2026-10-20.md)。
