# Semester Connect 0.1.0

**Local, read-only Chrome extension prototype. Not a Chrome Web Store release.**

Preview USYD Canvas courses, assignments, student-specific due dates, opening/closing dates, released marks, submission status, and assignment-group weights/rules. No Semester import, automatic refresh, grade totals, notifications, or mobile UI work in this version. Existing Semester Web and its version are unchanged.

## 在 Chrome 載入

1. 使用電腦上的 **Google Chrome**，不是 Codex 內建瀏覽器。
2. 網址列輸入 `chrome://extensions`，開啟右上角 **Developer mode / 開發人員模式**。
3. 按 **Load unpacked / 載入未封裝項目**。
4. 選取這個資料夾（裡面直接有 `manifest.json`）：
   `/Users/Daniel/USYD/Project/UNI_calendar/semester/extensions/semester-connect`
5. 在 Chrome 拼圖選單找到 **Semester Connect — Local Preview**，可釘選。
6. 正常開啟 `https://canvas.sydney.edu.au` 並登入。**在 Canvas 分頁上**點 extension 圖示。
7. 新分頁中按 **Read my courses**。確認顯示的是自己的帳戶，選擇 ISYS2120 等實際課程，再按 **Read selected course**。
8. 用 **Compare in Canvas** 開另一個分頁，對照 Marks。點作業名稱可查看作業來源；展開 **Dates & source details** 查看 Opens / Closes 與 ID。

先讀一科，再測其餘三科。每次只讀選中的一科；讀另一科會清除上一科預覽。不會上傳或修改任何資料。請保留原 Canvas 分頁，不要在讀取中切換帳戶或重新整理它。原分頁導覽／關閉會清除預覽。

## 比對清單

- Course code / term 正確；學生活動／Portal 不自動當成教學科目。
- 作業與 recurring quizzes 各有一列（不是自動套進 Semester 的 parts）。
- 分數與滿分正確，例如 `2.7 / 3`；真正的 `0 / 3` 仍顯示零。
- 未公布／未評分不顯示為 0；Excused 顯示免計分。
- Due、Opens、Closes 不混用；所有時間顯示 Australia/Sydney，包括夏令時間。
- Group weight 是整組權重，不是假設每次 quiz 都占這個百分比。0.1.0 不重算 Canvas 總分。
- 再按 Read selected course 不累積重複資料。
- Search / Grades 篩選正常；無 due date 的作業排在最後。
- Clear preview 清空帳戶／課程／成績畫面，重新整理預覽頁也不保留資料。

如有錯誤：回報 **0.1.0、操作步驟、錯誤代碼、預期與實際差別**。必要時裁切／遮住姓名和其他成績再截圖；不要提供 cookies、token、完整 API 回應或課表私人連結。

## 安全與資料範圍

- 只有 `activeTab` 和 `scripting` 權限，沒有永久 host permissions、cookies、storage、alarms、downloads 或 externally-connectable 權限。
- 點 extension 後取得暫時頁面權限，但必須再點 Read 才發出 API 請求。
- 只允許 `https://canvas.sydney.edu.au`；固定 GET 路徑：自己的 profile、student course list、選定課程、assignments（含自己的 submission）、assignment_groups。
- API 請求在 Canvas 的 isolated content-script world 執行；使用瀏覽器同來源登入狀態，不讀取或轉交 cookie。不能繞過登入／成績權限。
- 僅傳回預覽所需欄位。描述 HTML、email、附件、其他學生分數不傳入預覽；Canvas 回應本身可能含額外欄位，只在讀取函式暫存。
- 分數必須有有效 `posted_at`，且未標記 hidden/muted/excused 才顯示。缺少發布證據時保守顯示 unavailable，即使某校版本可能在頁面顯示分數。這需要實際 Canvas 比對，不會嘗試取出隱藏分數。
- 每次讀取前後比對 Canvas 帳戶 ID；選課讀取要求 student enrollment。失敗不保留部分作業清單。groups 無權讀取時，保留完整作業清單並明確標示 group unavailable。
- 單次請求 15 秒 timeout，讀取流程約 60 秒預算（最後一個請求可能再用 15 秒）；每個清單最多 50 頁／5,000 筆，限制或分頁異常會報錯。
- 沒有伺服器、analytics、遙測或資料庫寫入。預覽只存在目前分頁記憶體；Clear/關頁不會撤銷已送出的 GET，但會丟棄未完成的結果。Canvas 本身仍可能記錄正常讀取請求。
- 沒有學校官方背書；公開發行前仍需另行確認平台規範、隱私與權限說明。

## 限制與常見問題

- 只列出 active student enrollments，不包括已結束／inactive 課程。
- 尚未在你的真實 Canvas 帳戶測試；需要你完成上述只讀比對。
- Teacher/observer、其他學校、跨帳戶整合、離線使用、New Quizzes 的題目級細節不支援。
- 登入失效、Canvas 特殊設定或 API 變更可能需要調整；不會改用密碼／token 收集方式。
- `ACCESS`：回 Canvas 分頁再次點 extension 圖示。不要直接開舊的預覽網址。
- `LOGIN_REQUIRED` / `NETWORK`：先確認 Canvas 已登入且能正常載入，再從那個分頁重開。
- `NOT_STUDENT`：API 未確認自己的 student enrollment；請回報，不繞過檢查。
- 這版不提供自動更新偵測／匯入按鈕，不會變更已部署的 Semester Web。

## 更新、移除

更新本機檔案後，到 `chrome://extensions` 對 Semester Connect 按重新載入，關掉舊預覽分頁，再從 Canvas 點 extension。此開發版不會從 Web Store 自動更新。

移除：到 `chrome://extensions` 按 Remove。沒有成績資料檔需要清除。

## 開發與版本

### 0.1.0 驗證紀錄

- 25 項自動測試通過：分頁、跨來源拒絕、隱藏／空白／0 分、帳戶切換、錯誤處理、時區與篩選。
- 獨立 Chrome 桌面 UI 測試通過：選科、查詢、篩選、來源連結、清除進行中的讀取、安全文字顯示。
- 真正載入 unpacked extension 的獨立 Chrome 測試通過：工具列 action、activeTab 權限、isolated-world API 讀取、日期／分數顯示、關閉來源分頁清空。
- 上述自動測試的 Canvas 回應全是攔截提供的假資料；沒有用真實帳戶跑讀取器。另只讀確認使用者 ISYS2120 Marks 頁已登入、有公開分數與尚未公布的項目，沒有修改頁面或成績。
- 手機 web、已部署 Semester Web、資料庫沒有修改／發布。

選用的 Chrome QA 腳本需要 Playwright，可設定 `PLAYWRIGHT_PACKAGE` 為既有安裝的套件路徑，執行 `npm run test:browser` 或 `npm run test:extension`。後者只在臨時測試 profile 啟用 Chrome 的 extension debugging，不修改一般瀏覽器設定；所有 Canvas 網路請求均攔截為 synthetic responses。

零安裝依賴；直接載入資料夾。Node 20+ 執行：

```sh
cd extensions/semester-connect
npm test
```

`manifest.json` 與 `package.json` 同步採 SemVer，更新記錄在 `CHANGELOG.md`。Web 與 extension 獨立編號；資料格式／日後同步協定另外版本化。Chrome 數字 `version` 用於排序，預發布標籤可放 `version_name`。

技術參考（自行實作，未複製 BetterCanvas 程式碼）：
- https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- https://developer.chrome.com/docs/extensions/reference/api/scripting
- https://developerdocs.instructure.com/services/canvas/resources/assignments
- https://developerdocs.instructure.com/services/canvas/resources/submissions
- https://developerdocs.instructure.com/services/canvas/resources/assignment_groups

架構：`background.js` 僅開啟預覽；`preview.js` 管理選課、操作、錯誤與畫面；`reader.js` 為可序列化的封閉讀取函式；`model.js` 為純顯示邏輯。Tests 全部使用 synthetic data，不提交真實 Canvas 資料。
