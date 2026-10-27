"""Trend Finder API in Python. Replaces server/index.mjs with the same routes and response shape,
so the front end needs no change. Keeps the Apify token on this machine and caches each search on
disk, so repeating a search costs nothing.

Run (from trend-finder/):
    backend/.venv/bin/uvicorn server:app --app-dir backend --port 8787 --reload
Pin a cached search so it never expires (offline demos):
    backend/.venv/bin/python backend/server.py pin "tofu"            (add "instagram" for an Instagram search)
"""

import hashlib
import json
import os
import shutil
import sqlite3
import statistics
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from analyze import Jobs, job_id_for
from models import AnalyzeJob, AnalyzeRequest, AnalyzeStarted, Client, SavedIdea, SearchResult

HERE = Path(__file__).resolve().parent
CACHE_DIR = HERE / "cache"
PINNED_DIR = HERE / "pinned"  # searches saved for demos; never expire
DB_PATH = HERE / "data.db"  # clients and saved ideas


def load_env(path: Path) -> None:
    """Read KEY=value lines from .env without overriding variables already set."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        key, sep, value = line.partition("=")
        key = key.strip()
        if sep and key and not key.startswith("#"):
            os.environ.setdefault(key, value.strip())


load_env(HERE.parent / ".env")

TOKEN = os.environ.get("APIFY_TOKEN", "").strip()
ACTOR = os.environ.get("APIFY_TIKTOK_ACTOR", "clockworks~tiktok-scraper")
IG_ACTOR = os.environ.get("APIFY_INSTAGRAM_ACTOR", "apify~instagram-hashtag-scraper")
RESULTS_PER_SEARCH = int(os.environ.get("RESULTS_PER_SEARCH", 30))
CACHE_HOURS = float(os.environ.get("CACHE_HOURS", 24))
# Cost is held by maxItems: 30 results at ~$1.70/1,000 is about $0.05.
# The charge cap is a backstop only; Apify refuses anything below $0.50.
MAX_USD_PER_SEARCH = float(os.environ.get("MAX_USD_PER_SEARCH", 0.50))
# Each account's usual views come from its latest videos: 15 accounts x 10 videos is about $0.26.
AUTHORS_PER_SEARCH = int(os.environ.get("AUTHORS_PER_SEARCH", 15))
VIDEOS_PER_AUTHOR = int(os.environ.get("VIDEOS_PER_AUTHOR", 10))
MIN_VIDEOS = 5  # fewer recent videos than this and the median says little
# Daily caps on estimated spend, so a loop or stray clicks can't run up the bill. Each paid call is
# counted before it runs; cached searches and finished breakdowns are free and never counted.
DAILY_APIFY_USD = float(os.environ.get("DAILY_APIFY_USD", 1.00))
DAILY_CLAUDE_USD = float(os.environ.get("DAILY_CLAUDE_USD", 1.00))
SEARCH_USD = {"tiktok": 0.31, "instagram": 0.03}  # TikTok: search $0.05 + account medians $0.26
ANALYZE_USD = 0.08  # one Claude breakdown

app = FastAPI(title="Trend Finder API")


def error(status: int, message: str, detail: str = "") -> JSONResponse:
    body = {"error": message, **({"detail": detail} if detail else {})}
    return JSONResponse(body, status_code=status)


def cache_name(query: str, platform: str = "tiktok") -> str:
    actor = IG_ACTOR if platform == "instagram" else ACTOR  # TikTok keys stay as before, so pins still load
    return hashlib.sha1(f"{actor}|{RESULTS_PER_SEARCH}|{query}".encode()).hexdigest() + ".json"


def read_cache(query: str, platform: str = "tiktok"):
    pinned = PINNED_DIR / cache_name(query, platform)
    if pinned.exists():
        return json.loads(pinned.read_text())
    try:
        saved = json.loads((CACHE_DIR / cache_name(query, platform)).read_text())
    except (OSError, ValueError):
        return None
    age_hours = (time.time() * 1000 - saved["fetchedAt"]) / 3_600_000
    return saved if age_hours < CACHE_HOURS else None


def trim(item: dict) -> dict:
    """Only the fields the app uses, so the cache stays small."""
    meta = item.get("videoMeta") or {}
    author = item.get("authorMeta") or {}
    music = item.get("musicMeta")
    created = item.get("createTimeISO")
    if not created and item.get("createTime"):
        created = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(item["createTime"]))
    plays = item.get("playCount") or 0
    followers = author.get("fans") or 0
    return {
        "id": str(item.get("id") or ""),
        "text": item.get("text") or "",
        "url": item.get("webVideoUrl") or "",
        "createTime": created,
        "plays": plays,
        "likes": item.get("diggCount") or 0,
        "comments": item.get("commentCount") or 0,
        "shares": item.get("shareCount") or 0,
        "saves": item.get("collectCount"),
        "duration": meta.get("duration") or 0,
        "cover": meta.get("coverUrl") or meta.get("originalCoverUrl") or "",
        "author": author.get("name") or "",
        "followers": followers,
        "music": f"{music.get('musicName') or ''} · {music.get('musicAuthor') or ''}".strip() if music else "",
        "musicOriginal": bool(music and music.get("musicOriginal")),
        "hashtags": [h["name"] for h in item.get("hashtags") or [] if h and h.get("name")],
        # Daphne's rule: views ÷ followers. A small account with huge views means the idea is good.
        "ratio": round(plays / max(followers, 1), 2),
    }


NO_DOWNLOADS = {
    "shouldDownloadVideos": False,
    "shouldDownloadCovers": False,
    "shouldDownloadSubtitles": False,
    "shouldDownloadSlideshowImages": False,
}


def run_actor(payload: dict, max_items: int, actor: str = ACTOR) -> list:
    url = (f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items"
           f"?timeout=240&maxItems={max_items}&maxTotalChargeUsd={MAX_USD_PER_SEARCH}")
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:  # never echo the URL or headers
        raise RuntimeError(f"Apify returned {e.code}: {e.read()[:300].decode(errors='replace')}")


def search_tiktok(query: str) -> list:
    items = run_actor({"searchQueries": [query], "resultsPerPage": RESULTS_PER_SEARCH, **NO_DOWNLOADS},
                      RESULTS_PER_SEARCH)
    videos = [trim(i) for i in items if i and i.get("playCount") is not None and i.get("webVideoUrl")]
    return sorted(videos, key=lambda v: v["ratio"], reverse=True)


def trim_instagram(item: dict) -> dict:
    """The same shape as trim(). The Instagram actor gives no follower counts, so followers
    and ratio stay empty and results are sorted by views."""
    music = item.get("musicInfo") or {}
    return {
        "id": str(item.get("id") or item.get("shortCode") or ""),
        "text": item.get("caption") or "",
        "url": item.get("url") or "",
        "createTime": item.get("timestamp"),
        "plays": item.get("videoPlayCount") or item.get("videoViewCount") or 0,
        "likes": max(item.get("likesCount") or 0, 0),  # -1 when the owner hides likes
        "comments": item.get("commentsCount") or 0,
        "shares": item.get("sharesCount") or 0,
        "saves": None,
        "duration": item.get("videoDuration") or 0,
        "cover": item.get("displayUrl") or "",
        "author": item.get("ownerUsername") or "",
        "followers": None,
        "music": f"{music.get('song_name') or ''} · {music.get('artist_name') or ''}".strip(" ·"),
        "musicOriginal": bool(music.get("uses_original_audio")),
        "hashtags": item.get("hashtags") or [],
        "ratio": None,
    }


def search_instagram(query: str) -> list:
    items = run_actor({"hashtags": [query], "keywordSearch": True, "resultsType": "reels",
                       "resultsLimit": RESULTS_PER_SEARCH}, RESULTS_PER_SEARCH, actor=IG_ACTOR)
    videos = [trim_instagram(i) for i in items if i and not i.get("error") and i.get("url")
              and (i.get("videoPlayCount") or i.get("videoViewCount")) is not None]
    return sorted(videos, key=lambda v: v["plays"], reverse=True)


def median_views(items: list) -> dict:
    """Each account's usual views: the median over its recent videos (from reel-studio's
    research.py score()). Accounts with fewer than MIN_VIDEOS videos are left out."""
    views = {}
    for i in items:
        name = (i.get("authorMeta") or {}).get("name")
        if name and i.get("playCount") is not None:
            views.setdefault(name, []).append(i["playCount"])
    return {name: statistics.median(v) for name, v in views.items() if len(v) >= MIN_VIDEOS}


def add_medians(videos: list) -> None:
    """Fill medianViews and outlier (views over the account's usual views) for the top accounts.
    A failure only leaves them empty: the search result is still good without them."""
    authors = list(dict.fromkeys(v["author"] for v in videos if v["author"]))[:AUTHORS_PER_SEARCH]
    medians = {}
    if authors:
        try:
            medians = median_views(run_actor({
                "profiles": authors, "resultsPerPage": VIDEOS_PER_AUTHOR, "profileSorting": "latest",
                "excludePinnedPosts": True, **NO_DOWNLOADS}, len(authors) * VIDEOS_PER_AUTHOR))
        except Exception as e:
            print(f"[search] account medians failed: {e}", flush=True)
    for v in videos:
        median = medians.get(v["author"])
        v["medianViews"] = median
        v["outlier"] = round(v["plays"] / median, 2) if median else None


@app.get("/api/health")
def health():
    return {"live": bool(TOKEN), "platforms": ["tiktok", "instagram"], "resultsPerSearch": RESULTS_PER_SEARCH}


@app.get("/api/search", response_model=SearchResult)
def search(q: str = "", fresh: str = "", platform: str = "tiktok"):
    query = q.strip()[:120]
    if not query:
        return error(400, "Type something to search.")
    if platform not in ("tiktok", "instagram"):
        return error(400, "Search TikTok or Instagram.")
    if not TOKEN:
        return error(503, "Live search is off. Add APIFY_TOKEN to .env and restart the API.")
    if fresh != "1":
        cached = read_cache(query, platform)
        if cached:
            return {**cached, "cached": True}
    if not spend("apify", SEARCH_USD[platform], DAILY_APIFY_USD):
        return over_budget("Apify", DAILY_APIFY_USD, "DAILY_APIFY_USD")
    try:
        if platform == "instagram":
            videos = search_instagram(query)  # account medians are TikTok only for now
        else:
            videos = search_tiktok(query)
            add_medians(videos)
    except Exception as e:
        name = "Instagram" if platform == "instagram" else "TikTok"
        print(f"[search] failed: {e}", flush=True)
        return error(502, f"{name} search failed. Check the API terminal for details.", str(e))
    payload = {"query": query, "platform": platform, "fetchedAt": int(time.time() * 1000), "videos": videos}
    CACHE_DIR.mkdir(exist_ok=True)
    (CACHE_DIR / cache_name(query, platform)).write_text(json.dumps(payload))
    print(f'[search] {platform} "{query}" → {len(videos)} videos', flush=True)
    return {**payload, "cached": False}


# Clients and ideas are saved as whole lists, the way the front end already holds them.
# GET returns null until something is saved, so the front end keeps its sample data.
def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    return conn


def load(key: str):
    with db() as conn:
        row = conn.execute("SELECT value FROM store WHERE key = ?", (key,)).fetchone()
    return json.loads(row[0]) if row else None


def save(key: str, items: list) -> None:
    value = json.dumps([i.model_dump(exclude_none=True) for i in items])
    with db() as conn:
        conn.execute("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)", (key, value))


@app.get("/api/clients", response_model=Optional[list[Client]], response_model_exclude_none=True)
def get_clients():
    return load("clients")


@app.put("/api/clients", response_model=list[Client], response_model_exclude_none=True)
def put_clients(clients: list[Client]):
    save("clients", clients)
    return clients


@app.get("/api/ideas", response_model=Optional[list[SavedIdea]], response_model_exclude_none=True)
def get_ideas():
    return load("ideas")


@app.put("/api/ideas", response_model=list[SavedIdea], response_model_exclude_none=True)
def put_ideas(ideas: list[SavedIdea]):
    save("ideas", ideas)
    return ideas


budget_lock = threading.Lock()


def today() -> str:
    return time.strftime("%Y-%m-%d")  # this machine's local day


def spend(wallet: str, usd: float, cap: float) -> bool:
    """Count a paid call against today's cap. Returns False, counting nothing, if it would go over."""
    key = f"spend:{today()}"
    with budget_lock:
        spent = load(key) or {}
        total = round(spent.get(wallet, 0) + usd, 2)
        if total > cap:
            return False
        with db() as conn:
            conn.execute("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)",
                         (key, json.dumps({**spent, wallet: total})))
    print(f"[budget] {wallet} US${total:.2f} of US${cap:.2f} today", flush=True)
    return True


def over_budget(name: str, cap: float, env: str) -> JSONResponse:
    return error(429, f"Today's {name} budget (US${cap:.2f}) is used up. Saved searches and finished "
                      "breakdowns still work, and the budget resets at midnight.",
                 f"To allow more, raise {env} in .env and restart the API.")


# A breakdown takes minutes, so it runs in the background and the front end polls for progress.
jobs = Jobs()


@app.post("/api/analyze", response_model=AnalyzeStarted)
def start_analyze(body: AnalyzeRequest):
    url = body.url.strip()
    if not url.startswith(("https://www.tiktok.com/", "https://www.instagram.com/")):
        return error(400, "Paste a TikTok or Instagram video link.")
    current = jobs.get(job_id_for(url))
    if (not current or current.status == "failed") and not spend("claude", ANALYZE_USD, DAILY_CLAUDE_USD):
        return over_budget("Claude", DAILY_CLAUDE_USD, "DAILY_CLAUDE_USD")
    return {"job": jobs.submit(url)}


@app.get("/api/analyze/{job_id}", response_model=AnalyzeJob, response_model_exclude_none=True)
def get_analyze(job_id: str):
    job = jobs.get(job_id)
    if not job:
        return error(404, "No breakdown with that id. Start one with POST /api/analyze.")
    return job


def pin(query: str, platform: str = "tiktok") -> None:
    src = CACHE_DIR / cache_name(query, platform)
    if not src.exists():
        sys.exit(f'No cached search for "{query}". Search it in the app first.')
    PINNED_DIR.mkdir(exist_ok=True)
    shutil.copy(src, PINNED_DIR / src.name)
    print(f'Pinned "{query}": it will load without Apify or the internet.')


if __name__ == "__main__":
    if len(sys.argv) in (3, 4) and sys.argv[1] == "pin" and sys.argv[3:] in ([], ["tiktok"], ["instagram"]):
        pin(sys.argv[2].strip()[:120], *sys.argv[3:])
    else:
        sys.exit('Usage: python backend/server.py pin "<search>" [tiktok|instagram]')
