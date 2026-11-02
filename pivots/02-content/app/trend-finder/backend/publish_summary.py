"""How published videos did, per idea and per topic, from the latest metrics snapshot of each post.

A topic is a hashtag of the library video the idea was made from; an idea counts under each of them."""

from typing import Optional

COUNTS = ("views", "likes", "comments", "shares", "saves")


def engagement(views: Optional[int], likes, comments, shares, saves) -> Optional[float]:
    if not views:
        return None
    return round(sum(x or 0 for x in (likes, comments, shares, saves)) / views, 4)


def latest_by_post(conn, visible_posts: str, source_filter: str) -> list:
    """(idea_id, post id, platform, {counts, followers}|None) for every post, newest snapshot per post."""
    posts = conn.execute(f"SELECT idea_id, id, platform FROM publications WHERE 1=1{visible_posts} ORDER BY created_at").fetchall()
    out = []
    for idea_id, pid, platform in posts:
        snap = conn.execute("SELECT views, likes, comments, shares, saves, followers FROM publication_metrics "
                            f"WHERE publication_id = ?{source_filter} ORDER BY fetched_at DESC, rowid DESC LIMIT 1", (pid,)).fetchone()
        latest = None if snap is None else {**dict(zip(COUNTS, snap[:5])), "followers": snap[5]}
        out.append((idea_id, pid, platform, latest))
    return out


def idea_row(idea_id: str, posts: list) -> dict:
    measured = [p[3] for p in posts if p[3] and p[3]["views"] is not None]
    views = sum(m["views"] for m in measured) if measured else None
    totals = {k: sum(m[k] or 0 for m in measured) for k in COUNTS}
    known = [m for m in measured if m["followers"]]
    per_follower = None
    if known:
        per_follower = round(sum(m["views"] for m in known) / sum(m["followers"] for m in known), 4)
    return {"ideaId": idea_id, "posts": len(posts), "measuredPosts": len(measured), "views": views,
            "likes": totals["likes"] if measured else None, "comments": totals["comments"] if measured else None,
            "shares": totals["shares"] if measured else None, "saves": totals["saves"] if measured else None,
            "engagementRate": engagement(views, *(totals[k] for k in COUNTS[1:])) if measured else None,
            "viewsPerFollower": per_follower,
            "platforms": [{"platform": p[2], "publicationId": p[1], "latest": p[3]} for p in posts]}


def summarise(rows: list, topics_of: dict) -> dict:
    """rows: latest_by_post(); topics_of: idea id -> list of topic strings."""
    by_idea: dict = {}
    for row in rows:
        by_idea.setdefault(row[0], []).append(row)
    ideas = [idea_row(i, posts) for i, posts in by_idea.items()]
    for idea in ideas:
        idea["topics"] = topics_of.get(idea["ideaId"], [])
    topics: dict = {}
    for idea in ideas:
        for topic in idea["topics"]:
            topics.setdefault(topic, []).append(idea)
    out = []
    for topic, members in sorted(topics.items()):
        measured = [m for m in members if m["views"] is not None]
        rates = [m["engagementRate"] for m in measured if m["engagementRate"] is not None]
        out.append({"topic": topic, "ideas": len(members), "measuredIdeas": len(measured),
                    "totalViews": sum(m["views"] for m in measured) if measured else None,
                    "avgViews": round(sum(m["views"] for m in measured) / len(measured)) if measured else None,
                    "avgEngagementRate": round(sum(rates) / len(rates), 4) if rates else None,
                    "ideaIds": [m["ideaId"] for m in members]})
    return {"ideas": ideas, "topics": out}
