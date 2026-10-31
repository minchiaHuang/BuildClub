"""The approver's side of a finished cut. The team sends a cut from /api/ideas/<id>/cut/review (renders.py);
here the client's approver, who has no login, watches it through the share token and answers.

A cut is reachable only while every one of these holds: the link is active, the plan belongs to the link's
client, the plan is approved, its cut_reviews row is waiting, and final.mp4 is still the version that was sent.
Anything else is a 404, so a token never opens another client's video and an old answer never lands on a new one."""

import sqlite3
import time
from pathlib import Path
from typing import Callable, Optional

from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse

import renders
import share
from models import CutDecideRequest


def not_waiting() -> JSONResponse:
    return JSONResponse({"error": renders.NOT_WAITING, "code": "not_waiting"}, status_code=404)


def waiting(conn, load, root: Path, client_id: str, idea_id: str):
    """(final.mp4, review row, idea) when the approver may see this cut, else None."""
    idea = next((i for i in load("ideas") or [] if i["id"] == idea_id), None)
    if idea is None or idea["clientId"] != client_id or idea["status"] != "approved":
        return None
    folder = renders.cut_folder(root, idea_id)
    version = renders.final_version(folder)
    review = renders.review_row(conn, idea_id)
    if version is None or review is None or review[1] != "waiting" or review[0] != version:
        return None
    # A plan that was reopened and approved again may hold a video made from other takes since it was sent.
    if renders.is_stale(conn, idea_id, renders.shot_count(idea)):
        return None
    return folder / "final.mp4", review, idea


def waiting_cuts(db, load, media_dir: Callable[[], Path], client_id: str, token: str) -> list:
    """The client's cuts waiting for an answer, oldest first, shaped for the review page."""
    root = media_dir().resolve()
    library = load("library") or {}
    videos = {v.get("id"): v for v in library.get("videos", [])}
    formats = {f.get("id"): f for f in library.get("formats", [])}
    found = []
    with db() as conn:
        for idea in load("ideas") or []:
            if idea["clientId"] != client_id or idea["status"] != "approved":
                continue
            hit = waiting(conn, load, root, client_id, idea["id"])
            if hit is None:
                continue
            _, review, _ = hit
            duration = conn.execute("SELECT out_duration FROM renders WHERE idea_id = ?", (idea["id"],)).fetchone()
            video = videos.get(idea["videoId"])
            found.append((review[2], {
                "idea": {k: v for k, v in idea.items() if k != "notes"},
                "video": video, "format": formats.get((video or {}).get("formatId")),
                "cut": {"url": f"/api/review/{token}/cuts/{idea['id']}/file?v={review[0]}",
                        "durationSec": duration[0] if duration else None,
                        "version": str(review[0]), "sentAt": review[2]}}))
    return [item for _, item in sorted(found, key=lambda f: f[0])]


def make_router(db, load, media_dir: Callable[[], Path]) -> APIRouter:
    router = APIRouter()

    @router.get("/api/review/{token}/cuts/{idea_id}/file")
    def get_file(token: str, idea_id: str):
        link = share.active_link(load, token)
        if link is None:
            return share.no_such_link()
        with db() as conn:
            hit = waiting(conn, load, media_dir().resolve(), link["clientId"], idea_id)
        if hit is None:
            return not_waiting()
        # Inline only, whatever the query says: no filename, no attachment.
        return FileResponse(hit[0], media_type="video/mp4")

    @router.post("/api/review/{token}/cuts/{idea_id}/decide")
    def decide(token: str, idea_id: str, body: CutDecideRequest):
        link = share.active_link(load, token)
        if link is None:
            return share.no_such_link()
        reason = (body.reason or "").strip()
        if body.decision == "rejected" and not reason:
            return JSONResponse({"error": renders.NEED_REASON}, status_code=422)
        now = int(time.time() * 1000)
        with renders.render_lock:
            conn = db()
            try:
                conn.execute("BEGIN IMMEDIATE")  # the check and the answer are one step, so a second tab loses
                if share.active_link(load, token) is None:
                    conn.rollback()
                    return share.no_such_link()
                hit = waiting(conn, load, media_dir().resolve(), link["clientId"], idea_id)
                if hit is None:
                    conn.rollback()
                    return not_waiting()
                if str(hit[1][0]) != body.version:
                    conn.rollback()
                    return JSONResponse({"error": renders.REPLACED, "code": "replaced"}, status_code=409)
                status = body.decision
                kept = reason if status == "rejected" else None
                conn.execute("UPDATE cut_reviews SET status = ?, decided_at = ?, reason = ? WHERE idea_id = ?",
                             (status, now, kept, idea_id))
                conn.commit()
            except sqlite3.Error:
                conn.rollback()
                raise
            finally:
                conn.close()
        out = {"status": status, "decidedAt": now}
        if kept:
            out["reason"] = kept
        return out

    return router
