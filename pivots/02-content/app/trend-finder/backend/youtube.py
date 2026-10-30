"""YouTube Shorts search through yt-dlp: free, no key, no Apify. Results come back in the same shape
as TikTok's (server.trim), and each channel's usual views (the median over its latest Shorts) give
the same outlier score. server.py decides when to call these; nothing here imports it.

yt-dlp's flat search lists views, channel and length, but no subscriber count, so a second call per
channel (its /shorts tab) gives the subscribers and the last Shorts' views.
"""

import json
import re
import statistics
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

RESULTS = 30  # videos returned per search, like the other platforms
FETCH = 120  # searched for, because only about one in ten YouTube search hits is a Short (about 4 s)
MAX_SECONDS = 60  # a Short is up to a minute; videos with no length are kept
VIDEOS_PER_CHANNEL = 10
MIN_SHORTS = 5  # fewer recent Shorts than this and the median says little
WORKERS = 4  # channel lookups at once


def run_json(args: list, timeout: int = 60) -> dict:
    """Run yt-dlp (already needed for breakdowns) and return its JSON."""
    r = subprocess.run(["yt-dlp", "--flat-playlist", "-J", "--no-warnings", "--socket-timeout", "20", *args],
                       capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=timeout)
    if r.returncode != 0 or not r.stdout.strip():
        raise RuntimeError(f"yt-dlp failed: {r.stderr.strip()[-200:]}")
    return json.loads(r.stdout)


def trim(entry: dict) -> dict:
    """The same fields as server.trim. YouTube gives no likes, comments or sound in a search, and
    followers/ratio are filled in once the channel is looked up."""
    title = entry.get("title") or ""
    vid = entry["id"]
    return {
        "id": vid,
        "text": title,
        "url": f"https://www.youtube.com/shorts/{vid}",
        "createTime": None,
        "plays": entry.get("view_count") or 0,
        "likes": 0,
        "comments": 0,
        "shares": 0,
        "saves": None,
        "duration": entry.get("duration") or 0,
        "cover": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",  # hq720 and the portrait oar2 are missing for many Shorts
        "author": entry.get("channel") or entry.get("uploader") or "",
        "channelId": entry.get("channel_id") or "",
        "followers": None,
        "music": "",
        "musicOriginal": False,
        "hashtags": re.findall(r"#(\w+)", title),
        "ratio": None,
    }


def search_shorts(query: str) -> list:
    # "#shorts" finds about 3x more Shorts than "shorts"
    data = run_json([f"ytsearch{FETCH}:{query} #shorts"])
    seen, videos = set(), []
    for e in data.get("entries") or []:
        if not e or not e.get("id") or e["id"] in seen or e.get("view_count") is None:
            continue
        if e.get("duration") is not None and e["duration"] > MAX_SECONDS:
            continue
        seen.add(e["id"])
        videos.append(trim(e))
    return sorted(videos, key=lambda v: v["plays"], reverse=True)[:RESULTS]


def channel_stats(channel_id: str) -> tuple:
    """(usual views, subscribers) of a channel. Usual views is None below MIN_SHORTS Shorts."""
    try:
        data = run_json(["--playlist-end", str(VIDEOS_PER_CHANNEL), f"https://www.youtube.com/channel/{channel_id}/shorts"])
    except RuntimeError as e:
        if "does not have a shorts tab" in str(e):  # a real answer, not a failure: remember it
            return None, None
        raise
    views = [e["view_count"] for e in data.get("entries") or [] if e and e.get("view_count") is not None]
    return (statistics.median(views) if len(views) >= MIN_SHORTS else None), data.get("channel_follower_count")


def fetch_channels(channel_ids: list) -> dict:
    """{channel id: (usual views, subscribers)}. A channel that fails is left out, so it is tried again."""
    def one(cid):
        try:
            return cid, channel_stats(cid)
        except Exception as e:
            print(f"[youtube] channel {cid} failed: {e}", flush=True)
            return cid, None

    with ThreadPoolExecutor(WORKERS) as pool:
        return {cid: stats for cid, stats in pool.map(one, channel_ids) if stats}


def table(db):
    conn = db()
    conn.execute("CREATE TABLE IF NOT EXISTS youtube_channels (channel_id TEXT PRIMARY KEY, median REAL, "
                 "followers INTEGER, fetched_at REAL NOT NULL)")
    return conn


def saved(db, channel_ids: list, days: float) -> dict:
    """Channels looked up within the last `days`. A median of None means the channel had too few Shorts."""
    if not channel_ids:
        return {}
    with table(db) as conn:
        rows = conn.execute(f"SELECT channel_id, median, followers FROM youtube_channels WHERE fetched_at > ? "
                            f"AND channel_id IN ({','.join('?' * len(channel_ids))})",
                            (time.time() - days * 86400, *channel_ids)).fetchall()
    return {cid: (median, followers) for cid, median, followers in rows}


def save(db, stats: dict) -> None:
    with table(db) as conn:
        conn.executemany("INSERT OR REPLACE INTO youtube_channels VALUES (?, ?, ?, ?)",
                         [(cid, m, f, time.time()) for cid, (m, f) in stats.items()])


def apply(videos: list, stats: dict) -> None:
    """followers, ratio, medianViews and outlier, the same fields TikTok results carry."""
    for v in videos:
        median, followers = stats.get(v["channelId"], (None, None))
        if followers is not None:
            v["followers"] = followers
            v["ratio"] = round(v["plays"] / max(followers, 1), 2)
        v["medianViews"] = median
        v["outlier"] = round(v["plays"] / median, 2) if median else None
