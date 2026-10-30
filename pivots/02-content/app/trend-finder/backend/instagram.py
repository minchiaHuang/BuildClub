"""Instagram account baselines: each account's usual plays, from its latest reels. The shape matches
server.account_baselines (TikTok); nothing here imports server, which decides when to call and pays.

Actor: apify~instagram-reel-scraper. Source: https://apify.com/apify/instagram-reel-scraper (README) and
https://apify.com/apify/instagram-reel-scraper/api/openapi (input schema), accessed 2026-10-30, read only,
no actor was run.
- Input: `username` (array of usernames, profile URLs, ids or reel URLs, each processed on its own) and
  `resultsLimit` (reels per profile). `skipPinnedPosts` excludes pinned reels.
- Output per reel: `ownerUsername`, `videoPlayCount` and `videoViewCount` (both documented; the README
  sample shows 355615 and 70261 for one reel), `timestamp` (ISO, e.g. "2026-04-18T19:15:54.000Z").
  The same order as server.trim_instagram: plays first, then views.
- Followers: the actor documents NO follower count (its README points to the Instagram Profile Scraper
  for that). `followers` is therefore read from an optional `followersCount` and is None without it;
  that key name is not documented and has never been seen in a real result.
- Price: "from $1.00 / 1,000 reels"; the README's Free plan figure is $2.60 per 1,000 ($0.0026 per
  reel), used here as the dearer case. Starter plan: $2.30 per 1,000.
"""

import os
import statistics
import time

REEL_ACTOR = os.environ.get("APIFY_INSTAGRAM_REEL_ACTOR", "apify~instagram-reel-scraper")
REELS_PER_ACCOUNT = 6
MIN_VIDEOS = 5  # fewer recent reels than this and the median says little
ACCOUNTS_PER_FILL = 15
USD_PER_REEL = 0.0026


def plays(item: dict):
    """videoPlayCount, then videoViewCount, as server.trim_instagram does."""
    return item.get("videoPlayCount") or item.get("videoViewCount")


def baselines(items: list) -> dict:
    """{account: median, n, from, to, followers}; accounts with fewer than MIN_VIDEOS reels are left out."""
    by_author = {}
    for i in items:
        name = (i or {}).get("ownerUsername")
        if name and not i.get("error") and plays(i) is not None:
            by_author.setdefault(name, []).append(i)
    found = {}
    for name, reels in by_author.items():
        if len(reels) < MIN_VIDEOS:
            continue
        dates = sorted(r["timestamp"][:10] for r in reels if r.get("timestamp"))
        followers = next((r["followersCount"] for r in reels if r.get("followersCount")), None)
        found[name] = {"median": statistics.median(plays(r) for r in reels), "n": len(reels),
                       "from": dates[0] if dates else None, "to": dates[-1] if dates else None,
                       "followers": followers}
    return found


def fetch_baselines(accounts: list, run) -> dict:
    """{account: baseline or None}, all `accounts` in one actor run. `run(payload, max_items)` is the paid call."""
    n = len(accounts) * REELS_PER_ACCOUNT
    items = run({"username": accounts, "resultsLimit": REELS_PER_ACCOUNT, "skipPinnedPosts": True}, n)
    found = baselines(items)
    return {a: found.get(a) for a in accounts}


def table(db):
    conn = db()
    conn.execute("CREATE TABLE IF NOT EXISTS ig_medians (author TEXT PRIMARY KEY, median REAL, n INTEGER, "
                 "base_from TEXT, base_to TEXT, followers INTEGER, fetched_at REAL NOT NULL)")
    return conn


def saved(db, accounts: list, days: float) -> dict:
    """Baselines fetched within `days`, with fetchedAt in ms. None means too few reels."""
    if not accounts:
        return {}
    with table(db) as conn:
        rows = conn.execute(f"SELECT author, median, n, base_from, base_to, followers, fetched_at FROM ig_medians "
                            f"WHERE fetched_at > ? AND author IN ({','.join('?' * len(accounts))})",
                            (time.time() - days * 86400, *accounts)).fetchall()
    return {a: None if m is None else {"median": m, "n": n, "from": f, "to": t, "followers": fol,
                                       "fetchedAt": int(at * 1000)}
            for a, m, n, f, t, fol, at in rows}


def save(db, found: dict) -> None:
    now = time.time()
    with table(db) as conn:
        conn.executemany("INSERT OR REPLACE INTO ig_medians VALUES (?, ?, ?, ?, ?, ?, ?)",
                         [(a, b and b["median"], b and b["n"], b and b["from"], b and b["to"],
                           b and b.get("followers"), now) for a, b in found.items()])


def apply(videos: list, found: dict) -> None:
    """Sets the same fields as server.apply_medians, plus followers when the baseline has them."""
    for v in videos:
        b = found.get(v["author"])
        median = b and b["median"]
        if b and b.get("followers"):
            v["followers"] = b["followers"]
        v["medianViews"] = median
        v["outlier"] = round(v["plays"] / median, 2) if median else None
        v["medianN"] = b and b["n"]
        v["baselineFrom"] = b and b["from"]
        v["baselineTo"] = b and b["to"]
        v["medianFetchedAt"] = b and b.get("fetchedAt")
        v["denominator"] = "median" if median else "followers" if (v.get("followers") or 0) > 0 else None
