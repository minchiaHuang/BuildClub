"""Trend Finder API in Python. Replaces server/index.mjs with the same routes and response shape,
so the front end needs no change. Keeps the Apify token on this machine and caches each search on
disk, so repeating a search costs nothing.

Run (from trend-finder/):
    backend/.venv/bin/uvicorn server:app --app-dir backend --port 8787 --reload
Pin a cached search so it never expires (offline demos):
    backend/.venv/bin/python backend/server.py pin "tofu"            (add "instagram" for an Instagram search)
"""

import base64
import copy
import hashlib
import json
import os
import re
import secrets
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

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response

import channels
import reddit
import x
import youtube
from analyze import Jobs, job_id_for
from models import (AnalyzeJob, AnalyzeRequest, AnalyzeStarted, ChannelJob, ChannelRequest, ChannelStarted, Client,
                    Library, SavedIdea, SearchResult)

HERE = Path(__file__).resolve().parent
CACHE_DIR = HERE / "cache"
PINNED_DIR = HERE / "pinned"  # searches saved for demos; never expire
DB_PATH = HERE / "data.db"  # clients and saved ideas
DIST_DIR = HERE.parent / "dist"  # the built front end (npm run build), so one address serves everything


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
X_ACTOR = os.environ.get("APIFY_X_ACTOR", "kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest")
REDDIT_ACTOR = os.environ.get("APIFY_REDDIT_ACTOR", "clearpath~reddit-search-scraper")
REDDIT_SUB_ACTOR = os.environ.get("APIFY_REDDIT_SUB_ACTOR", "clearpath~reddit-subreddit-posts-scraper")
RESULTS_PER_SEARCH = int(os.environ.get("RESULTS_PER_SEARCH", 30))
CACHE_HOURS = float(os.environ.get("CACHE_HOURS", 24))
# Cost is held by maxItems: 30 results at ~$3.70/1,000 is about $0.11 (measured 0.112 on 2026-10-27).
# The charge cap is a backstop only; Apify refuses anything below $0.50.
MAX_USD_PER_SEARCH = float(os.environ.get("MAX_USD_PER_SEARCH", 0.50))
# Each account's usual views come from its latest videos: 15 accounts x 10 videos is about $0.56,
# over the search cap (at 0.50 the run stopped at 134 of 150 videos), so that run gets its own cap.
MAX_USD_PER_MEDIANS = float(os.environ.get("MAX_USD_PER_MEDIANS", 0.60))
AUTHORS_PER_SEARCH = int(os.environ.get("AUTHORS_PER_SEARCH", 15))
VIDEOS_PER_AUTHOR = int(os.environ.get("VIDEOS_PER_AUTHOR", 10))
MIN_VIDEOS = 5  # fewer recent videos than this and the median says little
MEDIAN_DAYS = 7  # an account's usual views are reused this long before they are fetched again
# Daily caps on estimated spend, so a loop or stray clicks can't run up the bill. Each paid call is
# counted before it runs; cached searches and finished breakdowns are free and never counted.
DAILY_APIFY_USD = float(os.environ.get("DAILY_APIFY_USD", 2.00))
DAILY_CLAUDE_USD = float(os.environ.get("DAILY_CLAUDE_USD", 1.00))
# Channel summaries: Jev labelling in US$; ScrapeCreators (Instagram only) in credits, 1 per 12 reels.
DAILY_JEV_USD = float(os.environ.get("DAILY_JEV_USD", 0.50))
DAILY_SCRAPECREATORS_CREDITS = float(os.environ.get("DAILY_SCRAPECREATORS_CREDITS", 20))
# X: 30 tweets at ~US$0.25-0.40 per 1,000 is about 0.01; 0.02 leaves room for the actor's minimum charge.
# Reddit (clearpath actors) is ~US$1 per 1,000 posts: 30 search results about 0.03 (measured 0.031),
# a subreddit's 10 top posts about 0.02 (measured: 8 subreddits in one run cost 0.16).
SEARCH_USD = {"tiktok": 0.12, "instagram": 0.03, "reddit": 0.03, "x": 0.02}
X_USD_PER_TWEET = 0.0004  # the dearer of the two candidate actors; account medians cost this per tweet fetched
REDDIT_USD_PER_SUB = 0.02
APIFY_USD_PER_VIDEO = 0.0037  # TikTok actor; account medians cost this per video fetched (134 videos: 0.497)
ANALYZE_USD = 0.08  # one Claude breakdown

# Set APP_PASSWORD when the app is shared through a tunnel: the browser then asks for it once.
APP_PASSWORD = os.environ.get("APP_PASSWORD", "").strip()

app = FastAPI(title="Trend Finder API")


def password_ok(header: str) -> bool:
    """Basic auth with any user name; only the password is checked."""
    scheme, _, encoded = header.partition(" ")
    try:
        password = base64.b64decode(encoded, validate=True).decode().partition(":")[2]
    except ValueError:
        return False
    return scheme.lower() == "basic" and secrets.compare_digest(password.encode(), APP_PASSWORD.encode())


@app.middleware("http")
async def require_password(request: Request, call_next):
    if APP_PASSWORD and not password_ok(request.headers.get("authorization", "")):
        return Response(status_code=401, headers={"WWW-Authenticate": 'Basic realm="Trend Finder"'})
    return await call_next(request)


def error(status: int, message: str, detail: str = "") -> JSONResponse:
    body = {"error": message, **({"detail": detail} if detail else {})}
    return JSONResponse(body, status_code=status)


def cache_name(query: str, platform: str = "tiktok") -> str:
    actor = {"instagram": IG_ACTOR, "youtube": "yt-dlp", "x": X_ACTOR, "reddit": REDDIT_ACTOR}.get(platform, ACTOR)  # TikTok keys stay as before, so pins still load
    return hashlib.sha1(f"{actor}|{RESULTS_PER_SEARCH}|{query}".encode()).hexdigest() + ".json"


def read_cache(query: str, platform: str = "tiktok"):
    pinned = PINNED_DIR / cache_name(query, platform)
    if pinned.exists():
        return json.loads(pinned.read_text())
    try:
        saved = json.loads((CACHE_DIR / cache_name(query, platform)).read_text())
    except (OSError, ValueError):
        return None
    # A fill that died with a restart left the flag on; nothing will clear it, so stop waiting.
    if saved.get("mediansPending") and cache_name(query, platform) not in filling:
        saved["mediansPending"] = False
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


def run_actor(payload: dict, max_items: int, actor: str = ACTOR, max_usd: float = MAX_USD_PER_SEARCH) -> list:
    url = (f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items"
           f"?timeout=240&maxItems={max_items}&maxTotalChargeUsd={max_usd}")
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


def saved_medians(authors: list) -> dict:
    """Account medians fetched in the last MEDIAN_DAYS. None means the account had too few videos."""
    if not authors:
        return {}
    since = time.time() - MEDIAN_DAYS * 86400
    with db() as conn:
        rows = conn.execute(f"SELECT author, median FROM medians WHERE fetched_at > ? AND author IN "
                            f"({','.join('?' * len(authors))})", (since, *authors)).fetchall()
    return dict(rows)


def save_medians(medians: dict) -> None:
    with db() as conn:
        conn.executemany("INSERT OR REPLACE INTO medians (author, median, fetched_at) VALUES (?, ?, ?)",
                         [(a, m, time.time()) for a, m in medians.items()])


def apply_medians(videos: list, medians: dict) -> None:
    """medianViews and outlier: views over the account's usual views."""
    for v in videos:
        median = medians.get(v["author"])
        v["medianViews"] = median
        v["outlier"] = round(v["plays"] / median, 2) if median else None


def fetch_medians(missing: list) -> dict:
    """Fetch and pay for accounts not seen in the last week. A failure only leaves them empty:
    the search result is still good without them."""
    if not spend("apify", round(len(missing) * VIDEOS_PER_AUTHOR * APIFY_USD_PER_VIDEO, 2), DAILY_APIFY_USD):
        print("[search] account medians skipped: today's Apify budget is used up", flush=True)
        return {}
    try:
        found = median_views(run_actor({
            "profiles": missing, "resultsPerPage": VIDEOS_PER_AUTHOR, "profileSorting": "latest",
            "excludePinnedPosts": True, **NO_DOWNLOADS}, len(missing) * VIDEOS_PER_AUTHOR, max_usd=MAX_USD_PER_MEDIANS))
    except Exception as e:
        print(f"[search] account medians failed: {e}", flush=True)
        return {}
    fresh = {a: found.get(a) for a in missing}
    save_medians(fresh)
    return fresh


# Fetching account medians takes about 40 seconds, so the search returns first and the cache
# file is rewritten with the medians when they arrive. The front end polls the (free) cached search.
filling = set()  # cache file names still waiting for medians


def in_background(fill) -> None:
    threading.Thread(target=fill, daemon=True).start()


def write_cache(payload: dict) -> None:
    # Written whole and swapped in, so a poll never reads half a file and searches live (paid) instead.
    CACHE_DIR.mkdir(exist_ok=True)
    target = CACHE_DIR / cache_name(payload["query"], payload["platform"])
    partial = target.with_suffix(f".{threading.get_ident()}.tmp")
    partial.write_text(json.dumps(payload))
    os.replace(partial, target)


def fill_medians(payload: dict, medians: dict, missing: list) -> None:
    try:
        medians = {**medians, **fetch_medians(missing)}
        apply_medians(payload["videos"], medians)
        payload["mediansPending"] = False
        write_cache(payload)
        scored = sum(1 for v in payload["videos"] if v["outlier"] is not None)
        print(f'[search] tiktok "{payload["query"]}" → medians for {scored} videos', flush=True)
    finally:
        filling.discard(cache_name(payload["query"], payload["platform"]))


def search_youtube(query: str):
    """Free (yt-dlp), so nothing is counted against the daily caps. Channel scores are filled afterwards,
    the same way as TikTok's."""
    try:
        videos = youtube.search_shorts(query)
        channels = list(dict.fromkeys(v["channelId"] for v in videos if v["channelId"]))
        stats = youtube.saved(db, channels, MEDIAN_DAYS)
        youtube.apply(videos, stats)
    except Exception as e:
        print(f"[search] failed: {e}", flush=True)
        return error(502, "YouTube search failed. Check the API terminal for details.", str(e))
    missing = [c for c in channels if c not in stats]
    payload = {"query": query, "platform": "youtube", "fetchedAt": int(time.time() * 1000), "videos": videos,
               "mediansPending": bool(missing)}
    write_cache(payload)
    print(f'[search] youtube "{query}" → {len(videos)} videos', flush=True)
    if missing:
        filling.add(cache_name(query, "youtube"))
        background = copy.deepcopy(payload)

        def fill():
            try:
                found = youtube.fetch_channels(missing)
                youtube.save(db, found)
                youtube.apply(background["videos"], {**stats, **found})
                background["mediansPending"] = False
                write_cache(background)
                print(f'[search] youtube "{query}" → scores for {len(found)} of {len(missing)} channels', flush=True)
            finally:
                filling.discard(cache_name(query, "youtube"))

        in_background(fill)
    return {**payload, "cached": False}


def search_x(query: str):
    """Video tweets for the keyword. Account medians (one batched run) are filled afterwards, like TikTok's."""
    def run(payload, max_items):
        return run_actor(payload, max_items, actor=X_ACTOR)

    try:
        videos = x.search_videos(query, run)
        authors = list(dict.fromkeys(v["author"] for v in videos))
        medians = x.saved(db, authors, MEDIAN_DAYS)
        x.apply(videos, medians)
    except Exception as e:
        print(f"[search] failed: {e}", flush=True)
        return error(502, "X search failed. Check the API terminal for details.", str(e))
    missing = [a for a in authors if a.lower() not in medians][:x.AUTHORS_PER_FILL]
    payload = {"query": query, "platform": "x", "fetchedAt": int(time.time() * 1000), "videos": videos,
               "mediansPending": bool(missing)}
    write_cache(payload)
    print(f'[search] x "{query}" → {len(videos)} videos', flush=True)
    if missing:
        filling.add(cache_name(query, "x"))
        background = copy.deepcopy(payload)

        def fill():
            try:
                found = {}
                if spend("apify", round(len(missing) * x.ITEMS_PER_AUTHOR * X_USD_PER_TWEET, 4), DAILY_APIFY_USD):
                    try:
                        found = x.fetch_medians(missing, run)
                        x.save(db, found)
                    except Exception as e:
                        print(f"[search] x medians failed: {e}", flush=True)
                else:
                    print("[search] x medians skipped: today's Apify budget is used up", flush=True)
                x.apply(background["videos"], {**medians, **found})
                background["mediansPending"] = False
                write_cache(background)
            finally:
                filling.discard(cache_name(query, "x"))

        in_background(fill)
    return {**payload, "cached": False}


def search_reddit(query: str):
    """The search itself is already paid for (counted by the caller). Up to SUBS_PER_SEARCH subreddit
    medians are paid for and fetched in the background, the way TikTok's account medians are."""
    try:
        videos = reddit.search_posts(run_actor, query, REDDIT_ACTOR)
        subs = list(dict.fromkeys(v["community"] for v in videos if v["community"]))
        medians = reddit.saved(db, subs, MEDIAN_DAYS)
        reddit.apply(videos, medians)
    except Exception as e:
        print(f"[search] failed: {e}", flush=True)
        return error(502, "Reddit search failed. Check the API terminal for details.", str(e))
    missing = [s for s in subs if s not in medians][:reddit.SUBS_PER_SEARCH]
    payload = {"query": query, "platform": "reddit", "fetchedAt": int(time.time() * 1000), "videos": videos,
               "mediansPending": bool(missing)}
    write_cache(payload)
    print(f'[search] reddit "{query}" → {len(videos)} videos', flush=True)
    if missing:
        filling.add(cache_name(query, "reddit"))
        background = copy.deepcopy(payload)

        def fill():
            try:
                found = {}
                if spend("apify", round(len(missing) * REDDIT_USD_PER_SUB, 2), DAILY_APIFY_USD):
                    found = reddit.fetch_subreddits(run_actor, missing, REDDIT_SUB_ACTOR)
                    reddit.save(db, found)
                else:
                    print("[search] subreddit medians skipped: today's Apify budget is used up", flush=True)
                reddit.apply(background["videos"], {**medians, **found})
                background["mediansPending"] = False
                write_cache(background)
                print(f'[search] reddit "{query}" → scores for {len(found)} of {len(missing)} subreddits', flush=True)
            finally:
                filling.discard(cache_name(query, "reddit"))

        in_background(fill)
    return {**payload, "cached": False}


@app.get("/api/health")
def health():
    # yt-dlp alone is enough for live YouTube search; TikTok, Instagram, Reddit and X need the Apify token.
    return {"live": bool(TOKEN) or bool(shutil.which("yt-dlp")), "platforms": ["tiktok", "instagram", "youtube", "reddit", "x"],
            "resultsPerSearch": RESULTS_PER_SEARCH}


@app.get("/api/search", response_model=SearchResult)
def search(q: str = "", fresh: str = "", platform: str = "tiktok", cachedOnly: str = ""):
    query = q.strip()[:120]
    if not query:
        return error(400, "Type something to search.")
    if platform not in ("tiktok", "instagram", "youtube", "reddit", "x"):
        return error(400, "Search TikTok, Instagram, YouTube, Reddit or X.")
    if not TOKEN and platform != "youtube":
        return error(503, "Live search is off. Add APIFY_TOKEN to .env and restart the API.")
    if fresh != "1":
        cached = read_cache(query, platform)
        if cached:
            return {**cached, "cached": True}
    if cachedOnly == "1":  # the front end's poll for scores must never start a paid search
        return error(404, "No saved search for that. Search it first.")
    if platform == "youtube":
        return search_youtube(query)
    if not spend("apify", SEARCH_USD[platform], DAILY_APIFY_USD):
        return over_budget("Apify", DAILY_APIFY_USD, "DAILY_APIFY_USD")
    if platform == "x":
        return search_x(query)
    medians, missing = {}, []
    try:
        if platform == "reddit":
            return search_reddit(query)  # subreddit medians are filled in the background
        if platform == "instagram":
            videos = search_instagram(query)  # account medians are TikTok only for now
        else:
            videos = search_tiktok(query)
            # Accounts seen in the last week are scored now; up to AUTHORS_PER_SEARCH others later.
            authors = list(dict.fromkeys(v["author"] for v in videos if v["author"]))
            medians = saved_medians(authors)
            missing = [a for a in authors if a not in medians][:AUTHORS_PER_SEARCH]
            apply_medians(videos, medians)
    except Exception as e:
        name = "Instagram" if platform == "instagram" else "TikTok"
        print(f"[search] failed: {e}", flush=True)
        return error(502, f"{name} search failed. Check the API terminal for details.", str(e))
    payload = {"query": query, "platform": platform, "fetchedAt": int(time.time() * 1000), "videos": videos,
               "mediansPending": bool(missing)}
    write_cache(payload)
    print(f'[search] {platform} "{query}" → {len(videos)} videos', flush=True)
    if missing:
        filling.add(cache_name(query, platform))
        background = copy.deepcopy(payload)  # the reply below must not change while it is filled
        in_background(lambda: fill_medians(background, medians, missing))
    return {**payload, "cached": False}


# Clients and ideas are saved as whole lists, the way the front end already holds them.
# GET returns null until something is saved, so the front end keeps its sample data.
def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    conn.execute("CREATE TABLE IF NOT EXISTS medians (author TEXT PRIMARY KEY, median REAL, fetched_at REAL NOT NULL)")
    return conn


def load(key: str):
    with db() as conn:
        row = conn.execute("SELECT value FROM store WHERE key = ?", (key,)).fetchone()
    return json.loads(row[0]) if row else None


def save(key: str, items) -> None:
    value = json.dumps([i.model_dump(exclude_none=True) for i in items] if isinstance(items, list) else items.model_dump())
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


# Without these, saved ideas open in another browser have no video to show.
@app.get("/api/library", response_model=Optional[Library])
def get_library():
    return load("library")


@app.put("/api/library", response_model=Library)
def put_library(library: Library):
    save("library", library)
    return library


budget_lock = threading.Lock()


def today() -> str:
    return time.strftime("%Y-%m-%d")  # this machine's local day


def spend(wallet: str, usd: float, cap: float) -> bool:
    """Count a paid call against today's cap. Returns False, counting nothing, if it would go over."""
    key = f"spend:{today()}"
    with budget_lock:
        spent = load(key) or {}
        total = round(spent.get(wallet, 0) + usd, 4)  # 4 places: a Jev label costs less than a cent
        if total > cap:
            return False
        with db() as conn:
            conn.execute("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)",
                         (key, json.dumps({**spent, wallet: total})))
    print(f"[budget] {wallet} US${total:.4f} of US${cap:.2f} today", flush=True)
    return True


def over_budget(name: str, cap: float, env: str, unit: str = "US$") -> JSONResponse:
    return error(429, f"Today's {name} budget ({unit}{cap:.2f}) is used up. Saved searches and finished "
                      "breakdowns still work, and the budget resets at midnight.",
                 f"To allow more, raise {env} in .env and restart the API.")


# A breakdown takes minutes, so it runs in the background and the front end polls for progress.
jobs = Jobs()


X_STATUS = re.compile(r"https://(www\.|mobile\.)?(x|twitter)\.com/\w+/status/\d+")


@app.post("/api/analyze", response_model=AnalyzeStarted)
def start_analyze(body: AnalyzeRequest):
    url = body.url.strip()
    if not (url.startswith(("https://www.tiktok.com/", "https://www.instagram.com/", "https://www.youtube.com/shorts/",
                            "https://youtube.com/shorts/", "https://www.reddit.com/r/", "https://v.redd.it/")) or X_STATUS.match(url)):
        return error(400, "Paste a TikTok, Instagram, YouTube Shorts, Reddit video or X link.")
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


# A channel summary takes minutes to an hour, so it also runs in the background and is polled.
CHANNEL_CAPS = {"claude": DAILY_CLAUDE_USD, "jev": DAILY_JEV_USD, "scrapecreators": DAILY_SCRAPECREATORS_CREDITS}


def budget_left(wallet: str, cap: float) -> float:
    return cap - (load(f"spend:{today()}") or {}).get(wallet, 0)


channel_jobs = channels.ChannelJobs(lambda w, n: spend(w, n, CHANNEL_CAPS[w]),
                                    lambda w: budget_left(w, CHANNEL_CAPS[w]))


@app.post("/api/channel", response_model=ChannelStarted)
def start_channel(body: ChannelRequest):
    if not 1 <= body.maxVideos <= channels.MAX_VIDEOS:
        return error(400, f"Decode between 1 and {channels.MAX_VIDEOS} videos.")
    try:
        handle = channels.normalise(body.platform, body.handle)
        return {"job": channel_jobs.submit(body.platform, handle, body.maxVideos)}
    except ValueError as e:
        return error(400, str(e))
    except channels.OverBudget as e:
        name, env = channels.WALLETS[e.wallet]
        return over_budget(name, CHANNEL_CAPS[e.wallet], env, "" if e.wallet == "scrapecreators" else "US$")


@app.get("/api/channel/{job_id}", response_model=ChannelJob, response_model_exclude_none=True)
def get_channel(job_id: str):
    job = channel_jobs.get(job_id)
    if not job:
        return error(404, "No channel summary with that id. Start one with POST /api/channel.")
    return job


@app.get("/api/channel/{job_id}/thumb/{name}")
def get_channel_thumb(job_id: str, name: str):
    path = channels.thumb_path(job_id, name)
    if not path:
        return error(404, "No such thumbnail.")
    return FileResponse(path, media_type="image/jpeg")


# Last route, so it never shadows the API: built files by path, and the app for anything else.
@app.get("/{path:path}", include_in_schema=False)
def front_end(path: str):
    if path.startswith("api/"):
        return error(404, "No such API route. See /docs.")
    target = (DIST_DIR / path).resolve()
    if path and target.is_file() and target.is_relative_to(DIST_DIR.resolve()):
        return FileResponse(target)
    index = DIST_DIR / "index.html"
    if not index.exists():
        return error(404, "The app isn't built yet. Run npm run build in trend-finder/.")
    return FileResponse(index)


def pin(query: str, platform: str = "tiktok") -> None:
    src = CACHE_DIR / cache_name(query, platform)
    if not src.exists():
        sys.exit(f'No cached search for "{query}". Search it in the app first.')
    PINNED_DIR.mkdir(exist_ok=True)
    shutil.copy(src, PINNED_DIR / src.name)
    print(f'Pinned "{query}": it will load without Apify or the internet.')


if __name__ == "__main__":
    platforms = ["tiktok", "instagram", "youtube", "reddit", "x"]
    if len(sys.argv) in (3, 4) and sys.argv[1] == "pin" and (sys.argv[3:] == [] or sys.argv[3] in platforms):
        pin(sys.argv[2].strip()[:120], *sys.argv[3:])
    else:
        sys.exit(f'Usage: python backend/server.py pin "<search>" [{"|".join(platforms)}]')
