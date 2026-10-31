"""Reddit video search through two Apify actors from clearpath: reddit-search-scraper (keyword search,
`site:v.redd.it` keeps only hosted videos) and reddit-subreddit-posts-scraper (all the subreddits' top
posts in one run). Results come back in the SearchVideo shape, with views empty (Reddit shows none) and
upvotes in their place. A post's score is its upvotes over the median upvotes of its subreddit's top
posts of the last month. Both actors answer in ~5 s and cost ~US$0.001 a post.
server.py decides when to call these and pays for them; nothing here imports it.

Every function takes `run_actor` (server.run_actor) and the actor name, so tests can pass a fake.
Free routes were tried on 2026-10-27 and are closed to this machine: reddit.com/*.json answers 403,
.rss answers 429 (and has no scores), old.reddit.com redirects to a login. trudax/reddit-scraper-lite
worked but took ~15-25 s a post and returned no videos for "tofu".
"""

import statistics
import time

RESULTS = 30  # posts asked for; with site:v.redd.it every one is a video (~US$0.03)
POSTS_PER_SUB = 10  # a subreddit's top posts of the month, for its median
MIN_POSTS = 5  # fewer posts than this and the median says little
SUBS_PER_SEARCH = 8  # subreddits looked up in the background per search (one run, ~US$0.16)


def video_post(item: dict) -> bool:
    return (item.get("_type") == "post" and item.get("postHint") == "HOSTED_VIDEO" and not item.get("isNsfw")
            and item.get("score") is not None and bool(item.get("threadUrl")))


def trim(item: dict) -> dict:
    """The same fields as server.trim. views (plays) stay empty; upvotes and community are new."""
    media = item.get("media") or {}
    cover = ((media.get("still") or {}).get("source") or {}).get("url") or item.get("thumbnail") or ""
    return {
        "id": str(item.get("id") or "").removeprefix("t3_"),
        "text": item.get("title") or "",
        "url": item["threadUrl"],
        "createTime": item.get("createdAt"),
        "plays": None,
        "likes": 0,
        "comments": item.get("commentCount") or 0,
        "shares": 0,
        "saves": None,
        "duration": (media.get("streaming") or {}).get("duration") or 0,
        "cover": cover,
        "author": item.get("author") or "",
        "followers": None,
        "music": "",
        "musicOriginal": False,
        "hashtags": [],
        "ratio": None,
        "upvotes": item["score"],
        "community": item.get("subreddit") or "",
    }


def search_posts(run_actor, query: str, actor: str) -> list:
    """Top video posts of the past year for the query, most upvoted first."""
    items = run_actor({"query": f"{query} site:v.redd.it", "maxResults": RESULTS, "contentType": "posts",
                       "sort": "top", "timeFilter": "year", "autoDiscoverSubreddits": False}, RESULTS, actor=actor)
    videos = [trim(i) for i in items if i and video_post(i)]
    return sorted(videos, key=lambda v: v["upvotes"], reverse=True)


def fetch_subreddits(run_actor, subs: list, actor: str) -> dict:
    """{subreddit: median} from one run of the subreddits' top posts of the month (videos or not).
    A subreddit that came back with fewer than MIN_POSTS is left out, so it is tried again: the
    actor sometimes drops a subreddit without an error."""
    if not subs:
        return {}
    try:
        items = run_actor({"subreddits": subs, "maxPostsPerSubreddit": POSTS_PER_SUB, "sort": "top",
                           "timeFilter": "month"}, POSTS_PER_SUB * len(subs), actor=actor)
    except Exception as e:  # the search results are already good; they just stay unscored
        print(f"[reddit] subreddit medians failed: {e}", flush=True)
        return {}
    ups = {}
    for i in items:
        if i and i.get("_type") == "post" and i.get("score") is not None:
            ups.setdefault(str(i.get("subreddit") or "").lower(), []).append(i["score"])
    return {s: statistics.median(ups[s.lower()]) for s in subs if len(ups.get(s.lower(), ())) >= MIN_POSTS}


def table(db):
    conn = db()
    conn.execute("CREATE TABLE IF NOT EXISTS reddit_subs (sub TEXT PRIMARY KEY, median REAL, fetched_at REAL NOT NULL)")
    return conn


def saved(db, subs: list, days: float) -> dict:
    """Subreddits looked up within the last `days`. A median of None means too few posts."""
    if not subs:
        return {}
    with table(db) as conn:
        rows = conn.execute(f"SELECT sub, median FROM reddit_subs WHERE fetched_at > ? "
                            f"AND sub IN ({','.join('?' * len(subs))})", (time.time() - days * 86400, *subs)).fetchall()
    return dict(rows)


def save(db, medians: dict) -> None:
    with table(db) as conn:
        conn.executemany("INSERT OR REPLACE INTO reddit_subs VALUES (?, ?, ?)",
                         [(s, m, time.time()) for s, m in medians.items()])


def apply(videos: list, medians: dict) -> None:
    """medianUpvotes and outlier: upvotes over the subreddit's usual."""
    for v in videos:
        median = medians.get(v["community"])
        v["medianUpvotes"] = median
        v["outlier"] = round(v["upvotes"] / median, 2) if median else None
