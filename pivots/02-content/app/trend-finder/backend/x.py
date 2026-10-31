"""X (Twitter) video-tweet search through an Apify actor. Results come back in the same shape as
TikTok's (server.trim). server.py decides when to call these and pays for them; nothing here imports it.

Actor: kaitoeasyapi's tweet scraper. Chosen over apidojo/tweet-scraper because its documented output
has `viewCount` (apidojo's README shows none), plus `author.followers`, and it takes `filter:native_video`.
Its docs do not show the media layout, so media is read defensively (see media_list).

Outlier score: views / the author's median views over recent video tweets. All authors of a search
are fetched in ONE actor run (`from:a OR from:b ...`, capped at AUTHORS_PER_FILL), cheaper than a run
per author. Authors that return fewer than MIN_VIDEOS videos get no median and keep views / followers.
"""

import statistics
import time
from datetime import datetime, timezone

RESULTS = 30  # video tweets per search (the actor's minimum is 20)
AUTHORS_PER_FILL = 10
ITEMS_PER_AUTHOR = 10
MIN_VIDEOS = 3  # tweets are sparser than TikTok videos; fewer than this and the median says little
VIDEO_FILTER = "filter:native_video"


def number(value) -> int:
    try:
        return max(int(value), 0)
    except (TypeError, ValueError):
        return 0


def media_list(item: dict) -> list:
    """Every media dict on the tweet, from extendedEntities and the top-level media field."""
    found = []
    ext = item.get("extendedEntities")
    if isinstance(ext, dict):
        found += ext.get("media") or []
    top = item.get("media")
    if isinstance(top, list):
        found += top
    elif isinstance(top, dict):
        found += top.get("videos") or top.get("all") or []
    return [m for m in found if isinstance(m, dict)]


def is_video(media: dict) -> bool:
    return media.get("type") == "video" or bool(media.get("video_info"))


def has_video(item: dict) -> bool:
    """The search already asks for native video. If the item shows its media, it must contain a video;
    if the actor gives no media detail at all, trust the query."""
    media = media_list(item)
    return not media or any(is_video(m) for m in media)


def created_iso(value):
    """"Thu Oct 17 09:30:41 +0000 2024" to ISO, or None."""
    try:
        return datetime.strptime(value, "%a %b %d %H:%M:%S %z %Y").astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    except (TypeError, ValueError):
        return None


def trim(item: dict) -> dict:
    """The same fields as server.trim."""
    author = item.get("author") or {}
    user = author.get("userName") or ""
    media = next((m for m in media_list(item) if is_video(m)), {})
    plays = number(item.get("viewCount"))
    followers = number(author.get("followers"))
    tweet_id = str(item.get("id") or "")
    return {
        "id": tweet_id,
        "text": item.get("text") or "",
        "url": f"https://x.com/{user}/status/{tweet_id}",
        "createTime": created_iso(item.get("createdAt")),
        "plays": plays,
        "likes": number(item.get("likeCount")),
        "comments": number(item.get("replyCount")),
        "shares": number(item.get("retweetCount")),
        "saves": item.get("bookmarkCount"),
        "duration": number((media.get("video_info") or {}).get("duration_millis")) / 1000,
        "cover": media.get("media_url_https") or media.get("media_url") or "",
        "author": user,
        "followers": followers,
        "music": "",
        "musicOriginal": False,
        "hashtags": [h["text"] for h in (item.get("entities") or {}).get("hashtags") or []
                     if isinstance(h, dict) and h.get("text")],
        "ratio": round(plays / max(followers, 1), 2),
    }


def search_videos(query: str, run) -> list:
    """`run(payload, max_items)` is the paid actor call. Video tweets, most views per follower first."""
    items = run({"searchTerms": [f"{query} {VIDEO_FILTER}"], "queryType": "Top", "maxItems": RESULTS}, RESULTS)
    seen, videos = set(), []
    for i in items:
        if not i or not i.get("id") or not (i.get("author") or {}).get("userName"):
            continue
        if i.get("isRetweet") or i.get("viewCount") is None or not has_video(i) or str(i["id"]) in seen:
            continue
        seen.add(str(i["id"]))
        videos.append(trim(i))
    return sorted(videos, key=lambda v: v["ratio"], reverse=True)


def fetch_medians(authors: list, run) -> dict:
    """{author (lower case): median views or None}, for all `authors` in one actor run."""
    query = " OR ".join(f"from:{a}" for a in authors) + f" {VIDEO_FILTER}"
    n = len(authors) * ITEMS_PER_AUTHOR
    items = run({"searchTerms": [query], "queryType": "Latest", "maxItems": n}, n)
    views = {}
    for i in items:
        name = ((i or {}).get("author") or {}).get("userName")
        if name and not i.get("isRetweet") and i.get("viewCount") is not None and has_video(i):
            views.setdefault(name.lower(), []).append(number(i["viewCount"]))
    return {a.lower(): (statistics.median(views[a.lower()]) if len(views.get(a.lower(), [])) >= MIN_VIDEOS else None)
            for a in authors}


def table(db):
    conn = db()
    conn.execute("CREATE TABLE IF NOT EXISTS x_medians (author TEXT PRIMARY KEY, median REAL, fetched_at REAL NOT NULL)")
    return conn


def saved(db, authors: list, days: float) -> dict:
    """Medians fetched within `days`. None means the author had too few video tweets."""
    authors = [a.lower() for a in authors]
    if not authors:
        return {}
    with table(db) as conn:
        rows = conn.execute(f"SELECT author, median FROM x_medians WHERE fetched_at > ? AND author IN "
                            f"({','.join('?' * len(authors))})", (time.time() - days * 86400, *authors)).fetchall()
    return dict(rows)


def save(db, medians: dict) -> None:
    with table(db) as conn:
        conn.executemany("INSERT OR REPLACE INTO x_medians VALUES (?, ?, ?)",
                         [(a, m, time.time()) for a, m in medians.items()])


def apply(videos: list, medians: dict) -> None:
    """medianViews and outlier. With no median the front end falls back to views / followers."""
    for v in videos:
        median = medians.get(v["author"].lower())
        v["medianViews"] = median
        v["outlier"] = round(v["plays"] / median, 2) if median else None
