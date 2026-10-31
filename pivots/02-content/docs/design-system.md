# Remake Design System 規範

- 日期：2026-10-31
- 範圍：只依據 Veralyn 在 Remake flow 上的程式碼（`src/styles/`、`src/components/`）。
- 出處寫法：`檔名:行號`，路徑都相對於 `pivots/02-content/app/trend-finder/`。例如 `src/styles/tokens.css:5` 就是 `pivots/02-content/app/trend-finder/src/styles/tokens.css` 第 5 行。
- 方向：安靜的畫布、搶眼的內容、單色（`src/styles/tokens.css:2`）。顏色只留給分數和狀態（`src/styles/tokens.css:16`）。
- 給使用者看的版本：claude.ai Artifact 頁（連結在交付回報裡），內容與本文件一致。

## 0. 總則

1. 其他樣式檔不寫死顏色、圓角、動畫時間，一律讀 token（`src/styles/tokens.css:1`）。
2. 保留舊 token 名稱，只能加別名，不能改名或刪除（`src/styles/tokens.css:42`、`src/styles/tokens.css:61`、`src/styles/tokens.css:111-115` 都是別名）。
3. 深色模式只在 `@media (prefers-color-scheme: dark)` 內改 token 的值，元件規則不分深淺（`src/styles/tokens.css:137-177`）。
4. 動畫要尊重「減少動態」設定（`src/styles/base.css:37-44`）。
5. 文字用句首大寫（sentence case），不用全大寫和等寬字（`src/styles/components.css:6`、`src/styles/components.css:111`）。
6. 新畫面只用本文件列的 token 和元件；真的沒有才新增，新增後要補進本文件。

## 1. Token

### 1.1 顏色：表面與文字（淺色值，深色值見 `src/styles/tokens.css:138-148`）

| Token | 淺色值 | 用途 | 出處 |
|---|---|---|---|
| `--bg` | `#f5f5f7` | 頁面畫布 | `src/styles/tokens.css:5` |
| `--surface` | `#ffffff` | 卡片、面板、輸入框 | `src/styles/tokens.css:6` |
| `--surface-2` | `#f0f0f2` | 柔和填色：hover、軌道、安靜的徽章 | `src/styles/tokens.css:7` |
| `--surface-3` | `#e5e5ea` | 按下或較強的填色 | `src/styles/tokens.css:8` |
| `--fg` | `#1d1d1f` | 主要文字 | `src/styles/tokens.css:9` |
| `--muted` | `#6e6e73` | 次要文字（在 `--bg` 上 4.6:1） | `src/styles/tokens.css:10` |
| `--line` | `#e5e5ea` | 細邊框 | `src/styles/tokens.css:11` |
| `--line-strong` | `#d2d2d7` | 輸入框邊框、必須看得見的分隔 | `src/styles/tokens.css:12` |
| `--frost` | `rgb(255 255 255 / 0.88)` | 黏在頂端或底部的列，搭配 `backdrop-filter` | `src/styles/tokens.css:13` |
| `--scrim` | `rgb(16 16 20 / 0.32)` | 抽屜和覆蓋層後面的遮罩 | `src/styles/tokens.css:14` |

別名：`--color-bg`、`--color-surface`、`--color-surface-2`、`--color-surface-3`、`--color-fg`、`--color-muted`、`--color-line`、`--color-line-strong`（`src/styles/tokens.css:118-125`）。

### 1.2 顏色：強調色（單色）

| Token | 淺色值 | 用途 | 出處 |
|---|---|---|---|
| `--accent` | `#1d1d1f` | 主要按鈕、焦點、選中 | `src/styles/tokens.css:17` |
| `--accent-hover` | `#3a3a3c` | 主要按鈕 hover | `src/styles/tokens.css:18` |
| `--accent-fg` | `#ffffff` | 強調色底上的文字 | `src/styles/tokens.css:19` |
| `--accent-soft` | `#ececef` | 強調色的淡底 | `src/styles/tokens.css:20` |

別名：`--color-accent`、`--color-accent-fg`（`src/styles/tokens.css:126-127`）。

### 1.3 顏色：狀態（淡底加可讀的字色，實心底另有前景色）

| Token | 淺色值 | 意義 | 出處 |
|---|---|---|---|
| `--hot` / `--hot-soft` / `--hot-fg` | `#c2410c` / `#fdefe7` / `#ffffff` | 突破、爆、快到期 | `src/styles/tokens.css:23-25` |
| `--early` / `--early-soft` / `--early-fg` | `#1a7a44` / `#e5f4ea` / `#ffffff` | 早期、已批准、真實資料 | `src/styles/tokens.css:26-28` |
| `--rising` / `--rising-soft` | `#93600a` / `#fbf3e1` | 上升中、等待、範例資料 | `src/styles/tokens.css:29-30` |
| `--late` / `--late-soft` | `#6b6b70` / `#f0f0f2` | 已飽和、一次性 | `src/styles/tokens.css:31-32` |
| `--no` / `--no-soft` | `#b42318` / `#fdeceb` | 錯誤、退回 | `src/styles/tokens.css:33-34` |

別名：`--color-hot`、`--color-early`、`--color-rising`、`--color-late`、`--color-danger`（`src/styles/tokens.css:128-132`）。

規則：狀態色只用在分數、狀態徽章、錯誤，不拿來做裝飾（`src/styles/tokens.css:16`、`src/styles/components.css:120-123`）。

### 1.4 平台色

`--tiktok: #111111`（`src/styles/tokens.css:37`）、`--instagram: #c13584`（`src/styles/tokens.css:38`）。深色值在 `src/styles/tokens.css:168-169`。

### 1.5 字體與字級

| Token | 值 | 出處 |
|---|---|---|
| `--font-sans` | Inter，後面接系統字 | `src/styles/tokens.css:41` |
| `--font-display`、`--font-body` | 都指向 `--font-sans`（舊規則別名） | `src/styles/tokens.css:42-43` |
| `--text-3xs` / `--text-2xs` | 10px / 11px | `src/styles/tokens.css:72-73` |
| `--text-xs` / `--text-sm` | 12px / 13px | `src/styles/tokens.css:44-45` |
| `--text-ms` | 14px | `src/styles/tokens.css:74` |
| `--text-base` | 15px（`body` 的字級） | `src/styles/tokens.css:46`、`src/styles/base.css:10` |
| `--text-body` | 16px | `src/styles/tokens.css:75` |
| `--text-md` / `--text-lg` | 17px / 18px | `src/styles/tokens.css:47`、`src/styles/tokens.css:76` |
| `--text-xl` / `--text-2xl` / `--text-3xl` / `--text-4xl` | 22 / 24 / 28 / 30px | `src/styles/tokens.css:77-80` |
| `--text-display` | 52px | `src/styles/tokens.css:81` |
| `--text-h1` / `--text-h2` | `clamp(30px, 8vw, 36px)` / `clamp(21px, 2.3vw, 25px)` | `src/styles/tokens.css:82-83` |
| `--tracking-tight` | `-0.02em`（標題字距） | `src/styles/tokens.css:48`、`src/styles/base.css:22` |

標題預設樣式：`h1`、`h2`、`h3`（`src/styles/base.css:22-24`）。

### 1.6 間距（用在 `gap`）

| Token | 值 | 出處 |
|---|---|---|
| `--space-3xs` / `--space-2xs` / `--space-xs` / `--space-sm` | 2 / 4 / 6 / 8px | `src/styles/tokens.css:86-89` |
| `--space-md` / `--space-base` / `--space-lg` / `--space-xl` | 10 / 12 / 14 / 16px | `src/styles/tokens.css:90-93` |
| `--space-2xl` / `--space-3xl` / `--space-4xl` | 18 / 24 / 28px | `src/styles/tokens.css:94-96` |

### 1.7 圓角

| Token | 值 | 用途 | 出處 |
|---|---|---|---|
| `--radius-xs` | 8px | 縮圖上的小徽章、行內圖片 | `src/styles/tokens.css:51` |
| `--radius-sm` | 12px | 按鈕、輸入框、小卡片 | `src/styles/tokens.css:52` |
| `--radius` | 16px | 卡片 | `src/styles/tokens.css:53` |
| `--radius-lg` | 20px | 大面板、抽屜、對話框 | `src/styles/tokens.css:54` |
| `--radius-xl` | 24px | 登入卡片 | `src/styles/tokens.css:99` |
| `--radius-pill` | 999px | 膠囊（chip、pill、狀態） | `src/styles/tokens.css:55` |

### 1.8 陰影與焦點

| Token | 用途 | 出處 |
|---|---|---|
| `--shadow-sm` | 平放的卡片、按鈕 | `src/styles/tokens.css:58` |
| `--shadow-md` | hover 的卡片、登入卡片 | `src/styles/tokens.css:59` |
| `--shadow-lg` | 抽屜、手機側邊欄 | `src/styles/tokens.css:60` |
| `--shadow` | 舊別名，等於 `--shadow-md` | `src/styles/tokens.css:61` |
| `--focus-ring` | 輸入框焦點外圈，用 `color-mix` 取強調色 | `src/styles/tokens.css:62` |

鍵盤焦點的預設樣式：`:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`（`src/styles/base.css:19`）。

### 1.9 層級（z-index）

`--z-raised: 2`、`--z-bar: 20`（黏住的列）、`--z-action-bar: 25`、`--z-dropdown: 30`、`--z-drawer: 40`、`--z-scrim: 55`、`--z-sidebar: 60`（`src/styles/tokens.css:102-108`）。規則：不要自己寫數字，一律用這組。

### 1.10 動畫

| Token | 值 | 用途 | 出處 |
|---|---|---|---|
| `--duration-fast`（`--dur-fast`） | 150ms | 按鈕、chip 的狀態切換 | `src/styles/tokens.css:65`、`src/styles/tokens.css:111` |
| `--duration`（`--dur`） | 220ms | 一般轉場、抽屜遮罩 | `src/styles/tokens.css:66`、`src/styles/tokens.css:112` |
| `--duration-slow`（`--dur-slow`） | 300ms | 抽屜滑入 | `src/styles/tokens.css:67`、`src/styles/tokens.css:113` |
| `--duration-hover` | 200ms | 可選取卡片的邊框和底色 hover | `src/styles/tokens.css:114` |
| `--duration-pulse` | 1.2s | 骨架脈動，刻意放慢 | `src/styles/tokens.css:115`、`src/styles/components.css:87` |
| `--ease` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | 所有轉場 | `src/styles/tokens.css:68` |

## 2. 元件

每個元件寫：用途、什麼時候用、不能怎麼用、對應 class 或元件。

### 2.1 按鈕

- **用途**：觸發動作。
- **class**：`.btn` 是基底（`src/styles/components.css:14-20`）；再加一個變體：
  - `.btn-primary`：黑底白字，一個畫面只放一個主要動作（`src/styles/components.css:22`）。例：看板空狀態的主要按鈕（`src/components/ShortlistBoard.tsx:136`）。
  - `.btn-ghost`：白底細邊框，次要動作（`src/styles/components.css:24`）。例：`src/components/ShortlistBoard.tsx:89`。
  - `.btn-sm`：緊湊版，用在卡片裡或列內（`src/styles/components.css:26`）。
- **文字連結型**：`.link-btn` 灰色加底線，用於低調的行內動作（`src/styles/components.css:28-33`，使用範例 `src/components/ErrorText.tsx:16`）；`.link-strong` 用於可點的標題（`src/styles/components.css:40-41`）；`.plan-watch` 是「Watch on 平台」的外部連結樣式（`src/styles/components.css:35-39`）。
- **圖示按鈕**：`.icon-btn`，34px 圓形（`src/styles/components.css:43-49`）。
- **規則**：
  - 按下縮到 0.98（`src/styles/components.css:21`）。
  - 停用狀態一律用 `button:disabled`，不透明度 0.5、游標 `not-allowed`（`src/styles/base.css:18`）。
  - 不要用 `.btn-primary` 做破壞性動作；退回和刪除用 `.btn-ghost`，錯誤色只留給文字和徽章。
  - 按鈕文字不換行（`src/styles/components.css:17`）。

### 2.2 卡片

- **用途**：把一個物件（影片、idea、數字）框起來。
- **通用長相**：`--surface` 底、`1px solid var(--line)`、`--radius`、`--shadow-sm`。以下是現有的卡片：
  - `.board-card`：看板上的 idea 卡片，左邊 52px 縮圖，hover 加深陰影（`src/styles/approvals.css:89-96`，用在 `src/components/ShortlistBoard.tsx:72`）。
  - `.stat-card`：抽屜裡的數字卡片（`src/styles/drawer-plan.css:42-45`）。
  - `.board-batch`：批次送審的面板，無邊框，`--shadow-sm`（`src/styles/approvals.css:80-83`）。
  - `.la-login-card`：登入卡片，`--radius-xl`、`--shadow-md`（`src/styles/login.css:7-10`）。
- **什麼時候用**：每張卡片代表一個可操作的物件。
- **不能**：卡片裡再包卡片；用 hover 陰影以外的方式表示可點；自己換圓角（卡片固定 `--radius`，縮圖內的小元素用 `--radius-xs`，`src/styles/approvals.css:96`）。

### 2.3 標籤、chip、pill

三種不同的東西，不要混用。

**a. 篩選 chip `.cchip`**（可點，選一個動作）
- 白底、細邊框、膠囊（`src/styles/components.css:75-81`）。
- 變體：`.cchip-hot` 前面一個紅點（`src/styles/components.css:85`）；`.cchip-saved` 虛線邊框（`src/styles/components.css:86`）；`.cchip-trending` 帶暖色底和上升箭頭，最熱的多一個「Hot」小標（`src/styles/components.css:90-95`）；`.cchip-skeleton` 載入中的骨架（`src/styles/components.css:87`）。
- 群組用 `.chip-group` / `.chip-row`（`src/styles/components.css:71-74`）。使用範例：`src/components/ClientChips.tsx:81`。
- 手機寬度（560px 以下）換行，不橫向捲（`src/styles/components.css:99-100`）。

**b. 搜尋理解 chip `.q-chip`**（可移除）
- 變體 `.q-chip-topic`（強調淡底）、`.q-chip-audience`（上升色淡底）、移除鈕 `.q-chip-x`（`src/styles/components.css:105-109`）。

**c. 狀態徽章（不可點）**
- `.pill`（`src/styles/components.css:112`），顏色變體 `.pill-wait` / `.pill-ok` / `.pill-no`（`src/styles/components.css:113-115`）。要可點時加 `.pill-btn`（`src/styles/components.css:116-118`，例 `src/components/OverviewScreen.tsx:131`）。
- `.status` 加 `.status-waiting` / `.status-approved` / `.status-rejected`，專門顯示 idea 的審核狀態（`src/styles/components.css:120-123`，例 `src/components/PlanScreen.tsx:111`）。
- `.stage-pill` 加 `-early` / `-rising` / `-everywhere` / `-one-off`，顯示趨勢階段（`src/styles/components.css:125-128`）。
- `.tier` 加 `-breakout` / `-strong` / `-normal`，顯示分數級別，分數文字用 `.score-*`（`src/styles/components.css:130-136`）。
- `.sample-pill`（範例資料，上升色）與 `.live-pill`（真實資料，早期色），前面一個圓點（`src/styles/components.css:140-143`，例 `src/components/Sidebar.tsx:198`、`src/components/Sidebar.tsx:202`）。
- `.soon`、`.ai-tag` 是灰色小標（`src/styles/components.css:138-139`）。
- 證據標籤 `.evidence-chip` 疊在 `.stage-pill` 上，`.evidence-high` 用早期色，`.evidence-medium` 用上升色（`src/styles/components.css:184-187`，元件 `src/components/EvidenceChip.tsx:13`）。
- **規則**：狀態徽章顏色必須對應語意（等待=上升色、批准=早期色、退回=錯誤色，`src/styles/components.css:121-123`）；字級 `--text-xs`，字重 600。

### 2.4 側邊欄

- **用途**：整個 app 的主導覽。
- **class**：`.shell`（264px 側邊欄加內容區，`src/styles/layout.css:2`）、`.sidebar`（黏在左邊，全高，`src/styles/layout.css:7-11`）、`.side-brand` 與 `.brand-mark`（`src/styles/layout.css:12-13`）、`.side-nav` 與 `.side-link`（`src/styles/layout.css:68-69`）、目前所在頁 `.side-on`（`src/styles/layout.css:76`，條件寫在 `src/components/Sidebar.tsx:145`）、數量標 `.side-count`（`src/styles/layout.css:78-79`）、底部 `.side-foot` 與 `.side-user`（`src/styles/layout.css:83-86`）。
- **規則**：
  - 目前頁用白底加內框，不用顏色（`src/styles/layout.css:76`）。
  - 860px 以下變成滑出的抽屜：固定定位、`--z-sidebar`、`--shadow-lg`，後面用 `.side-scrim` 蓋住（`src/styles/layout.css:16-24`），頂端改用 `.mobile-bar`（`src/styles/layout.css:25-29`）。
  - 還沒做的項目用 `.soon` 小標，不要另外藏起來（`src/styles/layout.css:80`）。

### 2.5 看板欄

- **用途**：shortlist 依審核狀態分三欄，加一條「退回」的橫向區（`src/styles/approvals.css:61`）。
- **class**：`.board-cols`（三欄格線，1000px 以下改單欄，`src/styles/approvals.css:62-63`）、`.board-col` 與 `.board-lane`（灰底大圓角面板，`src/styles/approvals.css:64-67`）、欄標題 `.board-col-head`（`src/styles/approvals.css:68-69`）、數量 `.board-count`（依欄位變色：`.board-col-waiting` 用上升色，`.board-col-approved` 用早期色，`.board-lane` 用錯誤色，`src/styles/approvals.css:70-76`）、卡片清單 `.board-list`（`src/styles/approvals.css:87-88`）、退回原因 `.board-reason`（`src/styles/approvals.css:100`）。元件：`src/components/ShortlistBoard.tsx:101-102`。
- **規則**：欄的底色是半透明 `--surface-2`，卡片才是 `--surface`，兩層不能同色（`src/styles/approvals.css:66`、`src/styles/approvals.css:91`）。

### 2.6 抽屜

- **用途**：在不離開列表的情況下看單支影片的細節。
- **class**：`.drawer-wrap`（全螢幕遮罩，`--z-drawer`，右對齊，`src/styles/drawer-plan.css:5-9`）、`.drawer`（寬 `min(600px, 100%)`，`src/styles/drawer-plan.css:10-14`）、`.drawer-head`（`src/styles/drawer-plan.css:27-29`）、`.drawer-body`（可捲，`src/styles/drawer-plan.css:30-31`）、`.drawer-foot`（`--frost` 底加模糊，`src/styles/drawer-plan.css:32-36`）。元件：`src/components/BreakdownPanel.tsx:142-157`。
- **規則**：
  - 640px 以上是浮動面板（12px 邊距、`--radius-lg`、邊框），手機版貼滿螢幕（`src/styles/drawer-plan.css:15-19`）。
  - 關閉時加 `.is-closing`，動畫用 `--dur`（`src/styles/drawer-plan.css:20-25`）。
  - 動作按鈕放在 `.drawer-foot`，靠右（`src/styles/drawer-plan.css:33`）。

### 2.7 表單欄位

- **用途**：輸入文字、日期、選項。
- **class**：`input` / `select` / `textarea` 的全域樣式（白底、`--line-strong` 邊框、`--radius-sm`，`src/styles/components.css:52-56`）；hover 邊框加深（`src/styles/components.css:57-59`）；焦點時邊框變強調色並顯示 `--focus-ring`（`src/styles/components.css:60`）；`.field`（標籤加輸入的直排，`src/styles/components.css:63`）、`.field-label`（`src/styles/components.css:64`）、`.field-wide`（跨滿格線，`src/styles/components.css:65`）、`.check`（核取方塊，`src/styles/components.css:66-67`）。用法：`src/components/ShortlistBoard.tsx:160-165`。
- **單選卡片**：登入的身分選擇 `.la-role`（`src/styles/login.css:14-25`）與分段控制 `.la-seg`（`src/styles/login.css:41-51`）：選中時邊框和內框變 `--fg`，隱藏原生 input。
- **欄位錯誤**：`.field-error` 搭配 `input[aria-invalid="true"]` 的錯誤色邊框（`src/styles/login.css:32-33`，例 `src/components/AddClientScreen.tsx:97`）。
- **規則**：
  - 每個輸入都要有可見的 `.field-label` 或 `aria-label`（`src/components/ReviewScreen.tsx:350`）。
  - 多行輸入用 `textarea`，高度可調，不要自己寫固定高度（`src/styles/components.css:62`）。
  - 表單按鈕列用 `.form-actions`（`src/styles/login.css:34`，例 `src/components/AddClientScreen.tsx:162`；此規則限定在 `data-ui="altitude"` 底下）。

### 2.8 空狀態

- **用途**：列表或看板沒有內容時，告訴使用者下一步。
- **class**：`.empty`（白底、虛線邊框、置中，`src/styles/components.css:146`）；內文 `p` 灰色，最寬 48 個字元（`src/styles/components.css:147`）。用法：`src/components/ShortlistBoard.tsx:133`、`src/components/ReviewScreen.tsx:125`、`src/components/OverviewScreen.tsx:87`、`src/components/ResultsScreen.tsx:253`。
- **規則**：空狀態要帶一個動作（例如 `.btn-primary`，`src/components/ShortlistBoard.tsx:136`）；看板單欄沒內容用較小的 `.board-empty`（`src/styles/approvals.css:78`）。
- **載入中**不是空狀態，用骨架：`.skeleton-grid`、`.skeleton-tile`、`.skeleton`（`src/styles/search-results.css:376-386`，元件 `src/components/LiveLoading.tsx:16-18`）。

### 2.9 錯誤訊息

- **用途**：告訴使用者哪裡出錯，以及下一步。
- **class**：`.error`（`--no-soft` 底、`--no` 字、`--radius-sm`，`src/styles/components.css:68`）。用在 `<p className="error" role="alert">`（`src/components/SearchScreen.tsx:82`、`src/components/ResultsScreen.tsx:218`、`src/components/ResultsScreen.tsx:230`）。
- **內文**：用 `ErrorText` 元件顯示，API 回傳「Try a saved search, like "x"」時，引號內的名稱會變成可點的 `.link-btn`（`src/components/ErrorText.tsx:3-21`）。
- **脈動列的錯誤**：`.pulse-error` 只改字色（`src/styles/components.css:102`）。
- **規則**：
  - 一律加 `role="alert"`（`src/components/SearchScreen.tsx:82`）。
  - 錯誤顏色只用 `--no` / `--no-soft`，不用 `--hot`（`src/styles/tokens.css:33-34`）。
  - 訊息用平實的句子，API 的文字原樣顯示（`src/components/ErrorText.tsx:2`）。

### 2.10 頁面標題與區塊

- `.page-head`（標題加說明的直排，`src/styles/components.css:4`，例 `src/components/ReviewScreen.tsx:116`）、`.eyebrow`（灰色小字，不用全大寫，`src/styles/components.css:7`）、`.block`（區塊，`src/styles/components.css:9-10`）、`.quote`（左邊細線的引言，`src/styles/components.css:11`）。
- 工具類別：`.muted`、`.small`、`.lede`、`.hint`、`.tabular`、`.sr-only`（`src/styles/base.css:29-34`）。

### 2.11 留言串（時間點留言）

- **用途**：在參考影片的某個秒數留言，讓經理和客戶能指著畫面說哪裡要改。
- **class / 元件**：`.timed-comments`（整個區塊，`src/styles/shared-review.css:16`，元件 `src/components/TimedComments.tsx:106`）、`.tc-list` 與 `.tc-item`（留言清單，每則一格「時間 + 內容」，`src/styles/shared-review.css:17-18`，`src/components/TimedComments.tsx:115-117`）、`.tc-body`（`src/styles/shared-review.css:19`）、`.tc-at`（時間膠囊，`--surface-2` 底、`--radius-pill`，`src/styles/shared-review.css:20`）、`.tc-at-link`（能跳到影片該秒的版本，hover 變 `--surface-3`，`src/styles/shared-review.css:21-22`，`src/components/TimedComments.tsx:119`）、`.tc-form` / `.tc-row` / `.tc-time` / `.tc-actions`（新增留言的表單，`src/styles/shared-review.css:23-27`，`src/components/TimedComments.tsx:133-155`）。使用處：計畫頁 `src/components/PlanScreen.tsx:8` 與審核連結頁 `src/components/SharedReviewPage.tsx:10`。
- **什麼時候用**：只在有參考影片可以定位的畫面；兩個入口共用同一個元件，樣式不要各寫一份。
- **不能**：把時間做成彩色標籤（顏色只留給狀態）；自己寫新的留言樣式；在 `.tc-*` 裡寫死間距，一律用 `--space-*`。

### 2.12 審核連結區塊（board-link）

- **用途**：在 shortlist 看板上產生並複製給審核人的連結。
- **class**：`.board-link`（輸入框加按鈕的直排，`src/styles/shared-review.css:11`）、`.board-link-row`（按鈕橫排，可換行，`src/styles/shared-review.css:12`）、`.board-link input`（滿寬，`src/styles/shared-review.css:13`）。元件：`src/components/ShortlistBoard.tsx:228-235`。
- **什麼時候用**：要讓使用者複製一段連結或代碼的地方。
- **不能**：把連結做成可點的外部連結樣式（它是要複製的文字）；在這裡再包一層卡片。

### 2.13 審核連結頁（shared-*）

- **用途**：審核人打開 `/review/<token>` 看到的獨立頁面，等於經理審核欄搬到沒有側邊欄的一頁。
- **class**：`.shared-review`（整頁，`--bg` 底，`src/styles/shared-review.css:2`，元件 `src/components/SharedReviewPage.tsx:43`）、`.shared-ref`（參考影片列；有縮圖時為 76px 加內容兩欄，`src/styles/shared-review.css:3-4`，`src/components/SharedReviewPage.tsx:153`）、`.shared-answered`（已回覆提示，`--early-soft` 底，`src/styles/shared-review.css:5`，`src/components/SharedReviewPage.tsx:85`）、`.shared-card`（沿用 `.review-card`，不可點，`src/styles/shared-review.css:6-9`，`src/components/SharedReviewPage.tsx:152`）、`.review-stack`（卡片間距 `--space-2xl`，`src/styles/shared-review.css:10`，`src/components/SharedReviewPage.tsx:95`）。
- **什麼時候用**：只給免登入的審核連結頁；登入後的畫面用 `ReviewScreen`（`src/components/ReviewScreen.tsx:131`）。
- **不能**：在這一頁放側邊欄或要登入才有的資料；另寫一套按鈕或 chip（沿用 `.btn`、`.cchip`）。

### 2.14 頻道摘要（chan-*）

- **用途**：輸入一個頻道帳號，看它最近影片的格式、數據和 Top 3。
- **class**：`.channel`（整個畫面，格線，`src/styles/channel.css:2`）、`.chan-form`（輸入表單卡，最寬 760px，`src/styles/channel.css:3-8`，`src/components/ChannelScreen.tsx:209`）、`.chan-row` 與 `.chan-handle`（帳號欄加送出鈕，`src/styles/channel.css:9-10`，`src/components/ChannelScreen.tsx:224-225`）、`.chan-quota`（額度說明，`src/styles/channel.css:36`，`src/components/ChannelScreen.tsx:240`）、`.chan-progress` 與 `.step-mark`（進度步驟與進度條，`src/styles/channel.css:11-20`，`src/components/ChannelScreen.tsx:89`）、`.chan-result` / `.chan-section` / `.chan-summary`（結果，`src/styles/channel.css:21-22`，`src/components/ChannelScreen.tsx:121-134`）、`.chan-formats` 與 `.chan-format`（每種格式一張卡，含 `.chan-facts`、`.chan-top3`，`src/styles/channel.css:23-30`，`src/components/ChannelScreen.tsx:31-47`）、`.chan-videos` 與 `.chan-video`（影片列，`.chan-format-pill` 標格式，`src/styles/channel.css:31-35`，`src/components/ChannelScreen.tsx:62-69`）。
- **什麼時候用**：只用在頻道摘要畫面；卡片固定 `--surface` 底加 `--radius`，與 2.2 的卡片一致。
- **不能**：按鈕旁省略額度提示（這個動作會花抓取額度）；在 `.chan-*` 內寫死 gap 或 padding，已有對應 token 的一律用 `--space-*`。

### 2.15 同步提示（sync-note）

- **用途**：告訴使用者一般的同步狀況，例如「已合併另一個分頁的修改」，並提供「Retry」。這是中性的資訊提示，不是錯誤。
- **class / 元件**：`.sync-note`（橫排、可換行、`--radius-sm`、`--text-sm`，`src/styles/layout.css:117`），元件在 `src/App.tsx:891`，裡面的重試用 `.link-btn`（`src/App.tsx:893`）。
- **顏色**：用資訊／灰色系，`--surface-2` 底加 `--muted` 字，不用 `--no`（錯誤紅）。目前 `src/styles/layout.css:117` 仍寫 `--no-soft` / `--no`，由另一個修正改成中性色；改完後以此條為準。
- **什麼時候用**：非錯誤的同步訊息。真的失敗（儲存失敗、連不上）用 2.9 的 `.error`。
- **不能**：用錯誤色顯示一般提示。

## 3. 目前還沒收進 token 的檔案（只記錄，沒有改）

Task 1 只處理 `login.css`、`drawer-plan.css`、`approvals.css`、`layout.css`、`components.css`（計畫 Task 1 的 Files 清單）。以下檔案仍有寫死的色碼，數量用 `grep -c "#[0-9a-fA-F]\{3,6\}"` 統計（2026-10-31）：

| 檔案 | 寫死色碼的行數 |
|---|---|
| `src/styles/theme-altitude.css` | 39 |
| `src/styles/landing-remake.css` | 23 |
| `src/styles/search-results.css` | 12 |

這些是 Altitude 登入頁背景、落地頁和搜尋結果的樣式；日後動到它們時，再把數值換成 token。

## 4. 新增元件的流程

1. 先確認 1、2 節沒有可以用的 token 或元件。
2. 新樣式放進最接近的檔案：共用元件放 `src/styles/components.css`，只屬於某一畫面的放該畫面的樣式檔。
3. 數值全部讀 token；真的缺的 token 先加進 `src/styles/tokens.css`，且同步補深色值。
4. 把新元件的用途、使用時機、禁忌和 class 補進本文件。

## 5. 間距 token 的剩餘寫死值（2026-10-31）

`src/styles/channel.css` 與 `src/styles/shared-review.css` 的 gap、padding 已改用 `--space-*`。沒有同值 token 的保留原值：`.channel` 的 `gap: 22px`（`src/styles/channel.css:2`）、`.shared-review` 底部 `56px`（`src/styles/shared-review.css:2`），以及尺寸類（`.step-mark` 22px、`.bar` 高 6px、`.chan-video` 縮圖欄 96px、`minmax(260px/320px)`、`.tc-time` 96px、`outline: 2px`）；它們不是間距，也沒有對應 token。
