"""Real-footage takes: Daphne uploads one or more videos per shot of an approved plan and picks one.
Rows live in the takes table, files in <media>/<ideaId>/<takeId>.<ext>. Only signed-in staff reach
these routes (they sit under /api/ideas/), so the approver's review link never sees them."""

import os
import secrets
import threading
import time
from pathlib import Path
from typing import Callable
from urllib.parse import unquote

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse

SCHEMA = (
    "CREATE TABLE IF NOT EXISTS takes (id TEXT PRIMARY KEY, idea_id TEXT NOT NULL, shot INTEGER NOT NULL, "
    "ext TEXT NOT NULL, size INTEGER NOT NULL, name TEXT NOT NULL, chosen INTEGER NOT NULL DEFAULT 0, "
    "created_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS takes_by_shot ON takes (idea_id, shot)",
)

MAX_TAKE_BYTES = 200 * 1024 * 1024
LIMIT_TEXT = "The file is over the 200 MB limit."
VIDEO_TYPES = {"video/mp4": "mp4", "video/quicktime": "mov"}
MEDIA_TYPES = {ext: kind for kind, ext in VIDEO_TYPES.items()}
MAX_TAKES_PER_SHOT = 10
MAX_SHOTS = 50
MAX_NAME = 200
NOT_VIDEO = "Upload an .mp4 or .mov video file."

# Counting a shot's takes and adding one, or moving the pick, take turns.
takes_lock = threading.Lock()

COLUMNS = "id, idea_id, shot, ext, size, name, chosen, created_at"


def to_json(row) -> dict:
    tid, idea_id, shot, _ext, size, name, chosen, created = row
    return {"id": tid, "ideaId": idea_id, "shot": shot, "name": name, "size": size, "chosen": bool(chosen),
            "createdAt": created, "url": f"/api/ideas/{idea_id}/takes/{tid}/file"}


def error(status: int, message: str) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


def make_router(db, load, media_dir: Callable[[], Path]) -> APIRouter:
    router = APIRouter()

    def find_idea(idea_id: str):
        return next((i for i in load("ideas") or [] if i["id"] == idea_id), None)

    def listed(idea_id: str) -> list:
        with db() as conn:
            rows = conn.execute(f"SELECT {COLUMNS} FROM takes WHERE idea_id = ? ORDER BY shot, created_at, rowid",
                                (idea_id,)).fetchall()
        return [to_json(r) for r in rows]

    async def receive(request: Request, part: Path) -> int:
        """Stream the body to `part`; the size, or -1 once it passes the cap. `part` is removed on any failure."""
        size = 0
        try:
            with part.open("wb") as f:
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > MAX_TAKE_BYTES:
                        break
                    f.write(chunk)
        except BaseException:
            part.unlink(missing_ok=True)
            raise
        if size > MAX_TAKE_BYTES:
            part.unlink(missing_ok=True)
            return -1
        return size

    @router.post("/api/ideas/{idea_id}/shots/{shot}/takes")
    async def upload(idea_id: str, shot: int, request: Request):
        if not 0 <= shot < MAX_SHOTS:
            return error(422, f"The shot number must be between 1 and {MAX_SHOTS}.")
        found = find_idea(idea_id)
        if found is None:
            return error(404, "That plan doesn't exist.")
        if found["status"] != "approved":
            return error(409, "Only an approved plan can take footage.")
        ext = VIDEO_TYPES.get(request.headers.get("content-type", "").split(";")[0].strip().lower())
        if ext is None:
            return error(415, NOT_VIDEO)
        declared = request.headers.get("content-length", "")
        if declared.isdigit() and int(declared) > MAX_TAKE_BYTES:
            return error(413, LIMIT_TEXT)

        folder = media_dir() / idea_id
        folder.mkdir(parents=True, exist_ok=True)
        take_id = secrets.token_urlsafe(9)
        part = folder / f".{take_id}.part"
        size = await receive(request, part)
        if size < 0:
            return error(413, LIMIT_TEXT)
        with part.open("rb") as f:
            head = f.read(12)
        if head[4:8] != b"ftyp":
            part.unlink(missing_ok=True)
            return error(415, NOT_VIDEO)

        name = unquote(request.headers.get("x-filename", ""))[:MAX_NAME].strip() or f"take.{ext}"
        with takes_lock:
            with db() as conn:
                count = conn.execute("SELECT COUNT(*) FROM takes WHERE idea_id = ? AND shot = ?",
                                     (idea_id, shot)).fetchone()[0]
                if count >= MAX_TAKES_PER_SHOT:
                    part.unlink(missing_ok=True)
                    return error(409, f"This shot has the most takes it can hold ({MAX_TAKES_PER_SHOT}).")
                os.replace(part, folder / f"{take_id}.{ext}")
                row = (take_id, idea_id, shot, ext, size, name, int(count == 0), int(time.time() * 1000))
                conn.execute(f"INSERT INTO takes ({COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", row)
        return to_json(row)

    @router.get("/api/ideas/{idea_id}/takes")
    def listing(idea_id: str):
        if find_idea(idea_id) is None:
            return error(404, "That plan doesn't exist.")
        return listed(idea_id)

    @router.get("/api/ideas/{idea_id}/takes/{take_id}/file")
    def file(idea_id: str, take_id: str):
        with db() as conn:
            row = conn.execute("SELECT ext FROM takes WHERE id = ? AND idea_id = ?", (take_id, idea_id)).fetchone()
        path = media_dir() / idea_id / f"{take_id}.{row[0]}" if row else None
        if path is None or not path.is_file():
            return error(404, "That take doesn't exist.")
        return FileResponse(path, media_type=MEDIA_TYPES[row[0]])

    def editable_take(conn, idea_id: str, take_id: str):
        """The take's (shot, ext), or the error to return: the plan must exist and be approved, the take be its own."""
        found = find_idea(idea_id)
        if found is None:
            return error(404, "That plan doesn't exist.")
        if found["status"] != "approved":
            return error(409, "Only an approved plan can take footage.")
        row = conn.execute("SELECT shot, ext FROM takes WHERE id = ? AND idea_id = ?", (take_id, idea_id)).fetchone()
        return row or error(404, "That take doesn't exist.")

    @router.post("/api/ideas/{idea_id}/takes/{take_id}/choose")
    def choose(idea_id: str, take_id: str):
        with takes_lock, db() as conn:
            got = editable_take(conn, idea_id, take_id)
            if isinstance(got, JSONResponse):
                return got
            conn.execute("UPDATE takes SET chosen = (id = ?) WHERE idea_id = ? AND shot = ?", (take_id, idea_id, got[0]))
        return listed(idea_id)

    @router.delete("/api/ideas/{idea_id}/takes/{take_id}")
    def delete(idea_id: str, take_id: str):
        with takes_lock, db() as conn:
            got = editable_take(conn, idea_id, take_id)
            if isinstance(got, JSONResponse):
                return got
            conn.execute("DELETE FROM takes WHERE id = ?", (take_id,))
        (media_dir() / idea_id / f"{take_id}.{got[1]}").unlink(missing_ok=True)
        return listed(idea_id)

    return router
