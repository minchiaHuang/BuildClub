"""Timestamped comments on a plan's reference video: Daphne (signed in) and Annie (share link).
Comments can be added and read, never edited or deleted."""

import secrets
import threading
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

import share
from models import Comment, NewComment

MAX_PER_VIDEO = 200
# Adding a comment reads the idea's list and writes it back, so adds take turns.
comments_lock = threading.Lock()


def make_router(load, save) -> APIRouter:
    router = APIRouter()

    def key(idea_id: str) -> str:
        return f"comments:{idea_id}"

    def listed(idea_id: str) -> list:
        return sorted(load(key(idea_id)) or [], key=lambda c: c["atSec"])

    def add(idea_id: str, body: NewComment):
        with comments_lock:
            stored = load(key(idea_id)) or []
            if sum(1 for c in stored if c["videoId"] == body.videoId) >= MAX_PER_VIDEO:
                return JSONResponse({"error": "This video has the most comments it can hold."}, status_code=409)
            comment = Comment(id=secrets.token_urlsafe(9), ideaId=idea_id, createdAt=int(time.time() * 1000),
                              **body.model_dump())
            save(key(idea_id), [*(Comment(**c) for c in stored), comment])
        return comment

    def link_idea(token: str, idea_id: str) -> bool:
        link = share.active_link(load, token)
        return link is not None and any(i["id"] == idea_id and i["clientId"] == link["clientId"]
                                        for i in load("ideas") or [])

    def not_found() -> JSONResponse:
        return JSONResponse({"error": "This link isn't active."}, status_code=404)

    @router.get("/api/ideas/{idea_id}/comments", response_model=list[Comment])
    def staff_list(idea_id: str):
        return listed(idea_id)

    @router.post("/api/ideas/{idea_id}/comments", response_model=Comment)
    def staff_add(idea_id: str, body: NewComment):
        return add(idea_id, body)

    @router.get("/api/review/{token}/ideas/{idea_id}/comments", response_model=list[Comment])
    def review_list(token: str, idea_id: str):
        return listed(idea_id) if link_idea(token, idea_id) else not_found()

    @router.post("/api/review/{token}/ideas/{idea_id}/comments", response_model=Comment)
    def review_add(token: str, idea_id: str, body: NewComment):
        return add(idea_id, body) if link_idea(token, idea_id) else not_found()

    return router
