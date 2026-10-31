"""The cut: turns the chosen takes of an approved plan into one 9:16 MP4 (see cutting.py for the video work).
A job row per plan lives in the renders table, so progress and the finished video survive a restart. One
worker thread runs the jobs in order. Only signed-in staff reach these routes (they sit under /api/ideas/),
so the approver's review link never sees them."""

import hashlib
import os
import queue
import secrets
import shutil
import sqlite3
import threading
import time
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import unquote

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

import cutting
from cutting import CutError

# Job columns describe the latest run; the out_* columns describe the video on disk and are written only
# when a run succeeds, so a failed rerun leaves the old video and its details alone.
SCHEMA = (
    "CREATE TABLE IF NOT EXISTS renders (idea_id TEXT PRIMARY KEY, status TEXT NOT NULL, progress REAL NOT NULL, "
    "step TEXT NOT NULL, error TEXT, speed REAL NOT NULL, shots INTEGER NOT NULL DEFAULT 1, "
    "signature TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER, "
    "out_size INTEGER, out_duration REAL, out_signature TEXT, out_speed REAL, out_shots INTEGER)",
    "CREATE TABLE IF NOT EXISTS cut_music (idea_id TEXT PRIMARY KEY, id TEXT NOT NULL, ext TEXT NOT NULL, "
    "name TEXT NOT NULL, size INTEGER NOT NULL, licensed_at INTEGER NOT NULL)",
)

MAX_MUSIC_BYTES = 30 * 1024 * 1024
MUSIC_TYPES = {"audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-wav": "wav"}
MAX_NAME = 200
MAX_SHOTS = 50
SPEEDS = (1.0, 1.1, 1.25)
DEFAULT_SPEED = 1.1
DISK_FACTOR = 4

LIMIT_TEXT = "The music file is over the 30 MB limit."
NOT_AUDIO = "Upload an .mp3, .m4a or .wav audio file."
NO_LICENSE = "Confirm you own this music or have the license to use it."
NOT_APPROVED = "Only an approved plan can be cut."
BUSY = "A cut is already being made for this plan."
NO_DISK = "There isn't enough free disk space to make the cut."
BAD_SPEED = "Choose a speed of 1x, 1.1x or 1.25x."
RESTARTED = "The server restarted while this was being made. Make it again."
GENERIC = "Something went wrong while making the cut."

ACTIVE = ("queued", "running")

# The pipeline is looked up by name when a job runs, so tests can swap it.
run_pipeline = cutting.render_cut

# Starting a cut and changing the music take turns (the start itself is also one DB transaction).
render_lock = threading.Lock()

# make_router remembers where the media lives so recover(db) can clear half-made work.
_media_dir: Optional[Callable[[], Path]] = None

COLUMNS = ("status, progress, step, error, speed, out_size, out_duration, out_signature, out_speed, out_shots")


def signature(take_ids: list[str], speed: float, music_id: Optional[str]) -> str:
    """A fingerprint of what a cut was made from: the chosen takes in shot order, the speed and the music."""
    text = "|".join([",".join(take_ids), f"{speed:.2f}", music_id or ""])
    return hashlib.sha1(text.encode()).hexdigest()[:16]


def error(status: int, message: str) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


class CutRequest(BaseModel):
    shotCount: int = Field(strict=True, ge=1, le=MAX_SHOTS)
    speed: float


def chosen_ids(conn, idea_id: str, shots: int) -> list[tuple[str, str]]:
    """(take id, ext) of the chosen take of each shot below `shots`, in shot order; shots with none are skipped."""
    return conn.execute("SELECT id, ext FROM takes WHERE idea_id = ? AND chosen = 1 AND shot < ? ORDER BY shot",
                        (idea_id, shots)).fetchall()


def music_row(conn, idea_id: str):
    return conn.execute("SELECT id, ext, name, size FROM cut_music WHERE idea_id = ?", (idea_id,)).fetchone()


def clear_work(root: Path, idea_id: str) -> None:
    shutil.rmtree(root / idea_id / "cut" / "work", ignore_errors=True)


def recover(db, media_dir: Optional[Callable[[], Path]] = None) -> None:
    """After a restart no worker is running: mark unfinished jobs failed and remove their work folders."""
    media_dir = media_dir or _media_dir
    with db() as conn:
        ids = [r[0] for r in conn.execute("SELECT idea_id FROM renders WHERE status IN ('queued', 'running')")]
        conn.execute("UPDATE renders SET status = 'failed', error = ?, finished_at = ? "
                     "WHERE status IN ('queued', 'running')", (RESTARTED, int(time.time() * 1000)))
    if media_dir is not None:
        for idea_id in ids:
            clear_work(media_dir(), idea_id)


class RenderJobs:
    """One worker thread runs cuts in order (whisper and x264 each use every core)."""

    def __init__(self, db, media_dir: Callable[[], Path]):
        self._db, self._media = db, media_dir
        self._q: queue.Queue = queue.Queue()
        threading.Thread(target=self._work, name="render-worker", daemon=True).start()

    def submit(self, idea_id: str) -> None:
        self._q.put(idea_id)

    def _set(self, idea_id: str, **fields) -> None:
        names = ", ".join(f"{k} = ?" for k in fields)
        with self._db() as conn:
            conn.execute(f"UPDATE renders SET {names} WHERE idea_id = ?", (*fields.values(), idea_id))

    def _work(self) -> None:
        while True:
            idea_id = self._q.get()
            try:
                self._run(idea_id)
            except Exception as e:  # never let the worker thread die
                print(f"[render] {idea_id} worker error: {e}", flush=True)

    def _run(self, idea_id: str) -> None:
        folder = self._media().resolve() / idea_id / "cut"
        work = folder / "work"
        try:
            with self._db() as conn:
                row = conn.execute("SELECT speed, shots FROM renders WHERE idea_id = ?", (idea_id,)).fetchone()
                if row is None:
                    return
                speed, shots = row
                picked = chosen_ids(conn, idea_id, shots)
                music = music_row(conn, idea_id)
            self._set(idea_id, status="running", progress=0.0, step="Starting")
            if len(picked) < shots:  # the plan may have changed since the click
                raise CutError("A shot no longer has a chosen take. Choose one and try again.")
            takes = [{"id": tid, "path": folder.parent / f"{tid}.{ext}"} for tid, ext in picked]
            music_path = folder / f"music-{music[0]}.{music[1]}" if music else None
            shutil.rmtree(work, ignore_errors=True)
            work.mkdir(parents=True)
            nxt = work / "next.mp4"

            def step(progress: float, text: str) -> None:
                self._set(idea_id, progress=progress, step=text)

            result = run_pipeline(takes, music_path, speed, work, nxt, step)
            os.replace(nxt, folder / "final.mp4")  # only now does the old video go
            self._set(idea_id, status="done", progress=1.0, step="Done", error=None,
                      finished_at=int(time.time() * 1000), out_size=result["size"],
                      out_duration=result["durationSec"], out_speed=speed, out_shots=shots,
                      out_signature=signature([t["id"] for t in takes], speed, music[0] if music else None))
        except CutError as e:
            print(f"[render] {idea_id} failed: {e}", flush=True)
            self._set(idea_id, status="failed", error=str(e), finished_at=int(time.time() * 1000))
        except Exception as e:
            print(f"[render] {idea_id} failed: {e!r}", flush=True)
            self._set(idea_id, status="failed", error=GENERIC, finished_at=int(time.time() * 1000))
        finally:
            shutil.rmtree(work, ignore_errors=True)


def make_router(db, load, media_dir: Callable[[], Path]) -> APIRouter:
    global _media_dir
    _media_dir = media_dir
    router = APIRouter()
    jobs = RenderJobs(db, media_dir)

    def find_idea(idea_id: str):
        return next((i for i in load("ideas") or [] if i["id"] == idea_id), None)

    def folder_of(idea_id: str) -> Optional[Path]:
        root = media_dir().resolve()
        folder = (root / idea_id).resolve()
        return folder / "cut" if folder.parent == root else None

    def state_of(idea_id: str, shots: Optional[int] = None) -> dict:
        with db() as conn:
            row = conn.execute(f"SELECT {COLUMNS} FROM renders WHERE idea_id = ?", (idea_id,)).fetchone()
            music = music_row(conn, idea_id)
            out = {"status": "none", "progress": 0, "step": "", "speed": DEFAULT_SPEED, "stale": False,
                   "music": {"name": music[2], "size": music[3]} if music else None}
            if row is None:
                return out
            status, progress, step, err, speed, size, duration, out_sig, out_speed, out_shots = row
            out.update(status=status, progress=progress, step=step, speed=speed)
            if err:
                out["error"] = err
            folder = folder_of(idea_id)
            if size is not None and folder is not None and (folder / "final.mp4").is_file():
                # The version changes with every new final.mp4, so a preview player reloads after a re-cut.
                version = (folder / "final.mp4").stat().st_mtime_ns
                out["output"] = {"url": f"/api/ideas/{idea_id}/cut/file?v={version}", "size": size,
                                 "durationSec": duration}
                # Stale when the video was made from other takes or other music than are chosen now. The speed
                # is part of the fingerprint, but it is the one the video was made at, so it never differs.
                current = signature([t[0] for t in chosen_ids(conn, idea_id, out_shots)], out_speed,
                                    music[0] if music else None)
                # The page sends the plan's current shot count; a plan that gained or lost a shot needs a new cut.
                out["stale"] = current != out_sig or (shots is not None and shots != out_shots)
        return out

    def editable(idea_id: str):
        """The error to return when the plan can't be changed, else None."""
        found = find_idea(idea_id)
        if found is None:
            return error(404, "That plan doesn't exist.")
        if found["status"] != "approved":
            return error(409, NOT_APPROVED)
        return None

    def is_busy(conn, idea_id: str) -> bool:
        row = conn.execute("SELECT status FROM renders WHERE idea_id = ?", (idea_id,)).fetchone()
        return row is not None and row[0] in ACTIVE

    @router.get("/api/ideas/{idea_id}/cut")
    def get_cut(idea_id: str, shots: Optional[int] = None):
        if find_idea(idea_id) is None:
            return error(404, "That plan doesn't exist.")
        return state_of(idea_id, shots)

    @router.get("/api/ideas/{idea_id}/cut/file")
    def get_file(idea_id: str, download: int = 0):
        folder = folder_of(idea_id)
        with db() as conn:
            row = conn.execute("SELECT out_size FROM renders WHERE idea_id = ?", (idea_id,)).fetchone()
        path = folder / "final.mp4" if folder else None
        if path is None or row is None or row[0] is None or not path.is_file():
            return error(404, "There is no cut for this plan yet.")
        if download:
            return FileResponse(path, media_type="video/mp4", filename=f"remake-{idea_id}.mp4",
                                content_disposition_type="attachment")
        return FileResponse(path, media_type="video/mp4")

    async def receive(request: Request, part: Path) -> int:
        """Stream the body to `part`; the size, or -1 once it passes the cap. `part` is removed on any failure."""
        size = 0
        try:
            with part.open("wb") as f:
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > MAX_MUSIC_BYTES:
                        break
                    f.write(chunk)
        except BaseException:
            part.unlink(missing_ok=True)
            raise
        if size > MAX_MUSIC_BYTES:
            part.unlink(missing_ok=True)
            return -1
        return size

    def magic_ok(ext: str, head: bytes) -> bool:
        if ext == "mp3":
            return head[:3] == b"ID3" or (len(head) >= 2 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0)
        if ext == "m4a":
            return head[4:8] == b"ftyp"
        return head[:4] == b"RIFF" and head[8:12] == b"WAVE"

    @router.put("/api/ideas/{idea_id}/cut/music")
    async def put_music(idea_id: str, request: Request):
        refused = editable(idea_id)
        if refused:
            return refused
        ext = MUSIC_TYPES.get(request.headers.get("content-type", "").split(";")[0].strip().lower())
        if ext is None:
            return error(415, NOT_AUDIO)
        if request.headers.get("x-license-confirmed", "").strip().lower() != "yes":
            return error(422, NO_LICENSE)
        declared = request.headers.get("content-length", "")
        if declared.isdigit() and int(declared) > MAX_MUSIC_BYTES:
            return error(413, LIMIT_TEXT)
        folder = folder_of(idea_id)
        if folder is None:
            return error(404, "That plan doesn't exist.")
        folder.mkdir(parents=True, exist_ok=True)
        music_id = secrets.token_urlsafe(9)
        part = folder / f".{music_id}.part"
        size = await receive(request, part)
        if size < 0:
            return error(413, LIMIT_TEXT)
        with part.open("rb") as f:
            head = f.read(12)
        if not magic_ok(ext, head):
            part.unlink(missing_ok=True)
            return error(415, NOT_AUDIO)

        name = unquote(request.headers.get("x-filename", ""))[:MAX_NAME].strip() or f"music.{ext}"
        with render_lock:
            refused = editable(idea_id)  # the plan may have changed while the body was arriving
            with db() as conn:
                if refused is None and is_busy(conn, idea_id):
                    refused = error(409, BUSY)
                if refused:
                    part.unlink(missing_ok=True)
                    return refused
                old = music_row(conn, idea_id)
                os.replace(part, folder / f"music-{music_id}.{ext}")
                conn.execute("INSERT OR REPLACE INTO cut_music (idea_id, id, ext, name, size, licensed_at) "
                             "VALUES (?, ?, ?, ?, ?, ?)", (idea_id, music_id, ext, name, size, int(time.time() * 1000)))
            if old:
                (folder / f"music-{old[0]}.{old[1]}").unlink(missing_ok=True)
        return state_of(idea_id)

    @router.delete("/api/ideas/{idea_id}/cut/music")
    def delete_music(idea_id: str):
        refused = editable(idea_id)
        if refused:
            return refused
        with render_lock, db() as conn:
            if is_busy(conn, idea_id):
                return error(409, BUSY)
            old = music_row(conn, idea_id)
            conn.execute("DELETE FROM cut_music WHERE idea_id = ?", (idea_id,))
        folder = folder_of(idea_id)
        if old and folder:
            (folder / f"music-{old[0]}.{old[1]}").unlink(missing_ok=True)
        return state_of(idea_id)

    @router.post("/api/ideas/{idea_id}/cut", status_code=202)
    def start_cut(idea_id: str, body: CutRequest):
        if body.speed not in SPEEDS:
            return error(422, BAD_SPEED)
        refused = editable(idea_id)
        if refused:
            return refused
        missing = cutting.missing_tools()
        if missing:
            return error(503, missing)
        folder = folder_of(idea_id)
        if folder is None:
            return error(404, "That plan doesn't exist.")
        with db() as conn:
            picked = chosen_ids(conn, idea_id, body.shotCount)
            music = music_row(conn, idea_id)
            shots_with_pick = {r[0] for r in conn.execute(
                "SELECT shot FROM takes WHERE idea_id = ? AND chosen = 1 AND shot < ?", (idea_id, body.shotCount))}
        for shot in range(body.shotCount):
            if shot not in shots_with_pick:
                return error(409, f"Choose a take for shot {shot + 1} first.")
        paths = [folder.parent / f"{tid}.{ext}" for tid, ext in picked]
        total_bytes = sum(p.stat().st_size for p in paths if p.is_file())
        if shutil.disk_usage(media_dir()).free < DISK_FACTOR * total_bytes:
            return error(409, NO_DISK)
        try:
            seconds = sum(cutting.probe(p)["duration"] for p in paths)
        except CutError as e:
            return error(409, str(e))
        if seconds > cutting.MAX_INPUT_SEC:
            return error(409, f"The chosen takes are too long (over {cutting.MAX_INPUT_SEC // 60} minutes in total).")

        sig = signature([tid for tid, _ in picked], body.speed, music[0] if music else None)
        now = int(time.time() * 1000)
        with render_lock:
            conn = db()
            try:
                conn.execute("BEGIN IMMEDIATE")  # the check and the write are one step, even across processes
                if is_busy(conn, idea_id):
                    conn.rollback()
                    return error(409, BUSY)
                current = find_idea(idea_id)
                if current is None or current["status"] != "approved":
                    conn.rollback()
                    return error(409, NOT_APPROVED)
                conn.execute(
                    "INSERT INTO renders (idea_id, status, progress, step, speed, shots, signature, started_at) "
                    "VALUES (?, 'queued', 0, 'Waiting to start', ?, ?, ?, ?) ON CONFLICT(idea_id) DO UPDATE SET "
                    "status = 'queued', progress = 0, step = 'Waiting to start', error = NULL, speed = excluded.speed, "
                    "shots = excluded.shots, signature = excluded.signature, started_at = excluded.started_at, "
                    "finished_at = NULL", (idea_id, body.speed, body.shotCount, sig, now))
                conn.commit()
            except sqlite3.Error:
                conn.rollback()
                raise
            finally:
                conn.close()
        jobs.submit(idea_id)
        return JSONResponse(state_of(idea_id), status_code=202)

    return router
