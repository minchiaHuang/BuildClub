"""What the production board needs that the ideas list does not carry: whether a plan has a finished video,
whether a post went out, and when anything last happened to it (takes, video, approval of the video, posts).

Also stamps SavedIdea.updatedAt, the time an idea last changed. Only the server sets it."""

import time

from fastapi import APIRouter

import publishing


def stamp_updated(stored, incoming: list, now_ms: int) -> list:
    """incoming with updatedAt set by the server: kept when the idea is unchanged, now when it is new or changed.
    A value sent by the client is never trusted."""
    old = {i["id"]: i for i in stored or []}
    out = []
    for idea in incoming:
        before = old.get(idea["id"])
        same = before is not None and {k: v for k, v in before.items() if k != "updatedAt"} == {k: v for k, v in idea.items() if k != "updatedAt"}
        rest = {k: v for k, v in idea.items() if k != "updatedAt"}
        if same and before.get("updatedAt") is not None:
            rest["updatedAt"] = before["updatedAt"]
        elif not same:
            rest["updatedAt"] = now_ms
        out.append(rest)
    return out


def ms(value):
    """Some tables keep seconds, some milliseconds; a number below 1e11 is seconds."""
    if value is None:
        return None
    return int(value * 1000) if value < 100_000_000_000 else int(value)


def make_router(db) -> APIRouter:
    router = APIRouter()

    @router.get("/api/production")
    def production():
        rows: dict = {}

        def row(idea_id: str) -> dict:
            return rows.setdefault(idea_id, {"cut": False, "published": False, "activityAt": None})

        def seen(idea_id: str, *times) -> None:
            r = row(idea_id)
            for t in times:
                t = ms(t)
                if t is not None and (r["activityAt"] is None or t > r["activityAt"]):
                    r["activityAt"] = t

        with db() as conn:
            for idea_id, size, started, finished in conn.execute("SELECT idea_id, out_size, started_at, finished_at FROM renders"):
                row(idea_id)["cut"] = size is not None
                seen(idea_id, started, finished)
            for idea_id, sent, decided in conn.execute("SELECT idea_id, sent_at, decided_at FROM cut_reviews"):
                seen(idea_id, sent, decided)
            for idea_id, created in conn.execute("SELECT idea_id, MAX(created_at) FROM takes GROUP BY idea_id"):
                seen(idea_id, created)
            for idea_id, status, created, published in conn.execute(
                    f"SELECT idea_id, status, created_at, published_at FROM publications WHERE 1=1{publishing.visible()}"):
                if status == "published":
                    row(idea_id)["published"] = True
                seen(idea_id, created, published)
        return {"ideas": rows}

    return router
