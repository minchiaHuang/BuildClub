# Trend Finder PRD

> 本檔是 Trend Finder 規格的正本；雲端版（https://claude.ai/artifact/MoURLkE4hAGvKHWu3kZskD ）只是 2026-10-27 的快照，之後以本檔為準。
> 來源：2026-10-27 雲端 PRD（rev 14，經 Claude Docs connector 讀取後轉成 markdown），範圍表與 API 表已於 2026-10-29 依 `docs/plans/2026-10-29-full-backend-coverage.md` 更新。

2026-10-27 · Tommy Huang（最後更新 2026-10-29）

## 摘要

Trend Finder 帶社群代理商從「現在什麼在紅」走到「客戶已批准、團隊拍得出來的計畫」。其他工具只停在一串爆紅影片清單。

我們和一位 design partner 一起做：[Mercif](https://www.mercif.com/) 的 Daphne。MVP 要在 2026/11/2（一）她的會議前能用；2026/11/7（六）在 Project Society Demo Day 展示。

核心規則是 Daphne 自己的：1,000 粉絲的帳號拿到 100 萬觀看（1,000 倍），代表點子本身好。工具找出這種影片並解釋它為什麼紅，但不替她寫腳本。**產品規則：AI explains why real videos went viral. It never writes scripts or generates content.**

## 決定（10/27）

| 決定 | 理由 |
| --- | --- |
| 申請 Project Society Demo Day，10/28 前交表單，附 PPT 和影片 | 評分看重 live demo；申請以 email 內容為準 |
| 產品就是 Trend Finder，專門為 Daphne 做 | 她是真實使用者，每週手動做 research 且討厭它 |
| 分工：隊友做前端，Tommy 做後端 | 前端已經可以點完整條流程 |
| 後端全部用 Python（FastAPI），取代 Node 版 | 前幾個 pivot 的可重用程式都是 Python；路由不變，前端不用改 |
| AI 模型用 Claude | clipkit 已有現成的呼叫範本 |
| 資料來源用 Apify（已有 key），每次搜尋上限 US$0.10 | 不自己寫爬蟲；硬上限防超支（後續數字見 `docs/decision-log.md`） |
| 在 `~/Desktop/BuildClub` 的 `feat/live-backend` 分支工作 | 前端原本跑在另一個 agent 的暫存資料夾，隨時會被清掉（現已改在 Orca worktree 工作，見 `AGENTS.md`） |
| MVP 期限：11/2（一）見客戶前 | 用真實客戶情境證明有用，而不是做完才問 |

10/27 之後的決定（花費上限、每帳號 6 支、拿掉平台切換、全功能後端化等）見 `docs/decision-log.md`。

## 使用者與問題

Daphne 在代理商 Mercif 管 10 個以上客戶的短影音。付錢和工具由 Annie 決定。以下來自 10/21 訪談。

她的流程：了解品牌 → **搜 IG 爆紅影片（痛點）** → 挑要模仿的，Annie 批准 → 拍攝 → 送剪輯師並附參考影片 → Daphne 再 Annie 審 → 先發 IG，再發 TikTok、Facebook、YouTube。

| 痛點 | 對產品的意義 |
| --- | --- |
| 「Research. I don't like research.」每個客戶手動搜 | 把她的規則（觀看 ÷ 粉絲）自動化 |
| 知道 Cila 但不想付月費 | 只做搜尋贏不了；要延伸到計畫和審批 |
| AI 「too robotic」，AI 寫的腳本觀看數更低 | AI 只分析真實影片，不寫內容 |
| 10+ 客戶追蹤不了（她最大的痛點） | 存到客戶、審批、每月進度 |
| 剪輯師拖稿，全部人要等 | 附截止日的清楚剪輯 brief |

訪談 6–7 人的綜合結論：沒有人想要 AI 替他們寫或生成內容。

## 目標與成功標準

這個月的 retro 指出，之前的 pivot 都是「做完才問客戶」。這次先定標準，再拿去給 Daphne 用。

**11/2（一）見 Daphne**

- [ ] 她用工具替一個真實客戶做 research，量出「原本 X 分鐘 → 用工具 Y 分鐘」
- [ ] 工具挑的前 10 支影片中，她會真的用幾支
- [ ] 拿她以前挑過的影片對比：工具會不會挑到同樣的
- [ ] 她同意試用 2–4 週，並介紹 Annie
- [ ] 問到一個價格訊號（和 Cila 的 US$24–48/月比）

**11/7（六）Demo Day**，對應四項評分：

| 評分項目 | 我們拿什麼打 |
| --- | --- |
| 實作難度 | 真資料、影片下載→抽影格→逐字稿→ Claude 拆解 |
| 功能性 | 現場 live demo 一分鐘內走完；釘住的快取防斷網 |
| 解釋清楚 | Daphne 的原話 + 1,000× 規則 |
| 原創性 | 真實 design partner；「AI 分析、不寫內容」 |

## 範圍

2026-10-29 使用者決定：前端每一個看得到的功能都由真的後端撐著（沒有假資料、沒有「Coming soon」、沒有只存在瀏覽器的業務資料）。下表「現況」是 2026-10-29 計畫開始時的狀態；「生效」欄標示完成該 Task 後才算做完（計畫：`docs/plans/2026-10-29-full-backend-coverage.md`）。

### 原 MVP 範圍（10/27，已做完）

| 功能 | 11/2 MVP | 11/7 Demo Day | 之後 |
| --- | --- | --- | --- |
| TikTok 關鍵字搜尋（真資料） | 做 | 做 | |
| 爆紅分數：觀看 ÷ 粉絲，依此排序 | 做 | 做 | 加上「觀看 ÷ 帳號中位數」（已做，每帳號最新 6 支） |
| Instagram 關鍵字搜尋 | 做 | 做 | 後端已支援；前端平台切換 10/28 暫時拿掉，Task 7 恢復 |
| AI 影片拆解：鏡頭清單、why it works、steal this | 做 | 做（demo 高潮） | |
| 客戶設定、收藏存在後端（SQLite） | 做 | 做 | 帳號登入（Task 9） |
| 釘住 demo 快取（離線可用） | 做 | 做 | |
| 送 Annie 審批 | 前端 mock | mock | 真的分享連結（Task 8） |
| Recreate 計畫、剪輯 brief | 前端 mock | 接 AI 拆解結果 | |
| 追蹤看板（已批准 → 拍攝 → 剪輯 → 發布） | | 只提 | 做（Task 14） |
| 「Ask」問答、貼連結／截圖搜尋 | | | 做（Task 10–12） |

不做：自寫爬蟲、AI 寫腳本、AI 生成影片、多代理商多租戶、Annie 的推播通知、手機 App。

### 全功能後端化（2026-10-29 起）

| # | 功能 | 現況 | 這次做成 | 生效 |
| --- | --- | --- | --- | --- |
| 1 | 本地規格文件 | PRD 只在雲端；decision-log 停在 10/27；README/AGENTS 過時 | `docs/PRD.md`、decision-log、README、AGENTS、STATUS 全部對齊現況 | Task 1 |
| 2 | Channel 樣式 | `.chip`、`.bar` 沒樣式；寫死圓角字級；沒空狀態 | 用共用 token 與元件 class，四套主題都對 | Task 2 |
| 3 | 新增客戶 | 按鈕停用「Coming soon」 | 側邊欄可新增客戶，存 `/api/clients` | Task 3 |
| 4 | 「拍得出來嗎」 | 真實影片永遠「We can't check this one」 | 拆解回傳 `needs`，舊拆解可補判 | Task 4 |
| 5 | 拆解 `lines` | 後端有、前端沒顯示 | 抽屜與規劃頁顯示每句的角色 | Task 4 |
| 6 | Trending now | 只存 localStorage | 存後端 `/api/pulses` | Task 6 |
| 7 | 多平台搜尋 | 只能選 TikTok | IG／YouTube／Reddit／X 都能選，結果合併並標平台 | Task 7 |
| 8 | Annie 審批 | 同一台瀏覽器預覽 | 分享連結 `/review/<token>`，不用登入，決定即時回到 Daphne 那邊 | Task 8 |
| 9 | 登入 | 假登入（localStorage），整站只有 Basic 密碼 | 真帳號（email＋密碼，HttpOnly session cookie） | Task 9 |
| 10 | 貼連結搜尋 | 「Link search isn't live yet」 | 貼影片連結 → 拆解 → 找同類影片 | Task 10 |
| 11 | 截圖搜尋 | 範本假資料 | 上傳截圖 → AI 讀圖 → 找同類影片 | Task 11 |
| 12 | Ask 回答 | live 模式不顯示（範本） | 根據真實結果的簡短回答（只解釋，不寫腳本） | Task 12 |
| 13 | 打字建議 | 只用範例格式 | 加上過去搜尋、pin、客戶主題 | Task 13 |
| 14 | 追蹤看板 | 沒有 | 已批准 → 拍攝 → 剪輯 → 發布，Overview 計數用「已發布」 | Task 14 |
| 15 | 範例資料殘留 | live 模式首裝帶 sampleIdeas、「Sample」標籤、landing 假計數器 | live 模式不出現任何範例資料或 sample 標籤，計數用 `/api/stats` | Task 5 |

Task 15 是 E2E 測試工具與全流程，Task 16 是付費冒煙測試（上限 US$0.50）與收尾。

## 使用流程

Demo 主線是第 1–5 步，目標一分鐘內走完。

1. **搜尋**：輸入關鍵字（例如「tofu」）。可篩 7 或 30 天、影片長度。不用先設定客戶。平台預設 TikTok；其他平台於 Task 7 後可選。
2. **結果**：每個平台一欄，依爆紅分數排序。卡片顯示觀看、粉絲、倍數、發布日。上方「重複出現的格式」（同一個音樂或 hashtag 在多個帳號紅）。
3. **影片拆解**：點進一支，AI 讀關鍵影格和逐字稿，給出鏡頭清單（例如「0–2 秒：俯拍油砸音，字卡『5 分鐘酷脆』」）、為什麼紅、「這個客戶拍得出來嗎」（Task 4 後對真實影片也能判斷）。
4. **存到客戶**：例如 Evergreen Foods。客戶的受眾、風格、限制只設定一次。
5. **送 Annie 審批**：Annie 對每個點子按通過或拒絕。目前是同一台瀏覽器預覽；Task 8 後是不用登入的分享連結（手機可用）。
6. **Recreate 計畫**：參考影片、鏡頭清單、道具、給剪輯師的備註和截止日。我們規劃，Daphne 拍。
7. **追蹤**：每個客戶一個看板，已批准 → 拍攝 → 剪輯 → 發布，加上每月影片數（Task 14）。

## 架構與技術決定

搜尋是同步的，快取命中就不花錢；AI 拆解要好幾分鐘，所以是背景工作，前端輪詢進度。

從前幾個專案搬進來的程式：

| 來源 | 用途 | 工作量 |
| --- | --- | --- |
| `reel-studio/tools/research.py`：`normalise()`、`score()`、`apify_run()` | IG/TikTok 統一格式、爆紅分數、Apify 花費上限 | 約 1 小時（花費上限已搬） |
| `brand-studio/style_analysis.py` | 下載、偵測剪接點、抽關鍵影格、逐字稿 | 2–4 小時 |
| `channel-decoder/docs/contract.md` + `clipkit/moments_claude.py` | 句子角色、why it works、steal this 的 schema 和 Claude 呼叫範本 | 半天 |
| `clipkit/jobs.py` | 單 worker 背景工作佇列 | 約 1 小時 |

不搬：Recite 的統計程式、brand-studio 的生成影片和配音。

技術約束（2026-10-29 全功能後端化計畫）：不新增 npm／pip 依賴（檔案上傳用 JSON base64、密碼雜湊用 `hashlib.scrypt`）；便宜的 AI 呼叫用 `claude-haiku-5-5`，拆解用 `claude-opus-5-5`；每個 AI 呼叫先過每日花費上限，結果快取，同一輸入第二次免費；後端測試全部離線。

## API 規格（前後端對齊）

前端經 Vite 把 `/api/*` 轉到後端（port 8787）。後端啟動後，`http://localhost:8787/docs` 是自動產生的完整文件；pydantic model 在 `backend/models.py`，是契約的單一來源。舊路由的路徑和回應形狀不變。

### 現有路由（已寫，Python）

| 端點 | 用途 |
| --- | --- |
| `GET /api/health` | 是否有真資料、支援哪些平台 |
| `GET /api/search?q=&platform=&fresh=&cachedOnly=` | 關鍵字搜尋（TikTok、Instagram、YouTube、Reddit、X），每支多 `ratio`、`platform`，依分數排序 |
| `POST /api/analyze`、`GET /api/analyze/{job}` | 送出影片網址開始 AI 拆解；查進度，完成後回傳 `shotList`、`why{hook, first3s, length, format, sound}`、`props`、`editorNotes`、`lines[]`（每句話的角色） |
| `GET/PUT /api/clients` | 客戶設定（整份陣列進出，存 SQLite） |
| `GET/PUT /api/ideas` | 收藏的點子和審批狀態（整份陣列進出） |
| `GET/PUT /api/library` | 前端影片／格式資料庫（供規劃頁與審批頁取影片） |
| `POST /api/channel`、`GET /api/channel/{job}`、`GET /api/channel/{job}/thumb/{name}` | 頻道總結（channel-decoder） |

### 新增路由（全功能後端化）

| 端點 | 用途 | 生效 |
| --- | --- | --- |
| `POST /api/needs` | 對已有拆解補判「這個客戶拍得出來嗎」所需條件（`Breakdown.needs`），結果寫回 `breakdown.json` | Task 4 完成後生效 |
| `GET /api/stats` | `{videosScanned, searches}` 真實計數，公開路由（landing 用） | Task 5 完成後生效 |
| `GET/PUT /api/pulses` | Trending now 存後端 | Task 6 完成後生效 |
| `POST /api/share`、`DELETE /api/share/{token}` | 為某客戶建立／關閉 Annie 分享連結 | Task 8 完成後生效 |
| `GET /api/review/{token}`、`POST /api/review/{token}/decide` | Annie 免登入檢視待審點子並按通過／拒絕 | Task 8 完成後生效 |
| `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me` | email＋密碼登入，HttpOnly session cookie（`tf_session`） | Task 9 完成後生效 |
| `POST /api/like`、`GET /api/like/{job}` | 貼影片連結 → 拆解 → 萃取關鍵字與格式名稱 | Task 10 完成後生效 |
| `POST /api/like-image` | 上傳截圖（JSON base64）→ AI 讀圖 → 關鍵字與格式名稱 | Task 11 完成後生效 |
| `POST /api/answer` | 根據真實搜尋結果回答 Ask（只解釋，不寫腳本） | Task 12 完成後生效 |
| `GET /api/suggest?q=` | 打字建議：過去搜尋、pin、客戶主題 | Task 13 完成後生效 |
| `SavedIdea.stage`、`postedAt`（沿用 `/api/ideas`） | 追蹤看板階段 | Task 14 完成後生效 |

Task 7（多平台搜尋）不改路由，只是前端用既有 `/api/search?platform=` 平行查多個平台。Task 9 生效後，除 `/api/health`、`/api/stats`、`/api/auth/login`、`/api/review/*` 與靜態檔外，所有 `/api/*` 需要有效 session。

### 欄位約定（10/27 對齊，仍有效）

前端以 `src/lib/live.ts` 為主要呼叫層。

| 端點 | 後端回傳 | 前端 |
| --- | --- | --- |
| `GET /api/search?platform=instagram` | 和 TikTok 相同的影片欄位，每支多 `platform` | `toVideo` 讀 `item.platform` |
| `POST /api/analyze {url}` → `{job}`；`GET /api/analyze/{job}` → `{status, progress, result}` | `result` 直接對應 `Format` 欄位，另加 `lines[]` | `analyze()` 加輪詢，結果合併進 live formats |
| `GET/PUT /api/clients`、`GET/PUT /api/ideas` | 整份陣列進出，存 SQLite | `useRemote(key, initial)`，後端沒開時退回 localStorage |

ideas 用整份 PUT，因為前端本來就整份 `setIdeas`。代價是兩台電腦同時編輯會互相覆蓋；Task 8 起，後端在 PUT 時保留較新的 Annie 決定，避免 Daphne 的舊分頁蓋掉審批結果。

## 時程與分工（歷史）

| 日期 | Tommy（後端） | 隊友（前端） |
| --- | --- | --- |
| 10/27（二）晚 | Python API（搜尋、爆紅分數、花費上限、釘住快取），「tofu」實測 | 繼續前端 |
| 10/28（三） | 申請日：storyboard、shot list、錄影片（60–90 秒）、PPT（沿用 CookPilot 骨架）、送表單 | 同左 |
| 10/29–10/30 | IG 搜尋、AI 影片拆解整條流程、背景工作；全功能後端化（見計畫） | 接 `/api/analyze` 到拆解面板 |
| 10/31–11/1 | 客戶和收藏改存 SQLite；用真實客戶情境走一遍、修 bug | 接 `/api/clients`、`/api/ideas` |
| 11/2（一） | 見 Daphne，現場操作、量時間 | 同左 |
| 11/3–11/6 | 依 Daphne 回饋修正；把她的前後時間放進 PPT；排練 live demo | 同左 |
| 11/7（六） | Demo Day 12:30–16:30 | 同左 |

## 競品與定位

跨平台關鍵字搜尋已經有人做，所以不是我們的差異。差異在搜尋之後：客戶、審批、拍得出來的計畫。價格來自各家官網，10/26 查的（詳見 repo `market/trend-research-competitors.md`）。

| 產品 | 價格 | 做什麼 | 缺什麼 |
| --- | --- | --- | --- |
| [Cila](https://cila.app/) | US$24/月（50 個帳號） | 以追蹤帳號為主 | 沒有客戶流程、審批、計畫 |
| Mysocial Outliers | US$49/月 | 關鍵字搜 TikTok、IG、YouTube、X、Threads，有 fit 分數 | 同上 |
| Virlo | US$49/月 | 爆紅影片搜尋 | 同上 |
| **Trend Finder** | 試用期免費 | 搜尋 + AI 拆解 + 客戶 + 審批 + 剪輯 brief | 還在做 |

被問「為什麼不用 Cila？」的回答：Cila 給你一串影片；我們給你一個客戶已批准、剪輯師看得懂的計畫。

## 風險與未決問題

| 風險 | 影響 | 對策 |
| --- | --- | --- |
| Apify 的 IG 關鍵字搜尋沒驗證過（reel-studio 只用過「依帳號抓」） | IG 是 Daphne 的主要平台 | 10/29 先花一次小額實測；不行就改用 hashtag 搜尋 |
| 影片分析要好幾分鐘 | 現場 demo 卡住 | 背景工作 + 進度輪詢；demo 用預先分析好的影片 |
| 場地 WiFi 掛掉（CookPilot 發生過） | demo 失敗 | 釘住快取 + 手機熱點備援 |
| 代理商可能不付錢 | 沒有商業模式 | 向 Annie 問價格訊號 |
| 抓 TikTok/IG 公開資料的條款 | 對外上線的法律風險 | 目前只供內部測試；上線前查條款 |

未決問題：

- [ ] 工具是給代理商，還是給自己拍片的創辦人？（決定要問 Daphne 什麼）
- [ ] Trend Finder 是黑客松小專案，還是新的主方向？（repo 的 `PROJECT_CONTEXT.md` 還沒改）
- [ ] demo 快取的資料要不要 commit，讓全隊的電腦都能離線 demo？
- [ ] 第一個畫面先搜關鍵字，還是先選客戶？（目前：關鍵字優先）
