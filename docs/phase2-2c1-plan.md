# Remake 2c-1 剪輯工作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 已核准的 plan，每個鏡頭都選定 take 之後，PlanScreen 上按一個鈕，後端把 take 接起來、去靜音和贅字、加速、（選用）混入使用者自己上傳的配樂、兩段式 loudnorm，輸出一支可發佈的 9:16 MP4（無字幕、無動畫）。前端輪詢進度，完成後可預覽和下載。重開伺服器後成品還在。

**Architecture:** 兩個新後端模組。`backend/cutting.py` 放所有純函式（whisper JSON 轉接、保留區間計算、filtergraph 字串、atempo 串、loudnorm 解析）和 subprocess 步驟（ffprobe、ffmpeg、whisper-cli），完全不碰資料庫。`backend/renders.py` 跟 `takes.py` 一樣是 `make_router(db, load, media_dir)`，另外放 `RenderJobs`（單一 worker thread，仿 `analyze.Jobs`，`analyze.py:198-248`），工作狀態存在 SQLite，這樣重開後查得到。成品放 `backend/media/<ideaId>/cut/final.mp4`。前端新增 `src/lib/cut.ts` 和 `src/components/CutPanel.tsx`，掛在 `ShotChecklist` 下方（`PlanScreen.tsx:308`）。

**Tech Stack:** FastAPI、SQLite、pytest；subprocess 呼叫 ffmpeg 9.0.2（本機實測）、ffprobe、whisper-cli 1.9.5；React 19 + TypeScript；`node --test unit/`。

**Spec:** `docs/phase2-scope.md` §4 第 3 項的 2c-1、§6 whisper 查核結果、§7。參考來源（唯讀）：reel-studio `tools/tighten.py`、`tools/finish.py`。2c-2（Annie 在 `/review/<token>` 核准成品）不在這份計畫，只列在最後當後續。

**分支／worktree：** `feat/remake-rough-cut`，worktree 在 `/Users/tommy/orca/workspaces/BuildClub/remake-rough-cut`，起點 fork main @ 4277192（2b 已合併，PR #6）。PR 開到 fork（minchiaHuang/BuildClub），base 是 `main`。

除非另外註明，以下路徑都相對於 `pivots/02-content/app/trend-finder/`。

## Global Constraints

- 不加任何依賴（Python 或 npm），不發網路呼叫，不用付費 API。只用標準函式庫加 subprocess 呼叫 `ffmpeg`、`ffprobe`、`whisper-cli`。
- 不要動 8805、8787、8801、5195、8798 這幾個 port。e2e 的後端用其他空的 port，例如 8813。
- 不要讀 `.env`。介面文字用英文，跟現有 UI 一致。
- 所有新路由都放在 `/api/ideas/{id}/...` 底下。`needs_session` 對 `/api/` 預設要求登入，只有 `PUBLIC_API` 和 `/api/review/` 例外（`server.py:132-145`），所以不需要新增規則，審閱連結也看不到成品。
- 帳號權限：現有程式只有「有沒有登入」這一層，沒有每個帳號各自擁有的 plan（`takes.py` 沒有任何 user 檢查；`SavedIdea` 只有 `clientId`，`models.py:75-78` 附近）。2c-1 沿用這一層，不新增帳號層級。
- 成品目標規格（`cutting.OUTPUT`）：H.264（`libx264 -crf 18 -preset medium`）、`yuv420p`、1080x1920、固定 30 fps、AAC 192 kbps 48 kHz 立體聲、`-movflags +faststart`。
- 響度目標沿用 reel-studio `finish.py`：`I=-13 TP=-1.5 LRA=11`，兩段式，第二段 `linear=true`。這是 reel-studio 的選擇，不是平台規定。
- 平台限制（Instagram／TikTok 的長度、檔案大小、建議位元率）**未驗證**，本計畫不把它們當事實，也不在程式裡檢查。
- 錯誤訊息（前後端一致）：
  - 503 缺 ffmpeg：`"ffmpeg isn't installed on this computer, so the cut can't be made. Install it (brew install ffmpeg) and try again."`
  - 503 缺 whisper：`"whisper.cpp or its model wasn't found (looked for /opt/homebrew/bin/whisper-cli and ~/models/ggml-large-v3-turbo-q5_0.bin), so the cut can't be made."`
  - 409 plan 未核准：`"Only an approved plan can be cut."`
  - 409 缺 take：`"Choose a take for shot 3 first."`（列出第一個缺的鏡頭，1 起算）
  - 409 已有工作：`"A cut is already being made for this plan."`
  - 409 磁碟不足：`"There isn't enough free disk space to make the cut."`
  - 413 配樂：`"The music file is over the 30 MB limit."`；415：`"Upload an .mp3, .m4a or .wav audio file."`
  - 422 沒勾授權：`"Confirm you own this music or have the license to use it."`
  - 重開機中斷：`"The server restarted while this was being made. Make it again."`

### 我做的預設決定（每項附理由，使用者可否決）

| 項目 | 預設 | 理由 |
| --- | --- | --- |
| 比例處理 | scale 到蓋滿 1080x1920，再置中裁切（使用者 2026-10-31 改定） | 黑邊在 Reels 上看起來像沒做完，和「可發佈」衝突；直式素材（預期的主要情況）不受影響 |
| 靜音門檻 | 兩字之間的空白 > 0.4 s 才剪；每側保留 0.12 s | 沿用 `tighten.py` 的數字，是有真實影片驗證過的起點 |
| 靜音偵測 | `silencedetect=n=-35dB:d=0.15`，用來修正字尾 | scope §6 實測：whisper 字尾會吞掉後面的靜音（「um」晚了約 0.3 s），字首準確（約 30 ms） |
| 贅字表 | 只含英文 `um, umm, uh, uhh, er, erm, hm, hmm` | 「um」已實測會被轉錄。`ah`、`like` 是正常字，不剪。中文贅字（嗯、呃）**未驗證** whisper 會怎麼轉錄，所以不放進去，免得誤剪正文 |
| 語言 | `-l auto` | Remake 的 `analyze.py:127` 已經這樣用；但 `auto` 加 `-ml 1` 沒實測過（測試用的是 `-l en`），列在風險 |
| 加速 | 預設 1.1 倍，選項 1.0（關）、1.1、1.25 | 人聲在 1.25 以內聽起來仍自然；預設 1.1 讓這個步驟有作用又不明顯。atempo 串自動拆成每段 0.5–2.0 |
| 區間接縫 | 每個接縫 12 ms 淡出／淡入 | `tighten.py` 是硬切，可能有爆音 |
| 配樂 | 每個 plan 最多 1 個檔，30 MB，`.mp3/.m4a/.wav`，音量 0.25，淡入淡出各 1.2 s，不夠長就循環 | 數字照 `finish.py`；30 MB 夠 3 分鐘以上的 mp3；必須勾授權才能上傳，伺服器記下勾選時間 |
| 並行 | 全站同一時間只跑 1 個工作，同一 plan 同時只能有 1 個 | whisper 和 x264 都吃滿 CPU；仿 `analyze.Jobs` 的單 worker |
| 輸入上限 | 選定 take 的總長 ≤ 10 分鐘 | 限制執行時間和磁碟；Reels 本身是短片，超過多半是選錯檔 |
| 成品位置 | `backend/media/<ideaId>/cut/final.mp4`，工作檔在 `cut/work/`，結束（成功或失敗）就刪 | 跟 2b 一樣用本機磁碟（scope §7 已決定） |
| 重跑 | 新工作成功後才把 `final.mp4` 換掉（先寫 `cut/work/next.mp4`，驗證通過後 `os.replace`）；新工作失敗時舊成品保留（使用者 2026-10-31 改定） | 重剪失敗時 Daphne 手上還有能用的版本；只多佔一份成品的磁碟 |
| 過期偵測 | 紀錄存 `signature`（選定 take id 依序、速度、配樂 id 的雜湊）；GET 回 `stale` | 換了選定的 take 後，舊成品不會被當成最新 |
| 保存 | 不自動清理；重跑會覆蓋；刪 plan 的路由還不存在，所以沒有清理 | 跟 2b 一致 |
| 磁碟檢查 | 開始前要求可用空間 ≥ 4 倍選定 take 總大小 | 中間檔 1080x1920 CRF 18 加 PCM 音訊可能比原檔大，倍數是估計，**未驗證** |

## 資料模型與 API

SQLite（schema 跟 `takes.SCHEMA` 一樣加進 `server.db()`，`server.py:668`）：

- `renders(idea_id TEXT PRIMARY KEY, status TEXT NOT NULL, progress REAL NOT NULL, step TEXT NOT NULL, error TEXT, speed REAL NOT NULL, signature TEXT NOT NULL, size INTEGER, duration REAL, started_at INTEGER NOT NULL, finished_at INTEGER)`。一個 plan 最多一列。
- `cut_music(idea_id TEXT PRIMARY KEY, id TEXT NOT NULL, ext TEXT NOT NULL, name TEXT NOT NULL, size INTEGER NOT NULL, licensed_at INTEGER NOT NULL)`；檔案放 `media/<ideaId>/cut/music-<id>.<ext>`。

狀態：`queued → running → done | failed`。進度 0–1 加一行 `step` 文字。里程碑：Checking the takes 0.02、Joining the takes 0.10、Listening for words 0.15（whisper 最久，之後停在這一步直到完成）、Finding silences 0.50、Measuring the sound 0.60、Rendering 0.65→0.95（由 ffmpeg `-progress pipe:1` 的 `out_time` 算）、Checking the result 0.97、Done 1。

| 方法 路徑 | 認證 | 請求 | 回應 |
| --- | --- | --- | --- |
| `GET /api/ideas/{id}/cut` | 登入 | 無 | `CutState`：`{status: "none"\|"queued"\|"running"\|"done"\|"failed", progress, step, error?, speed, stale, music: {name,size}\|null, output?: {url, size, durationSec}}`；`output` 是上一次成功的成品，`queued`／`running`／`failed` 時也可能有；plan 不存在回 404 |
| `PUT /api/ideas/{id}/cut/music` | 登入 | raw body，Content-Type 為 `audio/mpeg`、`audio/mp4`、`audio/wav`（或 `audio/x-wav`）；header `X-Filename`、`X-License-Confirmed: yes` | `CutState`；取代舊檔 |
| `DELETE /api/ideas/{id}/cut/music` | 登入 | 無 | `CutState` |
| `POST /api/ideas/{id}/cut` | 登入 | JSON `{shotCount: int, speed: 1.0\|1.1\|1.25}` | 202 加 `CutState`（`queued`） |
| `GET /api/ideas/{id}/cut/file` | 登入 | 可加 `?download=1` | `FileResponse`（支援 Range，`<video>` 可拖曳），`video/mp4`；加 `download=1` 時帶 `Content-Disposition: attachment; filename="remake-<id>.mp4"` |

- `shotCount` 由前端傳入（它顯示的鏡頭數），因為 `idea.shots` 可以是空的，此時畫面用的是 `format.shotList`（`PlanScreen.tsx:53`），後端不知道實際鏡頭數。後端檢查 `0 <= i < min(shotCount, 50)` 每個 index 都有 `chosen` 的 take（2b 的 `takes` 表）。
- 音樂上傳、刪除、開始工作都要求 plan 是 approved（跟 2b 一致），而且該 plan 沒有進行中的工作。重開 plan 之後成品保留、介面唯讀。
- **重開伺服器：** 啟動時把 `queued`／`running` 的列改成 `failed`，`error` 填「重開機中斷」那句，並刪掉 `cut/work/`。不自動續跑。`recover()` 放在 FastAPI `lifespan`（`server.py:115` 目前是 `FastAPI(title=...)`，沒有 lifespan；grep 沒找到 `on_event` 或 `lifespan`），不能放在 import 時，否則測試匯入 `server` 會改到真的 `data.db`。`TestClient` 不加 `with` 就不會觸發，測試直接呼叫 `renders.recover(db)`。
- 工作失敗時 `error` 放給人看的一句話；`print(f"[render] {id} failed: ...")` 寫完整訊息到 log，仿 `analyze.py:245`。

## Review Focus

1. **缺 ffmpeg／whisper 時不能靜默失敗。** `analyze.transcribe` 在缺 whisper 時直接回 `[]`（`analyze.py:121-122`），那對「分析」是可接受的降級，對剪輯不行：會悄悄交出沒去靜音的成品。→ Task 4 `test_missing_tools_503`、Task 2 `test_missing_whisper_is_an_error`。
2. **切點在字的中間。** 字尾不可信（scope §6）。→ Task 1 property test：每個非贅字的字，內部都在保留區間裡。
3. **贅字誤剪正常字、整支被剪光。** → Task 1 `test_filler_list_only_cuts_listed_words`、Task 2 `test_no_words_keeps_everything`。
4. **重開機和重跑。** `running` 的列不能永遠卡住；重跑成功才替換舊成品，失敗時舊成品還在；工作檔一律清掉。→ Task 4 `test_restart_marks_running_failed`、`test_rerun_replaces_old_output`。
5. **爆音與雙重編碼。** 影片只編碼兩次（中間檔、成品），音訊只有一次有損編碼（AAC）。→ Task 2 的 ffprobe 斷言和 Task 1 的 filtergraph 字串測試。
6. **成品規格。** 解析度、fps、編碼、像素格式、響度都用 ffprobe／ebur128 驗證，不比位元組。→ Task 2、Task 3。

---

### Task 1: 純函式 `backend/cutting.py`（不需要任何外部程式）

**Files:**
- Create: `backend/cutting.py`
- Create: `backend/tests/fixtures/whisper_words.json`（手寫，形狀照 scope §6 查核結果：`transcription[]`、每筆 `offsets.from/to`（毫秒）、`text` 前面有空白、小寫、無標點；另外加一筆 `[_BEG_]` 和一筆空字串，測試轉接器會丟掉。**不是真人錄音的輸出**）
- Test: `backend/tests/test_cutting.py`

**Interfaces — Produces:**
- `Word = tuple[float, float, str]`（start, end, text，秒）。
- `parse_words(data: dict) -> list[Word]`：丟掉空字串和 `[...]`／`(...)` 標記，`strip()`，依 start 排序。
- `is_filler(text: str) -> bool`：小寫、去掉標點後在 `FILLERS` 裡。
- `keep_intervals(words, silences, total, *, keep=0.12, min_gap=0.4) -> list[tuple[float, float]]`：`silences` 是 `[(start, end)]`（silencedetect）。做法：每個字的有效字尾 = 落在字範圍內、且延伸到字尾的最早靜音起點，否則 `min(end, 下一字起點)`；移除集合 = 贅字（起點到有效字尾）加每個 > `min_gap` 的空白（首尾也算）去掉兩側 `keep`（貼著贅字的那一側不留 `keep`，因為贅字本身要整個去掉）；合併相鄰；取補集；丟掉 < 0.08 s 的碎片。沒有任何字時回 `[(0, total)]`。
- `atempo_chain(speed: float) -> str`：`1.1 → "atempo=1.1"`，`2.5 → "atempo=2.0,atempo=1.25"`，`1.0 → ""`。
- `output_duration(keeps, speed) -> float`。
- `build_join_graph(takes: list[dict]) -> str`：每個 take 一段，`{hasAudio: bool, duration: float}`；影片 `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p`；音訊 `aresample=48000,aformat=channel_layouts=stereo`，沒有音訊的 take 用 `anullsrc=r=48000:cl=stereo` 切到該長度；最後 `concat=n=N:v=1:a=1`。
- `build_cut_graph(keeps, speed, *, music: bool, audio_only: bool, loudnorm: dict | None) -> str`：每段 `trim/atrim` 加 `setpts=PTS-STARTPTS`，音訊每段 `afade=t=in:d=0.012,afade=t=out:st=<len-0.012>:d=0.012`，`concat`，再 `setpts=PTS/S` 與 `atempo` 串；有配樂時 `[1:a]atrim=0:<out>,volume=0.25,afade in/out 1.2` 後 `amix=inputs=2:duration=first:normalize=0`（`out = output_duration`）；最後 `loudnorm`：`loudnorm` 為 `None` 時是第一段（`print_format=json`），否則帶 `measured_I/TP/LRA/thresh`、`offset`、`linear=true`；結尾 `aresample=48000`。
- `parse_loudnorm(stderr: str) -> dict`：取 stderr 最後一個 `{...}`，回 `input_i, input_tp, input_lra, input_thresh, target_offset` 的 float。
- `parse_silences(stderr: str) -> list[tuple[float, float]]`：解析 `silence_start`／`silence_end` 行；結尾沒 end 的補 `total`。
- `parse_progress(line: str, total: float) -> float | None`：`out_time_us=…` 轉成 0–1。
- `missing_tools() -> str | None`：`shutil.which("ffmpeg")`、`which("ffprobe")` 不在回對應的 503 文案；`Path(analyze.WHISPER).is_file() and analyze.MODEL.is_file()` 否則回 whisper 文案。**執行時才讀** `analyze.WHISPER`／`analyze.MODEL`（`analyze.py:25-26`），測試才能 monkeypatch。

- [ ] **Step 1: 寫失敗的測試** `backend/tests/test_cutting.py`（測試檔頂端 `import cutting`，不需要 ffmpeg）。

```python
W = [(0.0, 1.0, "hello"), (1.0, 1.6, "um"), (2.9, 3.5, "world")]   # "um" really ends at 1.3
SIL = [(1.3, 2.9)]

def test_parse_words_drops_markers(): ...  # fixture json -> only real words, sorted, seconds
def test_filler_removed_and_gap_trimmed():
    keeps = cutting.keep_intervals(W, SIL, 3.5)
    assert keeps == [pytest.approx((0.0, 1.0)), pytest.approx((2.78, 3.5))]   # um 1.0-1.3 and the gap up to 2.9 are one cut; keep 0.12 only on the world side
def test_short_gap_is_kept():
    assert cutting.keep_intervals([(0, 1, "a"), (1.2, 2, "b")], [(1.0, 1.2)], 2) == [(0, 2)]
def test_no_words_keeps_everything():
    assert cutting.keep_intervals([], [], 5.0) == [(0.0, 5.0)]
def test_filler_list_only_cuts_listed_words():
    assert not cutting.is_filler("like") and not cutting.is_filler("ah") and cutting.is_filler(" Um, ")
@pytest.mark.parametrize("seed", range(20))
def test_never_cuts_inside_a_real_word(seed):   # random words/gaps/overstated ends; assert every non-filler word's core is inside one keep interval; intervals sorted, disjoint, within [0,total]
    ...
def test_atempo_chain(): assert cutting.atempo_chain(1.1) == "atempo=1.1" and cutting.atempo_chain(2.5) == "atempo=2.0,atempo=1.25" and cutting.atempo_chain(1.0) == ""
def test_cut_graph_golden_string(): ...      # 2 keeps, speed 1.25, no music -> exact string (write the expected string from the first run, after reading it once)
def test_cut_graph_music_and_second_pass(): ...   # contains "amix=inputs=2:duration=first:normalize=0", "linear=true", measured_I=-20.5 when given
def test_join_graph_crops_and_fills_silence(): ...  # a take with hasAudio False gets anullsrc; every video chain ends in format=yuv420p
def test_parse_loudnorm_and_silences_and_progress(): ...   # canned stderr text
def test_missing_tools(monkeypatch): ...   # monkeypatch shutil.which / analyze.WHISPER -> the exact 503 sentences
```

- [ ] **Step 2: 執行測試，確認會失敗**：`backend/.venv/bin/python -m pytest -q backend/tests/test_cutting.py` → `ModuleNotFoundError: cutting`
- [ ] **Step 3: 實作 `backend/cutting.py` 的純函式**。`test_cut_graph_golden_string` 的期望字串在實作完成、讀過一次輸出確認合理後才寫進測試。
- [ ] **Step 4: 通過**：同一指令 PASS；`bash bin/verify.sh` → `verify: GREEN`
- [ ] **Step 5: Commit**：`feat(trend-finder): pure helpers for cutting silences and filler words`

### Task 2: ffmpeg 流程與黃金檔測試

**Files:**
- Modify: `backend/cutting.py`
- Test: `backend/tests/test_cutting_media.py`

**Interfaces — Produces:**
- `probe(path) -> dict`：`{duration, width, height, fps, hasAudio, vcodec, acodec, pix_fmt, sample_rate}`（`ffprobe -show_format -show_streams -of json`，仿 `analyze.probe`，`analyze.py:81-86`，但回更多欄位）。
- `measure_loudness(path) -> dict`：`ffmpeg -i path -af ebur128=peak=true -f null -`，解析結尾 summary 的 `I:` 和 `Peak:`（LUFS、dBFS）。測試用。
- `transcribe_words(wav: Path, work: Path) -> list[Word]`：`[analyze.WHISPER, "-m", str(analyze.MODEL), "-f", wav, "-l", "auto", "-ml", "1", "-sow", "-ojf", "-of", work/"words", "-np"]`，`timeout=WHISPER_TIMEOUT`（900 s），再 `parse_words`。輸入 wav 是 `ffmpeg -vn -ac 1 -ar 16000`（同 `analyze.py:124`）。回傳碼非 0 或沒有 JSON 就 `raise CutError(...)`，**不**回 `[]`。
- `render_cut(takes: list[dict], music: Path | None, speed: float, work: Path, out: Path, step, *, words_fn=transcribe_words) -> dict`：步驟依序為
  1. 對每個 take 跑 `probe`，總長 > `MAX_INPUT_SEC` 就 `CutError`。
  2. `joined.mkv` = `build_join_graph` 的輸出，`-c:v libx264 -crf 18 -preset veryfast -c:a pcm_s16le`（音訊保持無損，避免二次有損編碼）。
  3. 從 `joined.mkv` 抽 16 kHz 單聲道 wav → `words_fn`；另跑 `silencedetect=n=-35dB:d=0.15` → `parse_silences`。
  4. `keep_intervals`；沒有字時整支保留，並把 `step` 文字設為 `No speech found, so nothing was cut.`；保留長度 < 1 s 就 `CutError`。
  5. 第一段：`-i joined.mkv [-stream_loop -1 -i music] -filter_complex_script g1.txt -map [a] -f null -`，`parse_loudnorm`。
  6. 第二段：同一個圖加影片，`-map [v] -map [a] -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -progress pipe:1 -nostats`，寫到 `out.with_suffix(".part")`，成功後 `os.replace`。
  7. 用 `probe` 檢查規格（1080x1920、fps 30、h264、aac、yuv420p、48000），不符合 `CutError`。回 `{size, durationSec}`。
- `class CutError(Exception)`：訊息是給人看的一句話。所有 subprocess 都用 `run` 包一層（`stdin=subprocess.DEVNULL`，仿 `analyze.py:68-69`），失敗時取 stderr 最後 200 字元放進 `CutError`。

**測試素材（deterministic，測試時用 lavfi 產生，不放進 repo）：**

```python
need_ffmpeg = pytest.mark.skipif(not (shutil.which("ffmpeg") and shutil.which("ffprobe")), reason="needs ffmpeg")

def make_clip(path, parts, size="640x360", with_audio=True):
    """parts: [("tone", 440, 1.0), ("quiet", None, 1.5), ...]. Video is testsrc at 24 fps for the total length."""
    # audio: one lavfi input per part (sine=f=440:d=1.0:r=48000 or anullsrc=r=48000:cl=mono, with -t), joined by the concat filter
    # video: testsrc=s=...:r=24 trimmed to the total; encode libx264 -pix_fmt yuv420p, aac
```

已知結構：`GAP_CLIP = tone 440 Hz 1.0 s → quiet 1.5 s → tone 440 Hz 1.0 s`（總長 3.5 s）。假的字表 `[(0.0, 1.3, "hello"), (2.5, 3.5, "world")]`（「hello」的字尾故意多算 0.3 s，模擬 whisper）。靜音在 1.0–2.5 s。保留 `(0, 1.0 + 0.12)` 和 `(2.5 - 0.12, 3.5)`，去掉 1.26 s，成品預期 2.24 s。

- [ ] **Step 1: 寫失敗的測試** `backend/tests/test_cutting_media.py`（整個檔案套 `need_ffmpeg`；words 用 `words_fn=lambda wav, work: FAKE_WORDS`，所以不需要 whisper）。

```python
@need_ffmpeg
def test_silence_removed_and_spec_met(tmp_path):
    clip = make_clip(tmp_path / "a.mp4", GAP_CLIP)
    info = cutting.render_cut([{"path": clip}], None, 1.0, tmp_path / "w", tmp_path / "out.mp4", lambda *a: None, words_fn=fake_words)
    p = cutting.probe(tmp_path / "out.mp4")
    assert p["duration"] == pytest.approx(2.24, abs=0.15)          # 3.5 s minus the 1.26 s gap
    assert (p["width"], p["height"], p["fps"]) == (1080, 1920, 30)
    assert (p["vcodec"], p["acodec"], p["pix_fmt"], p["sample_rate"]) == ("h264", "aac", "yuv420p", 48000)
    loud = cutting.measure_loudness(tmp_path / "out.mp4")
    assert loud["I"] == pytest.approx(-13, abs=1.0) and loud["peak"] <= -1.0   # 容差第一次跑後依實測值決定，不放寬到沒有意義

@need_ffmpeg
def test_speed_shortens(tmp_path): ...             # speed 1.25 -> duration == 2.24 / 1.25 within 0.15
@need_ffmpeg
def test_filler_cut(tmp_path): ...                 # 440 Hz 0.8 s, 880 Hz 0.5 s labelled "um", quiet 0.6, 440 Hz 0.8 -> um + gap gone, duration ~ 1.6 + 0.12
@need_ffmpeg
def test_no_words_keeps_everything(tmp_path): ... # words_fn returns [] -> duration ~ input, step text says nothing was cut
@need_ffmpeg
def test_two_takes_are_joined_in_order(tmp_path): ...   # two clips of different lengths -> total duration adds up; first half has the 440 Hz tone, second half 880 Hz (check with ffmpeg astats or by segment loudness is overkill: assert duration and spec only)
@need_ffmpeg
def test_missing_whisper_is_an_error(tmp_path, monkeypatch):
    monkeypatch.setattr(cutting.analyze, "WHISPER", "/nonexistent/whisper-cli")
    with pytest.raises(cutting.CutError, match="whisper.cpp"): cutting.transcribe_words(tmp_path / "x.wav", tmp_path)

@pytest.mark.skipif(not os.environ.get("REMAKE_WHISPER_TESTS") or cutting.missing_tools(), reason="slow: set REMAKE_WHISPER_TESTS=1")
def test_real_whisper_on_say_audio(tmp_path): ...   # macOS `say` -> wav, transcribe_words returns words with start<end; 預設不跑
```

- [ ] **Step 2: 執行測試，確認會失敗**：`backend/.venv/bin/python -m pytest -q backend/tests/test_cutting_media.py` → FAIL（`AttributeError: render_cut`）
- [ ] **Step 3: 實作**。每個 ffmpeg 呼叫加 `-y -v error`（要解析 stderr 的除外）。
- [ ] **Step 4: 通過**：同一指令 PASS；`bash bin/verify.sh` → GREEN（本機有 ffmpeg，這些測試會跑；整組多出的時間記進 STATUS）
- [ ] **Step 5: Commit**：`feat(trend-finder): ffmpeg pipeline for the cut (join, cut, speed, two-pass loudnorm)`

### Task 3: 配樂、無聲 take、橫式素材

**Files:** Modify `backend/cutting.py`（只在測試揭露問題時）；Test: `backend/tests/test_cutting_media.py`

- [ ] **Step 1: 寫失敗的測試**
```python
@need_ffmpeg
def test_music_is_mixed_low(tmp_path): ...       # GAP_CLIP + a 3 s 220 Hz wav music file shorter than the output; output has audio, duration unchanged, spec met; loudness still ~ -13 (+-1)
@need_ffmpeg
def test_music_longer_than_video_is_trimmed(tmp_path): ...   # 20 s music -> duration == 2.24 +- 0.15
@need_ffmpeg
def test_take_without_audio_gets_silence(tmp_path): ...      # make_clip(with_audio=False) + normal clip -> still one aac track, duration adds up
@need_ffmpeg
def test_landscape_is_center_cropped(tmp_path): ...      # 640x360 in -> 1080x1920 out; assert the spec only, plus a pure test that the join graph has `crop=1080:1920` and no `pad=`
@need_ffmpeg
def test_portrait_input_passes_through(tmp_path): ...        # 360x640 in -> 1080x1920
```
- [ ] **Step 2: 執行**：`pytest -q backend/tests/test_cutting_media.py`。純 filtergraph 已在 Task 1 完成，所以預期多數一開始就過；失敗的才修實作。
- [ ] **Step 3: 通過並跑 `bash bin/verify.sh`** → GREEN
- [ ] **Step 4: Commit**：`test(trend-finder): cover music, silent takes and landscape footage`

### Task 4: `backend/renders.py`：儲存、API、工作佇列

**Files:**
- Create: `backend/renders.py`
- Modify: `backend/server.py:668`（`db()` 加 `renders.SCHEMA`）、`backend/server.py:805` 後（`include_router(renders.make_router(db, load, lambda: MEDIA_DIR))`）、`backend/server.py:115`（`FastAPI(title=..., lifespan=...)`，`lifespan` 呼叫 `renders.recover(db)`）
- Test: `backend/tests/test_renders.py`

**Interfaces — Produces:** `renders.SCHEMA`、`renders.make_router(db, load, media_dir)`、`renders.RenderJobs`（單 worker thread，`submit(idea_id)`）、`renders.recover(db)`、`renders.signature(take_ids, speed, music_id) -> str`、`renders.run_pipeline = cutting.render_cut`（模組層級名稱，測試 monkeypatch 它）。路由與回應如「資料模型與 API」。上傳配樂的串流、上限、清檔流程直接重用 `takes.py:60-76` 的 `receive` 寫法（那是 `make_router` 裡的內部函式，抽出來共用會動到 2b 的檔案，所以先複製一份到 `renders.py`，列在風險）。魔術位元組：mp3 開頭 `ID3` 或 `0xFF 0xE0` 遮罩；m4a 第 4–8 byte `ftyp`；wav `RIFF....WAVE`。

- [ ] **Step 1: 寫失敗的測試**。fixture 沿用 `test_takes.py:1-30` 的形狀（`store_ideas`、`up` 上傳 take、`approved` 的 `"ia"`、`waiting` 的 `"iw"`）。`run_pipeline` 用假函式：寫一個小檔到 `out`、呼叫 `step(...)`；`tools` 用 `monkeypatch.setattr(cutting, "missing_tools", lambda: None)`。等工作完成的 `wait` 仿 `test_analyze.py:22-29`。

```python
def test_cut_needs_a_chosen_take_for_every_shot(client, setup):   # shotCount 2, only shot 0 has a take -> 409 "Choose a take for shot 2 first."
def test_not_approved_409(client, setup): ...
def test_missing_tools_503(client, setup, monkeypatch): ...        # exact ffmpeg and whisper sentences; no row is created, nothing queued
def test_cut_runs_and_reports_progress(client, setup, fake_pipeline): ...   # POST -> 202 queued; poll until done; output.url serves video/mp4; Range request returns 206
def test_download_has_attachment_header(client, setup, fake_pipeline): ...
def test_failure_is_reported_and_work_dir_removed(client, setup, monkeypatch): ...   # pipeline raises CutError("boom") -> status failed, error "boom", no cut/work
def test_one_active_cut_per_plan_409(client, setup, slow_pipeline): ...
def test_rerun_replaces_old_output(client, setup, fake_pipeline): ...   # second run succeeds -> final.mp4 replaced; state went queued again
def test_failed_rerun_keeps_old_output(client, setup, fake_pipeline): ...   # second run fails -> old final.mp4 still served, error shown
def test_restart_marks_running_failed(client, setup): ...   # insert a running row by SQL, renders.recover(server.db), GET -> failed + the restart sentence; cut/work gone
def test_survives_restart_when_done(client, setup, fake_pipeline): ...  # new TestClient(server.app) still returns done + output
def test_stale_after_choosing_another_take(client, setup, fake_pipeline): ...   # choose a different take -> stale true
def test_music_upload_rules(client, setup): ...   # 413 over cap (monkeypatch MAX_MUSIC_BYTES), 415 wrong type, 415 wrong magic bytes, 422 without X-License-Confirmed, ok replaces old file, DELETE removes file and row
def test_total_input_over_10_minutes_409(client, setup, monkeypatch): ...   # fake probe durations
def test_not_enough_disk_409(client, setup, monkeypatch): ...   # monkeypatch shutil.disk_usage
def test_cut_routes_need_sign_in(client, setup): ...   # add_user() first -> 401 on every route
def test_review_link_shows_no_cut(client, setup): ...   # /api/review/<token> body does not contain the output url
def test_reopened_plan_keeps_output_read_only(client, setup, fake_pipeline): ...   # reopen -> GET still done and file 200; POST cut / PUT music -> 409
```
- [ ] **Step 2: 執行，確認失敗**：`pytest -q backend/tests/test_renders.py` → `ModuleNotFoundError: renders`
- [ ] **Step 3: 實作**。開始工作時在同一個 DB 交易裡檢查有無進行中的列並 `INSERT OR REPLACE`（避免兩個請求同時通過檢查）。worker 用 `step` callback 更新 `progress`、`step`；整個流程 `try/except CutError` 與 `except Exception`（後者的訊息換成「Something went wrong while making the cut.」，完整訊息只寫 log），`finally` 刪 `cut/work/`。
- [ ] **Step 4: 通過**：`pytest -q backend/tests/` 全過；`bash bin/verify.sh` → GREEN
- [ ] **Step 5: Commit**：`feat(trend-finder): render jobs, music upload and cut endpoints`

### Task 5: 前端 `src/lib/cut.ts`

**Files:** Create `src/lib/cut.ts`；Test `unit/cut.test.mjs`

**Interfaces — Produces:** `CutState`（同 API）；`MAX_MUSIC_BYTES = 30 * 1024 * 1024`；`SPEEDS = [1, 1.1, 1.25]`；`musicType(file)`（看 `file.type`，空的就看副檔名 `.mp3/.m4a/.wav`，不分大小寫）；`checkMusic(file)`（錯誤文案跟 Global Constraints 完全一致）；`canStartCut({status, shotsDone, shotsTotal, active})`；`formatDuration(sec)`（`75 → "1:15"`）；`getCut`、`putMusic(ideaId, file)`、`deleteMusic`、`startCut(ideaId, shotCount, speed)`、`pollCut(ideaId, onState, {signal, intervalMs = 2000})`（`status` 為 `done`／`failed` 時結束；仿 `live.ts:233-252` 的輪詢，但可中止，元件卸載時要停）。API 錯誤一律 `throw new Error(json.error ?? fallback)`，寫法同 `takes.ts` 的 `send`。

- [ ] **Step 1: 寫失敗的測試**：`musicType` 回退副檔名；`checkMusic` 兩種錯誤文案和通過；`canStartCut` 在鏡頭沒選齊、進行中、plan 未核准時為 false；`formatDuration`；`pollCut` 用假 `fetch` 連回 `running` 兩次再 `done`，確認 `onState` 呼叫次數、`failed` 時 resolve 帶 error、`AbortSignal` 中止後不再 fetch（`intervalMs: 1`）；`putMusic` 送出 `X-License-Confirmed: yes`。
- [ ] **Step 2: 失敗**：`node --test unit/cut.test.mjs` → `Cannot find module`
- [ ] **Step 3: 實作**
- [ ] **Step 4: 通過**：`node --test unit/` 全 PASS
- [ ] **Step 5: Commit**：`feat(trend-finder): cut client and helpers`

### Task 6: `CutPanel` 元件

**Files:** Create `src/components/CutPanel.tsx`；Modify `src/components/PlanScreen.tsx:308`（在 `<ShotChecklist .../>` 後加 `<CutPanel key={idea.id} ideaId={idea.id} status={idea.status} shotCount={shots.length} shotsDone={...} />`；`shotsDone` 需要 `ShotChecklist` 已載入的 takes，**未確認**怎麼取最乾淨：優先讓 `ShotChecklist` 多一個 `onProgress(done)` callback，其次是 `CutPanel` 自己再呼叫一次 `listTakes`）；Modify `src/styles/drawer-plan.css`

畫面文案（固定）：
- 標題 `Make the video`。沒選齊 take：`Choose a take for every shot first ({done} of {total}).`，按鈕停用。
- 速度選單 `Speed`：`Normal`、`1.1x`、`1.25x`，預設 1.1x。
- 配樂區：`Add music (optional)`，上傳前先勾 `I own this music or have the license to use it in this video.`（沒勾時檔案選擇鈕停用）；已上傳顯示檔名、大小、`Remove`。
- 按鈕 `Make the video`；進行中顯示 `<progress>` 加 `step` 文字，按鈕停用；`failed` 顯示 `ErrorText` 和 `Try again`。
- `done`：`<video controls playsInline preload="metadata" src={output.url}>`（390 寬度下 `max-width: 100%`）、`Download` 連結（`?download=1`）、時長與大小；`stale` 時顯示 `The takes changed after this was made. Make it again.`
- plan 未核准：所有按鈕藏起來，有成品就唯讀顯示；沒成品且沒進行中就整個元件回 null（同 `ShotChecklist` 的規則）。
- 載入時 `getCut`；狀態是 `queued`／`running` 就自動 `pollCut`；元件卸載時 abort。

- [ ] **Step 1: 實作元件和樣式**（商業邏輯都在 Task 5，這步不寫元件測試）
- [ ] **Step 2: 檢查**：`npm run build` 和 `npm run lint` 都 exit 0；`bash bin/verify.sh` → GREEN
- [ ] **Step 3: Commit**：`feat(trend-finder): make-the-video panel on the plan page`

### Task 7: e2e、STATUS 和 PR

**Files:** Modify `docs/STATUS.md`（新增「Phase 2c-1」段落，格式照 2b 那段；寫下實測的整組測試時間、成品規格、容差依據）；Modify `docs/phase2-scope.md`（只在需要時勾選或補註）

- [ ] **Step 1: 準備素材**（放 `/Volumes/Huang T7/playwright-mcp/`，或 repo 內，Playwright 才上傳得到）：`ffmpeg` 產生兩支 take——直式 `testsrc=s=720x1280` 帶 440 Hz 音，中間有 1.5 s 靜音；橫式 `testsrc=s=1280x720`；一個 5 s 的 `.mp3` 配樂（`sine`）；一個改名成 `.mp3` 的文字檔。可以再用 `say` 產生一段有「um」的英文，另外錄成一支 take 做真 whisper 的煙霧測試（此步需要本機有 whisper 模型）。
- [ ] **Step 2: 啟動 demo 後端**：先在 trend-finder 跑 `npm run build`，再到 worktree 根目錄 `TF_VENV=$PWD/pivots/02-content/app/trend-finder/backend/.venv nohup bash bin/isolated-backend.sh 8813 --demo-data --user e2e@example.com:<一次性密碼> > <scratchpad 絕對路徑>/env-8813.log 2>&1 &`，開 `http://127.0.0.1:8813`（`TF_VENV` 一定要設：腳本預設用主 checkout `~/Desktop/BuildClub` 的 venv，見 `bin/isolated-backend.sh:30`，那裡不能碰；用法見 `bin/isolated-backend.sh` 檔頭；它用 `env -i` 保留 `PATH`，所以 `/opt/homebrew/bin` 的 ffmpeg 找得到，**未確認**其他機器）。
- [ ] **Step 3: 用 Playwright MCP 在 1440 和 390 兩種寬度跑完**：
  1. approved plan 上每個鏡頭上傳 take，`Make the video` 一開始停用並顯示 `x of N`。
  2. 選齊後按鈕可按；按下後看到進度條和 step 文字推進。
  3. 完成後 `<video>` 可播放，`Download` 連結下載到的檔案用 `ffprobe` 驗證 1080x1920、30 fps、h264/aac。
  4. 重新整理，成品還在；換選另一個 take，出現 stale 提示。
  5. 勾授權後上傳配樂，重跑，成品仍符合規格；改名的文字檔顯示 `Upload an .mp3, .m4a or .wav audio file.`；沒勾授權時上傳鈕停用。
  6. 重跑時舊成品在新成品做好前都還能播放；新成品完成後換成新的。
  7. 按 Edit 重開 plan：成品還在、按鈕都消失。
  8. 審閱連結看不到成品，也沒有任何 `/cut` 請求。
  9. 390 寬度下 `document.documentElement.scrollWidth <= 390`。
  10. 缺工具的錯誤訊息只在 pytest 驗證（Task 4），e2e 不驗，也不為此加任何旗標。
- [ ] **Step 4: 停掉 8813**：`kill $(lsof -nP -tiTCP:8813 -sTCP:LISTEN)`；關掉自己開的 Playwright 分頁。
- [ ] **Step 5: 更新 STATUS.md，commit**：`docs(remake): record 2c-1 verification`
- [ ] **Step 6: `bash bin/verify.sh` GREEN、`npm run build`、`npm run lint` exit 0，然後 push，開 PR 到 fork（minchiaHuang/BuildClub）base `main`**，標題 `feat(trend-finder): Remake 2c-1 — make a publishable 9:16 video from the chosen takes`。

## 風險與未驗證

- **真人實拍沒用 whisper 測過。** 目前只驗證過 `say` 合成的 6 秒英文（scope §6）。真人的氣音、咳嗽、背景音可能被轉成怪字或漏掉「um」；Task 7 的煙霧測試只是合成語音，不算驗證。
- **`-l auto` 加 `-ml 1 -sow` 沒測過**（實測用 `-l en`）；短片自動偵測錯語言會讓字詞變成錯的語言，但時間戳仍可用。`-dtw` 沒生效，不依賴它。
- **中文贅字未驗證**，所以不剪。中文逐字輸出（每個字還是每個詞一筆）也未確認。
- **長影片執行時間、磁碟用量未量測。** 10 分鐘上限與 4 倍磁碟係數是估計；whisper 在 large-v3-turbo-q5_0 上的速度沒測過。Task 7 要記下實測時間。
- **響度容差。** 純音調的 LRA 很小，`linear=true` 應該能命中；測試的 ±1.0 LU 是預設，以第一次實測決定，不事後放寬到失去意義。
- **平台限制（Instagram／TikTok 的長度、大小、位元率）全部未驗證。** 本計畫的 1080x1920／30 fps／H.264／AAC 是常見的做法，不是查證過的平台規格。
- **take 在轉檔中被刪掉**：ffmpeg 會失敗，使用者看到失敗訊息並重按；沒有鎖定 take。
- **`receive` 串流程式複製了一份**（`takes.py:60-76` 是 `make_router` 內部函式），之後可以抽成共用，但那會動 2b 的檔案，這次不做。
- **async 路由裡的阻塞寫入**：沿用 2b 已知的問題（STATUS 的 Deferred minors），配樂上傳最大 30 MB，影響較小。
- **`lifespan` 加進 `FastAPI(...)` 是新行為**：`recover()` 只在真的啟動時跑，已確認目前沒有其他 startup 邏輯，但 uvicorn `--reload` 下是否每次重載都跑，**未確認**（無害）。
- **版權**：配樂只靠使用者勾選自述，系統無法驗證；成品不含任何參考影片的片段。

## 後續（不在 2c-1）

2c-2：審閱連結 `/review/<token>` 顯示成品預覽，Annie 核准或退回，沒登入只能看到該 plan 的成品；順便修 390 寬度的溢出（scope §4）。2c-1 的 `GET /cut/file` 在 `/api/ideas/` 底下需要登入，2c-2 要另開以 token 為依據的路徑，不要放寬這一條。
