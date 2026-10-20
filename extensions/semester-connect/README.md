# Semester Connect 0.2.0

Local unpacked Chrome extension. Canvas stays read-only. Not a Chrome Web Store release.
Compatible website: Semester Web 0.3.0 or later; import format version 1.

## 更新與測試

1. 到 Chrome 的 `chrome://extensions`，對 **Semester Connect — Local Preview** 按重新載入。
2. 關掉舊的 Connect 預覽，從已登入的 USYD Canvas 分頁重新點 extension 圖示。確認版本 **0.2.0**。
3. 按 **Read my courses**，核對帳戶，再勾本學期四科；不要選 Portal。按 **Read selected courses**。
4. 每科會分別顯示筆數與已公布成績。單科失敗不清掉其他成功資料；從 Course 選失敗那科，再按 **Read selected course** 重試。所有勾選科目成功才可匯出。
5. 用 Course 選單檢查每科，與 **Compare in Canvas** 的 Marks 頁比對。未公布、隱藏、免計分不等於零分。
6. 確認後按 **Download import file**。這是含成績的私人 JSON，請勿公開分享。
7. 回到 Semester 網站 **Manage → Import from Semester Connect**，選剛下載的檔案。檔案先在瀏覽器本機解析，不立即上傳。
8. 核對帳戶、學期及四科配對。每筆預設 **Skip**：
   - 已有 assessment：選對應項目，只填空白成績。
   - Recurring / multi-part：展開該區，把整個 Canvas group 配到既有 assessment，確認依總分或每項等權計算。
   - 真正沒有的項目才選 **Add new assessment**；新項目權重留空，避免把 group 權重誤當每次 quiz 權重。
9. 查看 **Changes to confirm**。勾確認，再按 **Confirm**；等網站顯示 **Saved**。
10. 匯入的 individual grades 暫列 provisional。到 **Show grades → Edit individual grades** 檢查計算與完整項目清單（Canvas 可能還沒有未來項目），儲存後才作為已確認設定。

首次安裝：Chrome → Extensions → Developer mode → Load unpacked，選：
`/Users/Daniel/USYD/Project/UNI_calendar/semester/extensions/semester-connect`

不用重新安裝，也不用重新匯入課表。既有四科資料保留。Web 與 extension 各有自己的版本號。

## 不覆蓋的界線

- 既有名稱、日期、活動時段、權重、筆記、完成狀態不變。
- 已填成績、手動清空的成績、已有的手動 grade plan 均保留；Canvas 有不同分數會顯示 kept，不靜默更新。
- 本版不是持續同步。再次匯入只補尚未填寫的 Connect 項目；已填／刪除的項目不重建、不覆蓋。
- 同一 Canvas item 透過 account/course/assignment ID 去重，不能默默改配到另一份作業。
- 一個 board 首次有實際匯入時綁定 Canvas account ID。不同帳戶檔案停止匯入。
- Group drop rules 不自動計算。不同計分方式、額外加分、非數字成績等請手動核對。
- 只填手動 grade plan 的空白項目尚未支援自動配對；請直接在個別成績編輯器填寫，避免錯配。

## 讀取與安全

只有 `activeTab`、`scripting`，無永久 host access、cookies、storage、downloads 或 externally-connectable 權限。不收密碼／token。
固定 USYD 同來源 GET：自己 profile、active student courses、指定課程、assignments（自己的 submission）、assignment_groups，以及該課程的 student Marks HTML。
請求在 Canvas isolated world 執行，使用現有登入狀態，開始／結束核對帳戶。沒有寫入 Canvas、analytics、背景輪詢或自動上傳。

單科 API 缺少 enrollments 欄位時，用 server-filtered active student course list 核對，而不是直接拒絕。老師／observer-only 課程不支援。

成績需有 API 公布證據或新讀取的 Marks 頁可見分數。讀取不執行該 HTML 的 script，忽略隱藏 original/What-If 欄位。Marks 的 hidden/pending 狀態優先，不能用 stale API 分數繞過。React/new-layout 等不支援格式會警告，僅保留可確認公布的 API 結果。這不是 Canvas 總分或最終成績的重算。

描述 HTML、email、附件及其他學生資料不傳到 preview。匯入檔僅含選定課程資料和 account ID，不含姓名、cookie 或登入憑證。
每科請求受 timeout、固定路徑、分頁和大小限制。檔案最多 1.5 MB／2,500 items；選課最多八科。
Clear／關頁清空記憶體，不刪除已下載檔案。原 Canvas 分頁導覽或關閉會清空 preview。保持原分頁開啟直到下載完成。

## 常見問題與限制

- `Locked in Canvas` 是作業存取／提交鎖定，不代表成績被隱藏；新版標籤已說明。
- `ACCESS`：回 Canvas 分頁重新點 extension 圖示，不要直接開舊預覽 URL。
- `LOGIN_REQUIRED`／`NETWORK`：確認 Canvas 正常登入後重開。
- `NOT_STUDENT`：目前帳戶的 active student list 未確認這門課，不繞過權限。
- `Marks-page cross-check unavailable`：該校頁面格式／存取尚未支援，請比對 Canvas。隱藏分數不會猜測。
- Canvas 原本沒有的日期、活動週、未來 quiz 或還未公布的成績，不會憑空補齊。
- 本版仍需用真實四科比對；開發驗證使用 synthetic data，未修改使用者紀錄。
- 尚未提供背景偵測、Web Store 自動更新或原生 iOS 支援。

## 開發驗證

`npm test` 在此資料夾執行零依賴 Node 測試。網站另有 `node --import tsx scripts/check-canvas-import.ts`。
本次另在 localhost 用原始 reader/preview 與 synthetic Chrome adapter 測試四科、單科失敗重試、Marks HTML 可見／隱藏／待審核／What-If、下載、網站檔案選擇、明確配對、確認及重複匯入。測試不連真實 Canvas，也不寫帳戶資料庫。
舊版可選 `test:browser`／`test:extension` 腳本保留為 0.1.0 整合測試起點；0.2.0 的完整新流程以上述測試為準，未重新驗證真實 Chrome unpacked integration。

技術參考：
- https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- https://developerdocs.instructure.com/services/canvas/resources/submissions
- https://developerdocs.instructure.com/services/canvas/resources/assignment_groups
- https://github.com/instructure/canvas-lms/blob/master/app/views/gradebooks/grade_summary.html.erb

SemVer：manifest/package 同步；Web、extension、匯入格式獨立編號。正式商店發行、隱私聲明及學校政策需另外確認。
