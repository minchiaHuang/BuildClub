"""Publishing: one row per post of an approved idea on a platform. The actual posting goes through
a Publisher that is only present in demo mode (a fake) or when a key is set (a stub for now)."""

import os
import secrets
import time
from typing import Optional, Protocol

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

SCHEMA = (
    "CREATE TABLE IF NOT EXISTS publications (id TEXT PRIMARY KEY, idea_id TEXT NOT NULL, variant TEXT NOT NULL DEFAULT 'A', "
    "platform TEXT NOT NULL, scheduled_at INTEGER, status TEXT NOT NULL, external_id TEXT, error TEXT, created_at INTEGER NOT NULL)",
)
SCHEMA += (
    "CREATE TABLE IF NOT EXISTS publication_metrics (publication_id TEXT NOT NULL, views INTEGER, likes INTEGER, "
    "comments INTEGER, shares INTEGER, fetched_at INTEGER NOT NULL, source TEXT)",
)
PLATFORMS = ("tiktok", "instagram", "youtube")


class Publisher(Protocol):
    def publish(self, pub: dict) -> str:
        """Post it and return the external post id; raise when it fails."""


class FakePublisher:
    def publish(self, pub: dict) -> str:
        return f"fake-{pub['id']}"


class AyrsharePublisher:
    def publish(self, pub: dict) -> str:
        raise NotImplementedError("Ayrshare not wired yet")


def is_demo() -> bool:
    return os.environ.get("REMAKE_DEMO") == "1"


def get_publisher() -> Optional[Publisher]:
    if os.environ.get("AYRSHARE_API_KEY"):
        return AyrsharePublisher()
    if is_demo():
        return FakePublisher()
    return None


class PublicationCreate(BaseModel):
    ideaId: str
    platform: str
    variant: str = "A"
    scheduledAt: Optional[int] = None


class MetricsIn(BaseModel):
    views: Optional[int] = None
    likes: Optional[int] = None
    comments: Optional[int] = None
    shares: Optional[int] = None
    fetchedAt: Optional[int] = None
    source: Optional[str] = None


COUNTS = ("views", "likes", "comments", "shares")


def seed_demo(db) -> None:
    """Demo mode only, and only into an empty table: one approved idea posted as two variants with numbers."""
    if not is_demo():
        return
    now = int(time.time())
    with db() as conn:
        if conn.execute("SELECT COUNT(*) FROM publications").fetchone()[0]:
            return
        for variant, views, likes in (("A", 12400, 960), ("B", 8100, 540)):
            pid = f"demo-{variant.lower()}"
            conn.execute(f"INSERT INTO publications ({COLUMNS}) VALUES (?, 'demo-ab', ?, 'tiktok', NULL, 'published', ?, NULL, ?)",
                         (pid, variant, f"fake-{pid}", now))
            conn.execute("INSERT INTO publication_metrics VALUES (?, ?, ?, ?, ?, ?, 'demo')",
                         (pid, views, likes, views // 100, views // 200, now))


def to_json(row) -> dict:
    return {"id": row[0], "ideaId": row[1], "variant": row[2], "platform": row[3], "scheduledAt": row[4],
            "status": row[5], "externalId": row[6], "error": row[7], "createdAt": row[8]}


def visible() -> str:
    """Outside demo mode, rows a demo run seeded or the fake publisher made stay out of every read."""
    return "" if is_demo() else " AND COALESCE(external_id, '') NOT LIKE 'fake-%' AND id NOT LIKE 'demo-%'"


def metric_filter() -> str:
    return "" if is_demo() else " AND COALESCE(source, '') != 'demo'"


COLUMNS = "id, idea_id, variant, platform, scheduled_at, status, external_id, error, created_at"


def make_router(db, load) -> APIRouter:
    router = APIRouter()

    @router.post("/api/publications")
    def create(body: PublicationCreate):
        if body.platform not in PLATFORMS:
            return JSONResponse({"error": "Unknown platform."}, status_code=422)
        idea = next((i for i in load("ideas") or [] if i.get("id") == body.ideaId), None)
        if idea is None or idea.get("status") != "approved":
            return JSONResponse({"error": "Only an approved idea can be published."}, status_code=409)
        pid = secrets.token_urlsafe(9)
        with db() as conn:
            conn.execute(f"INSERT INTO publications ({COLUMNS}) VALUES (?, ?, ?, ?, ?, 'draft', NULL, NULL, ?)",
                         (pid, body.ideaId, body.variant, body.platform, body.scheduledAt, int(time.time())))
            row = conn.execute(f"SELECT {COLUMNS} FROM publications WHERE id = ?", (pid,)).fetchone()
        return to_json(row)

    @router.post("/api/publications/{pid}/publish")
    def publish(pid: str):
        publisher = get_publisher()
        with db() as conn:
            row = conn.execute(f"SELECT {COLUMNS} FROM publications WHERE id = ?", (pid,)).fetchone()
            if row is None:
                return JSONResponse({"error": "No such publication."}, status_code=404)
            if publisher is None:
                return JSONResponse({"error": "Publishing is not enabled."}, status_code=503)
            # Claim the row atomically so a double click or a concurrent request cannot post twice.
            claimed = conn.execute("UPDATE publications SET status = 'publishing' WHERE id = ? AND status IN ('draft', 'failed')",
                                   (pid,)).rowcount
        if not claimed:
            return JSONResponse({"error": "Only a draft or failed publication can be published."}, status_code=409)
        try:
            external = publisher.publish(to_json(row))
        except Exception as exc:  # whatever the platform client raises is stored and shown
            with db() as conn:
                conn.execute("UPDATE publications SET status = 'failed', error = ? WHERE id = ?", (str(exc), pid))
                row = conn.execute(f"SELECT {COLUMNS} FROM publications WHERE id = ?", (pid,)).fetchone()
            return JSONResponse(to_json(row), status_code=502)
        with db() as conn:
            conn.execute("UPDATE publications SET status = 'published', external_id = ?, error = NULL WHERE id = ?",
                         (external, pid))
            row = conn.execute(f"SELECT {COLUMNS} FROM publications WHERE id = ?", (pid,)).fetchone()
        return to_json(row)

    @router.get("/api/ideas/{idea_id}/publications")
    def listing(idea_id: str):
        with db() as conn:
            rows = conn.execute(f"SELECT {COLUMNS} FROM publications WHERE idea_id = ?{visible()} ORDER BY created_at, variant",
                                (idea_id,)).fetchall()
        return [to_json(r) for r in rows]

    @router.post("/api/publications/{pid}/metrics")
    def add_metrics(pid: str, body: MetricsIn):
        with db() as conn:
            if conn.execute("SELECT 1 FROM publications WHERE id = ?", (pid,)).fetchone() is None:
                return JSONResponse({"error": "No such publication."}, status_code=404)
            conn.execute("INSERT INTO publication_metrics VALUES (?, ?, ?, ?, ?, ?, ?)",
                         (pid, body.views, body.likes, body.comments, body.shares,
                          body.fetchedAt if body.fetchedAt is not None else int(time.time()), body.source))
        return {"ok": True}

    @router.get("/api/ideas/{idea_id}/compare")
    def compare(idea_id: str):
        with db() as conn:
            pubs = conn.execute(f"SELECT id, variant, platform FROM publications WHERE idea_id = ?{visible()} ORDER BY variant, created_at",
                                (idea_id,)).fetchall()
            variants = []
            for pid, variant, platform in pubs:
                snap = conn.execute("SELECT views, likes, comments, shares, fetched_at, source FROM publication_metrics "
                                    f"WHERE publication_id = ?{metric_filter()} ORDER BY fetched_at DESC, rowid DESC LIMIT 1", (pid,)).fetchone()
                latest = None if snap is None else {**dict(zip(COUNTS, snap[:4])), "fetchedAt": snap[4], "source": snap[5]}
                variants.append({"variant": variant, "publicationId": pid, "platform": platform, "latest": latest,
                                 "viewsVsBest": None})
        views = [v["latest"]["views"] for v in variants if v["latest"] and v["latest"]["views"] is not None]
        best = max(views, default=0)
        if len(variants) > 1 and len(views) > 1 and best > 0:
            for v in variants:
                if v["latest"] and v["latest"]["views"] is not None:
                    v["viewsVsBest"] = v["latest"]["views"] / best
        return {"variants": variants}

    return router
