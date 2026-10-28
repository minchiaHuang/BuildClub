# Trend Finder UI/UX 全面測試＋修復計畫

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。測試工具選擇與 AI 扮使用者的做法先讀 `testing-web-flows-with-ai` skill。

**Goal:** 確定 Trend Finder 每個畫面的每顆按鈕、連結、輸入框都能用、有反應、不報錯，四套主題 × 三種寬度都正常；找到就修，最後出一頁報告。

**使用者決定（2026-10-29 01:40）：** 找到就修；四套主題（default、Altitude、Unify、Midnight）× 三種寬度（390、768、1440）全測；第 5 層 AI 探索測試也要做。

**起點：** `feat/full-backend-coverage` 的 PR 開好之後（夜間 session 的 Task 16 完成）。開新 Orca worktree，分支 `test/uiux-sweep`，base `feat/full-backend-coverage`。第一步把本檔複製到 repo 的 `docs/plans/2026-10-29-uiux-sweep.md` 並 commit。下文 `TF` = `pivots/02-content/app/trend-finder`。

## Global Constraints

- **不花 API 錢。** 全程用 `bash bin/isolated-backend.sh 8797 --demo-data --user test@example.com:<自訂>`（無 `.env`、所有上限 0）。付費動作在這裡會回 429：這是預期的，要檢查的是畫面有清楚的提示，不是能不能成功。
- 不新增 npm／pip 依賴。瀏覽器用 Playwright MCP；被鎖時用 `/Users/tommy/.hermes/hermes-agent/node_modules/playwright-core`（絕對路徑 import）。無障礙用 Playwright 的 `ariaSnapshot()`，不裝 axe。截圖比對用肉眼或 AI，不裝 pixelmatch。
- 不碰 port 8787、5195、integrate-premium-ui worktree、`.env`。`npm run build` 只在本 worktree 跑。
- 修 bug 可以改 Veralyn 的元件（使用者已同意），但**改變設計決定**（版面、文案語氣、拿掉功能）的不要自己改，列進報告的「要你決定」。
- 一個問題一個 commit：`fix(trend-finder): <問題>`，結尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。每個 commit 前 `bash bin/verify.sh` 綠＋`npx tsc -b && npm run lint` 乾淨。
- 嚴重度：**P0** 當掉／白畫面／資料遺失；**P1** 功能不照預期（按了沒反應、存不起來、錯的結果）；**P2** 能用但卡（看不懂、找不到、錯誤沒提示、手機上點不到）；**P3** 外觀小問題。P0–P2 都修；P3 很小就順手修，否則列報告。

## 第 1 層：按鈕全點（`TF/e2e/click-sweep.mjs`）

- 參數：`<baseUrl> <outDir>`；矩陣 4 主題 × 3 寬度 × 所有畫面（overview、search、results、saved、approvals、review、plans、plan、board、settings、channel、login、landing×3、`/review/<token>` 分享頁、影片抽屜）。主題用 ThemeSwitcher 的 localStorage key 切（讀 `src/lib/theme.ts`）。
- 每個畫面收集 `button, a[href], [role=button], [role=tab], input, select, textarea, summary`（可見且在畫面內的）。每個元素：記錄名稱 → 點擊或輸入 → 等 400 ms → 檢查：
  1. `pageerror` 與 `console.error`：任何一條都算失敗（白名單只放已知且合理的，寫在腳本頂部並註明理由）。
  2. API 回應：5xx 一律失敗；4xx 只有 429（上限 0）和刻意的 401 可以，且畫面上要出現對應訊息。
  3. 有沒有反應：URL、可見 DOM 的雜湊、或焦點有變。都沒變＝「沒反應」，列 P1 候選，人工（agent）再確認。
  4. 停用的元素要有 `title` 或旁邊文字說明原因。
- 會改狀態的（Sign out、Turn off link、Reject、刪除）放在該畫面最後點，每個畫面開始前重置資料（重新啟動隔離後端或還原 data.db）。
- 輸出 `outDir/sweep.json`＋`sweep.md`（畫面 × 元素 × 主題 × 寬度 的通過表）＋每個失敗的截圖。

## 第 2 層：使用者流程（`TF/e2e/journeys/*.mjs`）

在 Task 15 的 `full-flow.mjs` 基礎上，每一步都斷言結果：
1. **Daphne 日常：** 登入 → 選客戶 → 搜「tofu」（TikTok＋IG）→ 開抽屜看拆解、lines、能不能拍 → 存 → 規劃（改 shot、due date、給剪輯師的 note）→ 送審 → 複製 Annie 連結 → 看板移到 Posted → Overview 計數。
2. **Annie 手機（390）：** 無 cookie 開分享連結 → 看參考影片、note、shot list → 一個 Approve、一個 Reject 附理由 → Daphne 那邊 20 秒內看到。
3. **新帳號第一次用：** landing → Log in → 沒客戶時的畫面 → 新增客戶 → 第一次搜尋 → Channel 頁。
每條在 4 主題 × 3 寬度各跑一次。

## 第 3 層：異常狀態

用 `page.route()` 攔截 `/api/*` 造出：0 筆結果、429、502、網路中斷、回應慢 3 秒、超長標題／caption（300 字）、缺欄位的舊資料、流程中途重新整理、兩個分頁同時改同一個點子。預期：有提示、能恢復、不白畫面、不丟資料。

## 第 4 層：鍵盤與無障礙

- 只用 Tab／Shift+Tab／Enter／Space／Esc 走完第 2 層的 Daphne 流程。
- 檢查：焦點框看得見；抽屜和對話框能 Esc 關、關掉後焦點回到原按鈕；每顆按鈕有可讀名稱（`ariaSnapshot()` 裡沒有空名稱的 button）；圖片有 alt 或標為裝飾；390 寬時可點區域至少 40×40 px。

## 第 5 層：AI 探索與視覺審查

- **三個 persona agent**（Sonnet，各自用 Playwright，只給目標不給說明書）：(a) 第一次用的代理商社群經理，任務「幫 Evergreen Foods 找 3 支這週能拍的影片並送審」；(b) Annie 在手機上審核；(c) 代理商老闆想看這個月進度。每個回報：卡住的地方、看不懂的字、多餘的步驟，附截圖。
- **視覺審查 agent**（`model: "opus"`，設計判斷）：看第 1 層截圖（每畫面 × 主題 × 寬度一張的網格），找重疊、被切掉、文字溢出、主題顏色或字體不一致、對比太低。
- persona 與視覺的發現進同一份問題清單，照嚴重度處理。

## 修復迴圈

1. 第 1–5 層全部跑完，彙整問題清單（去重，每條：嚴重度、畫面、主題、寬度、重現步驟、截圖）。
2. 依 P0 → P1 → P2 → P3 修，每修一條就把重現步驟加進對應腳本當回歸檢查。
3. 全部修完，第 1–4 層全矩陣重跑；P0、P1 必須是 0，否則回到 2（最多 3 輪；還有就停下列出來）。
4. 推 `test/uiux-sweep`，開 PR（base `feat/full-backend-coverage`），說明含 `## Verification`。

## 報告（使用者看的）

用 Artifact（先 quickstart），繁體中文，結論在最前面：測了多少元素 × 矩陣、修前修後的問題數、每條修了什麼（附前後截圖）、沒修的與原因、「要你決定」的設計問題清單、persona 摘要。本地留 `docs/STATUS.md` 一段紀錄。

## 完成條件

- 全矩陣（4 × 3）第 1–4 層 P0、P1 = 0。
- 所有 P2 修掉或列為「要你決定」。
- verify 綠、tsc／lint 乾淨、PR 已開、報告連結已給。
