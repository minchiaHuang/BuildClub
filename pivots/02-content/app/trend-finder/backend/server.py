"""Trend Finder API in Python. Replaces server/index.mjs with the same routes and response shape,
so the front end needs no change. Keeps the Apify token on this machine and caches each search on
disk, so repeating a search costs nothing.

Run (from trend-finder/):
    backend/.venv/bin/uvicorn server:app --app-dir backend --port 8787 --reload
Pin a cached search so it never expires (offline demos):
    backend/.venv/bin/python backend/server.py pin "tofu"
"""

import hashlib
import json
import os
import shutil
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from models import Client, SavedIdea

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
RESULTS_PER_SEARCH = int(os.environ.get("RESULTS_PER_SEARCH", 30))
CACHE_HOURS = float(os.environ.get("CACHE_HOURS", 24))
# Cost is held by maxItems: 30 results at ~$1.70/1,000 is about $0.05.
# The charge cap is a backstop only; Apify refuses anything below $0.50.
MAX_USD_PER_SEARCH = float(os.environ.get("MAX_USD_PER_SEARCH", 0.50))

app = FastAPI(title="Trend Finder API")


def error(status: int, message: str, detail: str = "") -> JSONResponse:
    body = {"error": message, **({"detail": detail} if detail else {})}
    return JSONResponse(body, status_code=status)


def cache_name(query: str) -> str:
    return hashlib.sha1(f"{ACTOR}|{RESULTS_PER_SEARCH}|{query}".encode()).hexdigest() + ".json"


def read_cache(query: str):
    pinned = PINNED_DIR / cache_name(query)
    if pinned.exists():
        return json.loads(pinned.read_text())
    try:
        saved = json.loads((CACHE_DIR / cache_name(query)).read_text())
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


def search_tiktok(query: str) -> list:
    url = (f"https://api.apify.com/v2/acts/{ACTOR}/run-sync-get-dataset-items"
           f"?timeout=240&maxItems={RESULTS_PER_SEARCH}&maxTotalChargeUsd={MAX_USD_PER_SEARCH}")
    payload = {
        "searchQueries": [query],
        "resultsPerPage": RESULTS_PER_SEARCH,
        "shouldDownloadVideos": False,
        "shouldDownloadCovers": False,
        "shouldDownloadSubtitles": False,
        "shouldDownloadSlideshowImages": False,
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            items = json.loads(resp.read())
    except urllib.error.HTTPError as e:  # never echo the URL or headers
        raise RuntimeError(f"Apify returned {e.code}: {e.read()[:300].decode(errors='replace')}")
    videos = [trim(i) for i in items if i and i.get("playCount") is not None and i.get("webVideoUrl")]
    return sorted(videos, key=lambda v: v["ratio"], reverse=True)


@app.get("/api/health")
def health():
    return {"live": bool(TOKEN), "platforms": ["tiktok"], "resultsPerSearch": RESULTS_PER_SEARCH}


@app.get("/api/search")
def search(q: str = "", fresh: str = ""):
    query = q.strip()[:120]
    if not query:
        return error(400, "Type something to search.")
    if not TOKEN:
        return error(503, "Live search is off. Add APIFY_TOKEN to .env and restart the API.")
    if fresh != "1":
        cached = read_cache(query)
        if cached:
            return {**cached, "cached": True}
    try:
        videos = search_tiktok(query)
    except Exception as e:
        print(f"[search] failed: {e}", flush=True)
        return error(502, "TikTok search failed. Check the API terminal for details.", str(e))
    payload = {"query": query, "platform": "tiktok", "fetchedAt": int(time.time() * 1000), "videos": videos}
    CACHE_DIR.mkdir(exist_ok=True)
    (CACHE_DIR / cache_name(query)).write_text(json.dumps(payload))
    print(f'[search] "{query}" → {len(videos)} videos', flush=True)
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


def pin(query: str) -> None:
    src = CACHE_DIR / cache_name(query)
    if not src.exists():
        sys.exit(f'No cached search for "{query}". Search it in the app first.')
    PINNED_DIR.mkdir(exist_ok=True)
    shutil.copy(src, PINNED_DIR / src.name)
    print(f'Pinned "{query}": it will load without Apify or the internet.')


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "pin":
        pin(sys.argv[2].strip()[:120])
    else:
        sys.exit('Usage: python backend/server.py pin "<search>"')
