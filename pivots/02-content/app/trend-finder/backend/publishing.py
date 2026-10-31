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


def to_json(row) -> dict:
    return {"id": row[0], "ideaId": row[1], "variant": row[2], "platform": row[3], "scheduledAt": row[4],
            "status": row[5], "externalId": row[6], "error": row[7], "createdAt": row[8]}


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
        with db() as conn:
            row = conn.execute(f"SELECT {COLUMNS} FROM publications WHERE id = ?", (pid,)).fetchone()
        if row is None:
            return JSONResponse({"error": "No such publication."}, status_code=404)
        publisher = get_publisher()
        if publisher is None:
            return JSONResponse({"error": "Publishing is not enabled."}, status_code=503)
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
            rows = conn.execute(f"SELECT {COLUMNS} FROM publications WHERE idea_id = ? ORDER BY created_at, variant",
                                (idea_id,)).fetchall()
        return [to_json(r) for r in rows]

    return router
