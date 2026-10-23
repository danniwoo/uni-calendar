# Semester Connect 0.4.0

Local unpacked Chrome extension. Canvas stays read-only. Not a Chrome Web Store release.
Compatible website: Semester Web 0.4.0 or later for JSON; **Web 0.9.0 for Check all and compact updates** (Web 0.8.0 supports single-course delivery). Import format stays version 1. Git push does not deploy the website.

<a id="reload-checks"></a>
## Reload 更新檢查（可選，先預覽）

1. 網站先部署 Web 0.9.0；Chrome 重新載入 unpacked Connect，關掉舊 preview，從 Canvas 圖示開啟，確認 **0.4.0**，並 reload Semester 網頁以載入新 bridge。
2. **Read my courses** → 核對帳戶及學期 → 勾四科 → **Enable for selected courses**。Chrome 會要求 Canvas 與 Semester 兩個固定網站權限；不授權仍可用 JSON。
3. 在**同一個 Chrome profile** 開 Semester 網站。Codex 內建瀏覽器不會自動取得 Chrome 的 extension 連線。
4. 保持一個已登入 Canvas `/courses/<id>/…` 分頁開著，在 Semester 按 **Check all 4 courses**（數字依已啟用科目數）。自動依序讀完四科，只在全部成功後提供預覽；中途失敗會清 pending、提示重試，不冒充完整四科。批次最多每分鐘一次。也可只 reload 某科檢查該科；兩者都不需再次打開 extension。
5. 按 **Review Canvas updates**：日常更新先顯示新結果、待配對與逐筆手動保護，未變更及 JSON 入口收起。**Resolve unmatched items** 會打開並聚焦配對區；選對現有 assessment／已確認規則後，按 **Review → 勾核對 → Confirm**。未知 prework 不變成 0，也不建重複作業。目前試用先停在 preview，不確認真實資料。
6. 驗收：同樣結果再次讀取不重複新增；新項目仍為 Skip；手動值/清空不變；開著 review 收到新 snapshot 不替換它；帳戶不同停止、登入失效清掉 pending 並提示；關閉後 reload 不再讀取。
7. **Turn off & clear pending previews** 停止檢查、移除選課設定、清 session preview 並撤回兩個 optional host grants。不影響已確認的網站資料或已下載 JSON。

只記住啟用設定與 account/course IDs；來源成績在 extension session storage，關閉瀏覽器、extension reload/disable 會清除。超過 24 小時的 snapshot 不再提供，於下次讀取/存取清理；無定時背景工作。失敗後重新登入並等一分鐘再 reload，或使用 JSON。不是推播、不是關閉瀏覽器後繼續同步，也不會回寫 Canvas。

現在的測試證據是 mocked Chrome lifecycle + synthetic web UI；**尚未驗證真實 Chrome 安裝版的端到端授權與四科傳送**。部署與正式資料確認分開，不因測試通過自動執行。

## 更新與測試

1. 到 Chrome 的 `chrome://extensions`，對 **Semester Connect — Local Preview** 按重新載入。
2. 關掉舊的 Connect 預覽，從已登入的 USYD Canvas 分頁重新點 extension 圖示。確認版本 **0.4.0**。舊預覽可能仍記著舊版本；必須重新讀取、下載才能刷新資料，不能只重傳舊 JSON。已有 schema 1 檔案仍可用在新版匯入配對。
3. 按 **Read my courses**，核對帳戶，再勾本學期四科；不要選 Portal。按 **Read selected courses**。
4. 每科會分別顯示筆數與已公布成績。單科失敗不清掉其他成功資料；從 Course 選失敗那科，再按 **Read selected course** 重試。所有勾選科目成功才可匯出。
5. 用 Course 選單檢查每科，與 **Compare in Canvas** 的 Marks 頁比對。未公布、隱藏、免計分不等於零分。
6. 確認後按 **Download import file**。這是含成績的私人 JSON，請勿公開分享。
7. 回到 Semester 網站 **Manage → Import from Semester Connect**，選剛下載的檔案。檔案先在瀏覽器本機解析，不立即上傳。
8. **Match assessments**：核對帳戶、學期及四科配對。已確認的配對會帶回，唯一同名／相同 Canvas 連結會提供建議；相似名稱／A1 等標籤只列候選，點選才配對。不確定的項目保持 **Skip**：
   - 已有 assessment：選對應項目，填空白成績或檢查既有 Canvas 成績的更新差異。
   - Recurring / multi-part：展開該區，把 Canvas group 配到既有 assessment，明確選依總分或每項等權才會選入。含重考名稱或 drop rules 的群組禁止整組平均；按課程規則選適用結果，不自動假設最高／最近一次。
   - 真正沒有的項目才選 **Add new assessment**；新項目權重留空，避免把 group 權重誤當每次 quiz 權重。
9. 按 **Review selected items →**，查看哪些變更會套用、哪些保留。可返回配對，返回後須重新確認。資料若被其他分頁修改，舊確認會失效。確認後按 **Confirm**，等網站顯示 **Saved**；取消不保存。
10. 匯入的 individual grades 暫列 provisional。到 **Show grades → Edit individual grades** 檢查計算與完整項目清單（Canvas 可能還沒有未來項目），儲存後才作為已確認設定。

首次安裝：Chrome → Extensions → Developer mode → Load unpacked，選：
本 repository 內的 `extensions/semester-connect` 資料夾。

不用重新安裝，也不用重新匯入課表。既有四科資料保留。Web 與 extension 各有自己的版本號。

四科比對與網站匯入的待測步驟統一追蹤在 [ROADMAP 的 CONNECT-01](../../ROADMAP.md#connect-01)；不要把完成下載視為完成驗收。

## 不覆蓋的界線

- 既有名稱、日期、活動時段、權重、筆記、完成狀態不變。
- 手動成績、手動清空的成績、已有的手動 grade plan 均保留。只有仍等於上次 Canvas 匯入值且未手動修改的分數可在確認後更新，畫面顯示舊值 → 新值。
- 本版不自動保存更新。JSON 或 reload snapshot 都重用配對；舊檔案、沒有更新基準的舊版紀錄、刪除的項目不覆蓋／重建。
- 同一 Canvas item 透過 account/course/assignment ID 去重，不能默默改配到另一份作業。
- 一個 board 首次有實際匯入時綁定 Canvas account ID。不同帳戶檔案停止匯入。
- Group drop rules 不自動計算。不同計分方式、額外加分、非數字成績等請手動核對。
- 只填手動 grade plan 的空白項目尚未支援自動配對；請直接在個別成績編輯器填寫，避免錯配。

## 讀取與安全

基本權限為 `activeTab`、`scripting`、`storage`。沒有必需的 host permission；只有明確啟用 reload 檢查時要求 Canvas 與 Semester 的 optional host grants，直到關閉或撤回。不使用 cookies、downloads、externally-connectable 權限，不收密碼／token。Session 成績不開放給任意 content script；bridge 僅在固定 Semester origin、top frame 啟用，網站不能發命令讓 reader 讀任意網址或修改選課設定。
固定 USYD 同來源 GET：自己 profile、active student courses、指定課程、assignments（自己的 submission）、assignment_groups，以及該課程的 student Marks HTML。
請求在 Canvas isolated world 執行，使用現有登入狀態，開始／結束核對帳戶。沒有寫入 Canvas、analytics、背景輪詢或自動保存。啟用 reload 後，已選課程來源資料可傳到固定 Semester 網頁的記憶體做預覽；使用者確認之前不保存到網站帳戶。

單科 API 缺少 enrollments 欄位時，用 server-filtered active student course list 核對，而不是直接拒絕。老師／observer-only 課程不支援。

成績需有 API 公布證據或新讀取的 Marks 頁可見分數。讀取不執行該 HTML 的 script，忽略隱藏 original/What-If 欄位。Marks 的 hidden/pending 狀態優先，不能用 stale API 分數繞過。React/new-layout 等不支援格式會警告，僅保留可確認公布的 API 結果。這不是 Canvas 總分或最終成績的重算。

API 的 assignment `muted` 是舊通知欄位，不代表學生看不到分數；不要與 Marks 頁每列的 `data-muted` 混淆。後者與 submission `grade_hidden` 仍阻止輸出分數。
Complete／Incomplete 以文字結果顯示及匯出，`score` 保持 null，不推算成 100%／0%。批次摘要分開顯示 numeric grades 與 text results。Web 0.7.0 起，Complete 只在明確確認的 completion rule 下轉換得分，不自動勾 calendar completion。

描述 HTML、email、附件及其他學生資料不傳到 preview。匯入檔僅含選定課程資料和 account ID，不含姓名、cookie 或登入憑證。
每科請求受 timeout、固定路徑、分頁和大小限制。檔案最多 1.5 MB／2,500 items；選課最多八科。
Clear／關頁清空記憶體，不刪除已下載檔案。原 Canvas 分頁導覽或關閉會清空 preview。保持原分頁開啟直到下載完成。

## 常見問題與限制

- `Locked in Canvas` 是作業存取／提交鎖定，不代表成績被隱藏；新版標籤已說明。
- `ACCESS`：回 Canvas 分頁重新點 extension 圖示，不要直接開舊預覽 URL。
- `LOGIN_REQUIRED`／`NETWORK`：確認 Canvas 正常登入後重開。
- `NOT_STUDENT`：目前帳戶的 active student list 未確認這門課，不繞過權限。
- `Marks-page cross-check unavailable`：該校頁面格式／存取尚未支援，請比對 Canvas。隱藏分數不會猜測。
- 部分科目仍 `0 released grades`：0.2.2 再修正把 API assignment `muted` 當成未公布的錯誤。0.2.1 只解決外層 loading wrapper；兩者不是同一個問題。更新 extension、重開預覽、重新讀取並下載。真正未公布／待批改的成績仍不讀取。
- `VERSION_MISMATCH`：manifest、preview 或 reader 不是同一版。到 `chrome://extensions` Reload，再從 Canvas 重開 preview；不能只重傳舊下載。
- Canvas 原本沒有的日期、活動週、未來 quiz 或還未公布的成績，不會憑空補齊。
- 本版仍需用真實四科比對；開發驗證使用 synthetic data，未修改使用者紀錄。
- 尚未提供背景偵測、Web Store 自動更新或原生 iOS 支援。

## 開發驗證

`npm test` 在此資料夾執行零依賴 Node 測試。網站另有 `node --import tsx scripts/check-canvas-import.ts`。
可重現的瀏覽器解析測試：在此資料夾執行 `node scripts/qa-server.mjs`，開啟列出的 **Synthetic reader QA** URL，按 **Run browser checks**；0.2.3 的 89 項斷言使用真實 DOMParser 與原始 serialized reader，四科資料全為虛構。第二個 URL 測 preview；加上 `&stale=1` 可驗證版本不一致提示。伺服器僅監聽 localhost，不連 Canvas、不讀瀏覽器 profile。測完 Ctrl+C 停止。
本次通過 34 項 Node 測試、上述 81 項瀏覽器斷言、preview 四科勾選/讀取/篩選/舊版本阻擋與網站匯入保護測試。實際 Chrome extension 頁受工具限制，**不是四科 live acceptance 已通過**；T01 仍待更新後逐項核對。
0.2.0 的既有驗證另在 localhost 用原始 reader/preview 與 synthetic Chrome adapter 測試四科、單科失敗重試、Marks HTML 可見／隱藏／待審核／What-If、下載、網站檔案選擇、明確配對、確認及重複匯入。該次測試不連真實 Canvas，也不寫帳戶資料庫；不是此次重新驗證所有上述 UI 流程。
舊版可選 `test:browser`／`test:extension` 腳本保留為 0.1.0 整合測試起點；0.2.0 的完整新流程以上述測試為準，未重新驗證真實 Chrome unpacked integration。

技術參考：
- https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- https://developerdocs.instructure.com/services/canvas/resources/submissions
- https://developerdocs.instructure.com/services/canvas/resources/assignment_groups
- https://github.com/instructure/canvas-lms/blob/master/app/views/gradebooks/grade_summary.html.erb

SemVer：manifest/package 同步；Web、extension、匯入格式獨立編號。正式商店發行、隱私聲明及學校政策需另外確認。
