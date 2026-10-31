# Remake 第二階段範圍說明：拍攝與剪輯

- 日期：2026-10-31
- 狀態：範圍已確認（2026-10-31）：做 2a 到 2c，只用實拍。尚未實作。
- 線上版：https://claude.ai/artifact/QNTYDy4dDgmNYwfE7HGrus
- 盤點對象：
  - reel-studio @ 0d91fd7（`/Users/tommy/Desktop/Projects/reel-studio`）
  - brand-studio @ dab3725（`/Users/tommy/Desktop/brand-studio`）
  - Remake `feat/remake-e2e` @ c888b1a
- 路徑寫法：除非另外註明，路徑都相對於各自專案的根目錄。Remake 的根目錄是 `pivots/02-content/app/trend-finder/`。

## 1. 建議範圍

**結論：第二階段先做「拍攝進度與實拍素材」。剪輯只搬不需要新套件的 ffmpeg 步驟。AI 生成影片、AI 配音、動畫字幕全部延後。**

理由：

- **製作階段欄位已經存在。** Remake 後端有 `stage` 欄位（approved → filming → editing → posted），但前端完全沒用到（`backend/models.py:105-106`）。產品計畫也把它列成「Track (later)」看板（`research/hackathon-plan-trend-tool.md:29`）。
- **ffmpeg 這條路不用加套件。** Remake 已經透過 subprocess 呼叫 ffmpeg、yt-dlp 和 whisper.cpp（`backend/analyze.py:25, 73, 91`）。reel-studio 的 `tighten.py`、`compose.py`、`finish.py` 也只用標準函式庫加 ffmpeg。
- **其餘都要付費或加套件。** AI 生成、配音、動畫字幕不是要付費 API（OpenRouter Veo、ElevenLabs），就是要新套件（Pillow、Playwright、faster-whisper）。這些每一項都要使用者另外核准。

三個階段：

1. **2a 製作看板**：已核准的 plan 可以標記為拍攝中、剪輯中或已發佈。這一步不搬任何程式。
2. **2b 實拍素材**：每個鏡頭可以上傳實拍、選定 take。做法參考 brand-studio 的 shots 流程，改寫成 React + FastAPI + SQLite。
3. **2c 粗剪**：去靜音、合成、加速、loudnorm。改寫 reel-studio 的 ffmpeg 工具，做成後端工作（job）。

## 2. 盤點結果

| 項目 | reel-studio | brand-studio |
| --- | --- | --- |
| 用途 | 自己拍片、AI 幫忙做 IG Reels 的管線（`README.md:3-5`） | 幫商家做品牌短影片：輸入網址 → 品牌分析 → 拍攝或 AI 生成 → 剪輯 → 發佈（`AGENTS.md:3-9`） |
| 型態 | CLI 加 `.claude/skills`，沒有 web app，也沒有資料庫 | FastAPI（約 90 條路由）加 Next.js 16 |
| 拍攝相關 | `ig-film-prep` skill 產生拍攝指南；實拍是人工放進 `pipeline/3-film/` | 上傳實拍、選 take 或重抽 take、核准（`api/shots_routes.py:180-287`）；分鏡逐格核准（`api/storyboard_routes.py:101-138`） |
| 剪輯相關 | `tools/tighten.py`、`compose.py`、`finish.py`、`captions.py`、`render_anim.py`、`qa_captions.py` | `brand_studio/edit.py`、`final_cut.py`（ffmpeg）；`api/edit_routes.py:193-457`；`subtitle.swift` 只能在 macOS 上跑 |
| 相對 Remake 的新套件 | faster-whisper、Pillow、Playwright 加 Chromium、PyYAML、GSAP（`requirements.txt:1-7`） | Next.js、next-auth、Tailwind、httpx |
| 付費服務（只列名稱） | Apify `APIFY_TOKEN`，只用在研究（`tools/research.py:301`） | ScrapeCreators、OpenRouter（Veo 3.1 Lite）、ElevenLabs、TypeSafe Jev、Google 登入 |
| 儲存方式 | 全部是檔案（`pipeline/1-ideas` 到 `5-renders`） | JSON 檔加媒體目錄；run 和剪輯狀態只存在記憶體，重開就沒了 |
| 測試 | 35 個單元測試，2026-10-31 實跑全過；但全部在測 research，媒體工具沒有測試 | 約 57 個 Python 測試檔加約 40 個 Playwright spec；最後一次 GREEN 是 2026-10-19，這次沒重跑 |
| git 狀態 | 乾淨 | 已追蹤檔沒有改動；有 4 個未追蹤檔（`.archify/`、`.orca/`、`s86.png`、`web/AGENTS.md`） |
| 已知缺口 | 品牌設定只做到第 1 題；`transcribe.py` 可能有 PyAV 問題（`docs/STATUS.md:11-22`） | Kling 和 Flow 只有 stub；390px 寬度下除了首頁都跑版；小助手剪輯是 mock |

Remake 這邊的對照點：

- plan 就是 `SavedIdea`。鏡頭存在 `idea.shots`，每筆是 `{time, shot, text}`（`backend/models.py:75-78`）。
- plan 核准後，PlanScreen 只有一個「Copy brief for editor」按鈕（`src/components/PlanScreen.tsx:84-100`）。
- `publications` 要求 plan 必須是 approved（`backend/publishing.py:109`）。
- 執行期依賴：前端只有 react 和 react-dom；後端是 fastapi、uvicorn、anthropic。

## 3. 分類

| 功能 | 來源 | 類別 | 接在 Remake 的哪裡、需要做什麼 |
| --- | --- | --- | --- |
| 字幕 QA | reel `tools/qa_captions.py` | 可直接搬 | 只用標準函式庫，但要等字幕功能做好才用得到 |
| 製作階段看板 | Remake 自己的 `stage` 欄位 | 需改寫（小） | 前端型別要加上 `stage`；`merge_ideas`（`backend/share.py:39`）不能吃掉這個欄位，但函式內容還沒讀 |
| 拍攝清單 | reel `ig-film-prep`；Remake 的 Copy brief | 需改寫 | 把純文字 brief 改成逐鏡頭的清單，資料來自 `idea.shots` |
| 逐鏡頭上傳、選 take | brand `api/shots_routes.py:180-287` | 需改寫 | 它用 raw body 讀上傳內容（`_read_capped`，`:38`），不需要 python-multipart；要把 JSON 改成 SQLite，把 Next 改成 React |
| 去靜音 | reel `tools/tighten.py` | 需改寫 | 要改接 whisper.cpp 拿逐字時間戳（**猜測**：還沒確認 whisper.cpp 給得出來，要先試） |
| 合成、加速、配樂、loudnorm | reel `compose.py`、`finish.py` | 需改寫 | 包成後端工作，沿用 analyze 的輪詢模式（`server.py:859, 871`） |
| 剪輯時間軸 | brand `edit.py`、`final_cut.py` | 需改寫 | 和 reel 重疊，兩邊只選一個；建議用 reel（**推論**：它是 CLI，比較好拆） |
| 分鏡逐格核准 | brand `storyboard_routes.py` | 需改寫 | Remake 已經有審閱連結，只缺「核准成品」這一步 |
| 卡拉 OK 字幕 | reel `captions.py` | 需新依賴 | Pillow |
| 逐字轉錄 | reel `transcribe.py` | 需新依賴 | faster-whisper（建議先試 whisper.cpp） |
| GSAP 動畫 | reel `render_anim.py` | 需新依賴 | Playwright 加 Chromium、GSAP |
| AI 生成鏡頭 | brand `generator.py` | 需付費 | `OPENROUTER_API_KEY` |
| AI 配音 | brand `voice.py` | 需付費 | ElevenLabs；備用方案 `say` 只能在 macOS 用 |
| 影片／劇本分析 | brand `analysis_jobs.py`、`jev.py` | 不適合 | 和 Remake 的 `/api/analyze` 重複，而且要付費 |
| 趨勢抓取 | reel `research.py`；brand `trending*.py` | 不適合 | 和 Remake 的搜尋重複；Apify 額度快用完 |
| macOS 字幕燒錄 | brand `subtitle.swift` | 不適合 | 只能在 macOS 跑 |
| Next 前端、next-auth | brand `web/` | 不適合 | Remake 用 Vite，也已經有自己的登入 |
| Kling、Flow、小助手剪輯 | brand | 不適合 | 只有 stub 或 mock |

## 4. 順序

每個階段開一個 PR，前一個合併、使用者也確認後，才開下一個。三個階段都不加新套件，也不發付費呼叫。

1. **2a 製作看板**
   - 做什麼：前端 `SavedIdea` 加上 `stage` 和 `postedAt`；Plans 列表按階段分欄，並顯示每月完成數。
   - 完成條件：
     - 重新整理頁面後階段還在。
     - 審閱連結看不到階段。
     - 不是 approved 的 plan 不能設定階段。
     - `bin/verify.sh` GREEN，e2e 在 1440 和 390 兩種寬度都通過。
2. **2b 拍攝清單與實拍上傳**
   - 做什麼：把 Copy brief 升級成逐鏡頭的拍攝清單。每個鏡頭可以傳多個 take，再選定一個。檔案放在媒體目錄，紀錄存 SQLite。
   - 完成條件：
     - 上傳有大小上限和格式檢查。
     - 套用帳號權限。
     - 重開後資料還在。
     - 有單元測試和 e2e。
3. **2c 粗剪**
   - 做什麼：把選定的 take 照鏡頭順序接起來，做去靜音、加速、loudnorm，輸出可預覽的 MP4。用後端工作執行，前端輪詢進度。
   - 完成條件：
     - 有用小段測試影片比對的黃金檔測試。
     - 沒裝 ffmpeg 時給出清楚的錯誤訊息。
     - 不發任何網路呼叫。

**不在第二階段**：字幕、動畫、AI 生成鏡頭、AI 配音、發佈到各平台。發佈目前只是 stub（`backend/publishing.py:1-2`）。

## 5. 需要核准的依賴與費用

2a 到 2c 都不需要核准任何東西。ffmpeg 和 whisper.cpp 已經是 Remake 要求的系統程式（`analyze.py:2, 25`）。以後如果擴大範圍，下列每一項都要單獨核准：

| 項目 | 類型 | 解鎖的功能 | 費用 |
| --- | --- | --- | --- |
| Pillow | Python 套件 | 卡拉 OK 字幕 | 免費 |
| faster-whisper（含 ctranslate2、PyAV、模型檔） | Python 套件 | 逐字轉錄 | 免費；模型檔大小沒核實 |
| Playwright 加 Chromium、GSAP | 套件加瀏覽器 | GSAP 動畫 | 免費；GSAP 授權沒核實 |
| OpenRouter（Veo 3.1 Lite） | 付費 API | AI 生成鏡頭 | 單價沒核實 |
| ElevenLabs | 付費 API | AI 配音 | 單價沒核實 |

## 6. 風險

- **影片檔放哪裡還沒定。** 要決定放在哪、保留多久、部署環境有沒有永久磁碟。部署環境還沒查。
- **8805 的資料會消失。** 一停止就刪掉暫存目錄，上傳的檔案也會跟著沒了，所以只適合試用。
- **whisper.cpp 的逐字時間戳可能不夠準（猜測）。** 如果不夠，就要考慮改用 faster-whisper。
- **媒體工具沒有測試。** 搬過來時要自己補。
- **版權。** 配樂和參考影片的片段都不能出現在成品裡。reel-studio 已經把別人的 frames 排除在 git 外（`.gitignore:30-31`）。
- **起點分支要等 PR #4。** 從哪個分支開工，要看 11/1 測試後 PR #4 有沒有合併。

## 7. 待使用者決定

- [x] **已決定（2026-10-31）：範圍就是 2a 到 2c。** 第二階段的範圍就是 2a 到 2c 嗎？還是只做 2a，先讓 Daphne 試用？
- [x] **已決定（2026-10-31）：只用實拍。** 只用實拍、完全不碰 AI 生成嗎？產品計畫寫的是「We plan it; Daphne films it」（`research/hackathon-plan-trend-tool.md:28`）。
- [ ] 剪輯要做到哪裡：只交粗剪給剪輯師，還是直接出可以發佈的成品？
- [ ] Annie 要不要也透過審閱連結核准成品？
- [ ] 影片檔要放本機磁碟，還是放雲端儲存？
- [ ] 交接檔提到「設計文件 §2 non-goals」，但在 remake-e2e 的已追蹤文件裡找不到。可能在 blenny 未追蹤的 specs 裡，我照交接檔的指示沒有去動。

## 8. 來源與查核

- 盤點由三個唯讀的 Sonnet 子代理在 2026-10-31 完成。過程中沒有改任何檔案、沒有讀 `.env`、也沒有發付費呼叫。
- 以下是親自查核過的：
  - `stage` 欄位
  - Remake 的依賴清單
  - `analyze.py` 呼叫的外部工具
  - reel 三個 ffmpeg 工具的 import
  - brand 上傳端點和 `_read_capped`
  - 產品計畫第 28-29 行
  - Remake 後端沒有 `UploadFile`／multipart
- 其他 path:line 都出自子代理的報告，沒有逐條複查。
