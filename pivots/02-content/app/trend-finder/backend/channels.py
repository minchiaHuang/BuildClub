"""Channel summaries. A job decodes one YouTube / TikTok / Instagram channel by running the
channel-decoder CLI (a separate checkout, called as a subprocess) step by step, then reads the
analysis.json it writes: what formats the channel uses, why they work, its top videos.

    fetch -> details -> transcribe  (free for YouTube and TikTok; Instagram costs ScrapeCreators credits)
    name the formats + write the notes  (one Claude call, the part channel-decoder leaves to a person)
    label (Jev, paid) -> aggregate  (free)

Like analyze.Jobs: one worker thread, one channel at a time. A job's id comes from the channel,
and its files live in channels/<id>/, so a finished channel is reused for CACHE_DAYS and a job
interrupted by a restart picks up where it stopped (every channel-decoder step skips finished work).
"""

import hashlib
import json
import math
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse

import anthropic
from pydantic import BaseModel

import analyze
from models import ChannelJob

HERE = Path(__file__).resolve().parent
CHANNELS_DIR = HERE / "channels"
DECODER_DIR = Path(os.environ.get("CD_DECODER_DIR", "/Users/tommy/orca/workspaces/channel-decoder/feat-remote-dev-origins"))
CACHE_DAYS = 7
DEFAULT_VIDEOS = 50
MAX_VIDEOS = 100
STEP_TIMEOUT = 3600  # seconds for one channel-decoder step (100 videos of transcribing take about 12 minutes)
IG_PAGE = 12  # reels per ScrapeCreators page, 1 credit each (channel-decoder docs/STATUS.md)

# Estimates, not prices: Claude's naming call is held to about US$0.10-0.15 by its input size and
# max_tokens (an assumption until the first real run is compared with the bill).
NAMING_USD = 0.15
JEV_MARGIN = 2.0  # label's own estimate was 50% under the real cost on 2026-10-18; double it to be safe
JEV_MIN_USD = 0.01  # the least a new channel must have left in the Jev wallet to be accepted
NOTES_FOR = 30  # why-it-works / steal-this notes for the most-viewed N videos
EXCERPT = 300  # characters of speech sent per video to the naming call

# wallet -> (name shown to the user, env var that raises its daily cap)
WALLETS = {
    "claude": ("Claude", "DAILY_CLAUDE_USD"),
    "jev": ("Jev", "DAILY_JEV_USD"),
    "scrapecreators": ("ScrapeCreators credit", "DAILY_SCRAPECREATORS_CREDITS"),
}

STEPS = ["Finding the channel", "Listing videos", "Reading video details", "Transcribing speech",
         "Naming the formats", "Labelling videos", "Putting the summary together"]
RESOLVE, FETCH, DETAILS, TRANSCRIBE, NAME, LABEL, AGGREGATE = range(len(STEPS))

HOSTS = {"youtube": ("youtube.com",), "tiktok": ("tiktok.com",), "instagram": ("instagram.com",)}
HANDLE = re.compile(r"[A-Za-z0-9._-]{1,60}")
JOB_ID = re.compile(r"[0-9a-f]{12}")
THUMB = re.compile(r"([A-Za-z0-9_-]+)\.jpg")


class OverBudget(Exception):
    def __init__(self, wallet: str):
        name, env = WALLETS[wallet]
        super().__init__(f"Today's {name} budget is used up. Raise {env} in .env and restart the API; "
                         "work already done is kept.")
        self.wallet = wallet


def normalise(platform: str, raw: str) -> str:
    """The bare handle from '@name', 'name' or a channel / profile link. Raises ValueError with a
    message for the user."""
    if platform not in HOSTS:
        raise ValueError("Pick YouTube, TikTok or Instagram.")
    text = raw.strip()
    if not text:
        raise ValueError("Type a channel handle or paste its link.")
    first = text.split("/")[0].lower()
    if text.lower().startswith(("http://", "https://")) or any(first == h or first.endswith("." + h)
                                                              for h in HOSTS[platform]):
        url = urlparse(text if "//" in text else "https://" + text)
        host = (url.hostname or "").lower()
        if not any(host == h or host.endswith("." + h) for h in HOSTS[platform]):
            raise ValueError(f"That link is not a {platform.title()} link.")
        parts = [p for p in url.path.split("/") if p]
        text = parts[0] if parts else ""
        if platform == "instagram" and text in ("p", "reel", "reels", "stories", "explore"):
            raise ValueError("Paste the profile link (instagram.com/name), not a post.")
        if platform != "instagram" and not text.startswith("@"):
            raise ValueError(f"Use the channel's @handle link (for example {HOSTS[platform][0]}/@name).")
    handle = text.lstrip("@")
    if not HANDLE.fullmatch(handle):
        raise ValueError("That does not look like a handle. Use letters, numbers, dots, dashes and underscores.")
    return handle


def job_id_for(platform: str, handle: str) -> str:
    return hashlib.sha1(f"{platform}:{handle.lower()}".encode()).hexdigest()[:12]


def thumb_path(job_id: str, name: str):
    """The saved thumbnail for a name like '7123.jpg', or None. Names are letters, digits, _ and - only."""
    m = THUMB.fullmatch(name)
    if not m or not JOB_ID.fullmatch(job_id):
        return None
    path = CHANNELS_DIR / job_id / "thumbs" / f"{m.group(1)}.jpg"
    return path if path.is_file() else None


# ---- files -------------------------------------------------------------------------------------

def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(f".{threading.get_ident()}.tmp")
    partial.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(partial, path)


def is_fresh(meta: dict, max_videos: int) -> bool:
    return (meta.get("status") == "done" and meta.get("maxVideos", 0) >= max_videos
            and time.time() - meta.get("finishedAt", 0) < CACHE_DAYS * 86400)


def result_for(job_id: str, work: Path):
    """analysis.json with each thumbnail pointed at this API (or dropped if the file is missing)."""
    data = read_json(work / "analysis.json")
    if not isinstance(data, dict):
        return None
    videos = []
    for v in data.get("videos") or []:
        has = (work / "thumbs" / f"{v.get('id')}.jpg").is_file() and THUMB.fullmatch(f"{v.get('id')}.jpg")
        videos.append({**v, "thumbnail": f"/api/channel/{job_id}/thumb/{v['id']}.jpg" if has else None})
    return {"summary": data.get("summary") or {}, "videos": videos, "formats": data.get("formats") or []}


# ---- channel-decoder ---------------------------------------------------------------------------

def decoder_python() -> str:
    env = os.environ.get("CD_DECODER_PYTHON")
    venv = DECODER_DIR / ".venv" / "bin" / "python"
    return env or (str(venv) if venv.exists() else sys.executable)


def child_env() -> dict:
    """What channel-decoder gets: the PATH, home and CD_* settings, plus only the two keys it uses."""
    keep = ("PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "SCRAPECREATORS_API_KEY", "TYPESAFE_API_KEY")
    return {k: v for k, v in os.environ.items() if k in keep or k.startswith("CD_")}


def run_decoder(args: list) -> str:
    cmd = [decoder_python(), "-m", "channel_decoder", *[str(a) for a in args]]
    try:
        r = subprocess.run(cmd, cwd=DECODER_DIR, env=child_env(), capture_output=True, text=True,
                           stdin=subprocess.DEVNULL, timeout=STEP_TIMEOUT)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"channel-decoder {args[0]} took too long and was stopped.")
    if r.returncode != 0:
        raise RuntimeError(f"channel-decoder {args[0]} failed: {(r.stderr or r.stdout).strip()[-300:]}")
    return r.stdout


def yt_dlp() -> str:
    env = os.environ.get("CD_YT_DLP")
    brew = Path("/opt/homebrew/bin/yt-dlp")
    return env or (str(brew) if brew.exists() else "yt-dlp")


def tiktok_channel_id(handle: str) -> str:
    """channel-decoder needs TikTok's channel id (secUid); yt-dlp's listing of the profile gives it."""
    r = subprocess.run([yt_dlp(), "-J", "--flat-playlist", "--playlist-end", "1", "--socket-timeout", "30",
                        f"https://www.tiktok.com/@{handle}"],
                       capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=180)
    try:
        data = json.loads(r.stdout)
        entries = data.get("entries") or []
        found = data.get("id") or (entries[0].get("channel_id") if entries else None)
    except (ValueError, AttributeError, IndexError):
        found = None
    if r.returncode != 0 or not found or not str(found).startswith("MS4w"):
        raise RuntimeError(f"Could not find the TikTok account @{handle}. Check the spelling.")
    return str(found)


# ---- the naming call ---------------------------------------------------------------------------

class FormatName(BaseModel):
    name: str
    description: str


class VideoNote(BaseModel):
    id: str
    why_it_works: str
    steal_this: str


class ChannelNaming(BaseModel):
    formats: list[FormatName]
    notes: list[VideoNote]


NAMING_PROMPT = """You are helping a social media manager decode one short-video channel, so their
client can learn from it. Explain what the channel does; do not write scripts.

Above are the channel's newest videos, each with its id, views, length, caption and the start of
its speech. The videos may not be in English: write everything in plain English.

1. formats: name the 3 to 8 repeatable formats this channel uses (for example "Taste test" or
   "Before and after"). name is 1 to 4 plain words. description is one sentence saying how to tell
   a video of this format from the others; a classifier reads it, so describe what the video does,
   not how well it did.
2. notes: for each video under "Write notes for", why_it_works is one short sentence on what makes
   this video hold attention, and steal_this is one short sentence on what the client could borrow
   from it. Use the id exactly as given.

Only describe what the captions and speech show. Keep each sentence short and simple."""


def ask_claude(content: str) -> ChannelNaming:
    """The one paid Claude call per channel (same client and model as analyze.breakdown)."""
    response = anthropic.Anthropic().beta.messages.parse(
        model=analyze.AI_MODEL,
        max_tokens=12000,
        thinking={"type": "adaptive"},
        output_config={"effort": "medium"},
        output_format=ChannelNaming,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[{"role": "user", "content": content}],
    )
    u = response.usage
    print(f"[channel] naming {response.model} in={u.input_tokens} out={u.output_tokens} "
          f"stop={response.stop_reason}", flush=True)
    if response.stop_reason == "refusal":
        raise RuntimeError("The AI declined to analyse this channel.")
    if response.stop_reason == "max_tokens" or response.parsed_output is None:
        raise RuntimeError(f"The AI answer was incomplete ({response.stop_reason}).")
    return response.parsed_output


def video_lines(work: Path) -> tuple[list[str], list[str]]:
    """One text line per video that has a transcript, and the ids to write notes for."""
    rows = []
    for v in read_json(work / "videos.json") or []:
        t = read_json(work / "transcripts" / f"{v['id']}.json")
        if t is None:
            continue
        d = read_json(work / "details" / f"{v['id']}.json") or {}
        speech = " ".join(s.get("text", "") for s in t.get("sentences", []))[:EXCERPT]
        caption = (d.get("caption") or v.get("caption") or "").replace("\n", " ")[:150]
        rows.append((v.get("plays") or 0, v["id"],
                     f"id={v['id']} views={v.get('plays') or 0} length={round(d.get('duration') or v.get('duration') or 0)}s"
                     f" caption: {caption} | speech: {speech or '(none)'}"))
    top = [r[1] for r in sorted(rows, reverse=True)[:NOTES_FOR]]
    return [r[2] for r in rows], top


def name_formats(work: Path) -> None:
    """Write format-names.json and notes/<id>.json, the files channel-decoder's label and
    aggregate steps read. Does nothing if the formats were already named."""
    if (work / "format-names.json").exists():
        return
    lines, top = video_lines(work)
    if not lines:
        raise RuntimeError("No video had speech to read, so the formats could not be named.")
    content = ("Videos:\n" + "\n".join(lines) + "\n\nWrite notes for these ids: " + ", ".join(top)
               + "\n\n" + NAMING_PROMPT)
    naming = ask_claude(content)
    for note in naming.notes:
        if note.id in top:  # ids come from our own files, never from the answer, so no path can slip in
            write_json(work / "notes" / f"{note.id}.json",
                       {"why_it_works": note.why_it_works, "steal_this": note.steal_this})
    formats = [{"name": f.name.strip(), "description": f.description.strip()} for f in naming.formats if f.name.strip()]
    if not formats:
        raise RuntimeError("The AI did not name any formats.")
    write_json(work / "format-names.json", formats[:10])  # written last: its presence means naming finished


# ---- jobs --------------------------------------------------------------------------------------

class ChannelJobs:
    """spend(wallet, amount) counts a paid step against today's cap and returns False if it would
    go over; left(wallet) is what is left today. Both are the server's budget (server.spend)."""

    def __init__(self, spend: Callable[[str, float], bool], left: Callable[[str], float]):
        self._spend, self._left = spend, left
        self._live: dict[str, dict] = {}
        self._q: queue.Queue = queue.Queue()
        self._lock = threading.Lock()
        threading.Thread(target=self._work, name="channel-worker", daemon=True).start()

    # -- API side
    def submit(self, platform: str, handle: str, max_videos: int = DEFAULT_VIDEOS) -> str:
        """Queue a channel unless it is running or fresh. Raises OverBudget (before anything is
        queued, so before any subprocess) when a wallet cannot cover the paid steps."""
        job_id = job_id_for(platform, handle)
        work = CHANNELS_DIR / job_id
        with self._lock:
            live = self._live.get(job_id)
            if live and live["status"] in ("queued", "running"):
                return job_id
            meta = read_json(work / "meta.json") or {}
            if is_fresh(meta, max_videos):
                return job_id
            stale = meta.get("status") == "done" or meta.get("maxVideos", 0) < max_videos
            fetched = bool(meta.get("fetched")) and not stale
            self._check_keys(platform, fetched)
            self._check_budget(platform, work, fetched)
            if stale:  # an old or smaller run: keep the free downloads, redo the naming and labels
                for name in ("analysis.json", "format-names.json", "formats.json"):
                    (work / name).unlink(missing_ok=True)
                for name in ("notes", "labels"):
                    shutil.rmtree(work / name, ignore_errors=True)
            write_json(work / "meta.json", {**meta, "platform": platform, "handle": handle, "maxVideos": max_videos,
                                            "status": "queued", "error": None, "fetched": fetched,
                                            "createdAt": meta.get("createdAt") or time.time()})
            self._live[job_id] = {"status": "queued", "index": 0, "error": None}
        self._q.put(job_id)
        return job_id

    def _check_keys(self, platform: str, fetched: bool) -> None:
        """Refuse up front when a key the decoder needs is missing, so no paid step runs first."""
        need = ["TYPESAFE_API_KEY"] + (["SCRAPECREATORS_API_KEY"] if platform == "instagram" and not fetched else [])
        missing = [k for k in need if not os.environ.get(k)]
        if missing:
            # The .env hint is for whoever runs the server; the user only learns it isn't set up.
            print(f"[channel] channel summaries need {' and '.join(missing)} in .env; add it and restart the API.", flush=True)
            raise ValueError("Channel summaries aren't set up on this server yet.")

    def _check_budget(self, platform: str, work: Path, fetched: bool) -> None:
        need = {"jev": JEV_MIN_USD}
        if not (work / "format-names.json").exists():
            need["claude"] = NAMING_USD
        if platform == "instagram" and not fetched:
            need["scrapecreators"] = 1
        for wallet, amount in need.items():
            if self._left(wallet) < amount:
                raise OverBudget(wallet)

    def get(self, job_id: str):
        if not JOB_ID.fullmatch(job_id):
            return None
        work = CHANNELS_DIR / job_id
        meta = read_json(work / "meta.json")
        if not meta:
            return None
        steps = STEPS if meta["platform"] == "tiktok" else STEPS[1:]
        offset = len(STEPS) - len(steps)
        live = self._live.get(job_id)
        if meta.get("status") == "done":
            result = result_for(job_id, work)
            if result:
                return ChannelJob(job=job_id, status="done", step="Done", steps=steps,
                                  stepIndex=len(steps) - 1, result=result)
            meta = {**meta, "status": "failed", "error": "The saved summary is missing. Start it again."}
        if live is None and meta["status"] in ("queued", "running"):  # the API restarted mid-job
            meta = {**meta, "status": "failed", "error": "The API restarted before this finished. Start it again to continue."}
        status = live["status"] if live else meta["status"]
        index = live["index"] if live else 0
        counting = {DETAILS: "details", TRANSCRIBE: "transcripts"}.get(index)
        total = len(read_json(work / "videos.json") or []) if counting else 0
        done = len(list((work / counting).glob("*.json"))) if counting and total else 0
        return ChannelJob(job=job_id, status=status, step=STEPS[index] if status == "running" else
                          ("Waiting to start" if status == "queued" else ""),
                          steps=steps, stepIndex=max(index - offset, 0), done=done, total=total,
                          error=(live or meta).get("error"))

    # -- worker side
    def _set(self, job_id: str, **fields) -> None:
        with self._lock:
            self._live[job_id] = {**self._live[job_id], **fields}

    def _pay(self, wallet: str, amount: float) -> None:
        if not self._spend(wallet, round(amount, 4)):
            raise OverBudget(wallet)

    def _work(self) -> None:
        while True:
            job_id = self._q.get()
            work = CHANNELS_DIR / job_id
            meta = read_json(work / "meta.json") or {}
            try:
                self._run(job_id, work, meta)
                write_json(work / "meta.json", {**read_json(work / "meta.json"), "status": "done",
                                                "error": None, "finishedAt": time.time()})
                self._set(job_id, status="done")
            except Exception as e:
                print(f"[channel] {job_id} failed: {e}", flush=True)
                write_json(work / "meta.json", {**(read_json(work / "meta.json") or meta), "status": "failed",
                                                "error": str(e)})
                self._set(job_id, status="failed", error=str(e))

    def _at(self, job_id: str, index: int) -> None:
        self._set(job_id, status="running", index=index)

    def _save(self, work: Path, **fields) -> None:
        write_json(work / "meta.json", {**read_json(work / "meta.json"), **fields})

    def _run(self, job_id: str, work: Path, meta: dict) -> None:
        platform, handle = meta["platform"], meta["handle"]
        self.free_steps(job_id, work, meta)

        self._at(job_id, NAME)  # Jev is checked before Claude, so a full Jev wallet wastes nothing
        plan = re.search(r"videos: (\d+).*est\. USD: \$([0-9.]+)", run_decoder(["label", "--data", work, "--dry-run"]))
        to_label, jev_cap = (int(plan.group(1)), 0.0) if plan else (0, 0.0)
        if plan and to_label:
            jev_cap = max(round(float(plan.group(2)) * JEV_MARGIN, 4), 0.001)
            self._pay("jev", jev_cap)

        if not (work / "format-names.json").exists():
            self._pay("claude", NAMING_USD)
            name_formats(work)

        self._at(job_id, LABEL)
        if to_label:
            run_decoder(["label", "--data", work, "--max-usd", jev_cap])
        self._at(job_id, AGGREGATE)
        run_decoder(["aggregate", "--data", work])
        if not (work / "analysis.json").exists():
            raise RuntimeError(f"channel-decoder wrote no summary for {platform} @{handle}.")

    def free_steps(self, job_id: str, work: Path, meta: dict) -> None:
        """Everything before the first paid decoder step: find the channel, list its videos (paid
        only on Instagram), read each video's details and transcript."""
        platform, handle, count = meta["platform"], meta["handle"], meta["maxVideos"]
        if not meta.get("fetched"):
            accounts = work / "accounts.txt"
            if platform == "tiktok":
                self._at(job_id, RESOLVE)
                if not meta.get("channel_id"):
                    self._save(work, channel_id=tiktok_channel_id(handle))
                accounts.write_text(f"{handle} {read_json(work / 'meta.json')['channel_id']}\n", encoding="utf-8")
            else:
                accounts.write_text(f"{handle}\n", encoding="utf-8")
            self._at(job_id, FETCH)
            if platform == "instagram":
                self._pay("scrapecreators", math.ceil(count / IG_PAGE))
            run_decoder(["fetch", "--platform", platform, "--max-videos", count, "--accounts", accounts, "--data", work])
            if not (read_json(work / "videos.json") or []):
                raise RuntimeError(f"No videos found for @{handle} on {platform.title()}. Check the spelling.")
            self._save(work, fetched=True)
        self._at(job_id, DETAILS)
        run_decoder(["details", "--data", work])
        self._at(job_id, TRANSCRIBE)
        run_decoder(["transcribe", "--data", work])
