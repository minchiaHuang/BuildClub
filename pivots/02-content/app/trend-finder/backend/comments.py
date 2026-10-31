"""Timestamped comments on a plan's reference video: Daphne (signed in) and Annie (share link).
Comments can be added and read, never edited or deleted."""

import secrets
import threading
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

import share
from models import Comment, NewComment

# An idea has one reference video, so this is also the cap per video.
MAX_PER_IDEA = 200
# Adding a comment reads the idea's list and writes it back, so adds take turns.
comments_lock = threading.Lock()


def make_router(load, save) -> APIRouter:
    router = APIRouter()

    def key(idea_id: str) -> str:
        return f"comments:{idea_id}"

    def listed(idea_id: str) -> list:
        return sorted(load(key(idea_id)) or [], key=lambda c: c["atSec"])

    def add(idea_id: str, body: NewComment, source: str):
        found = next((i for i in load("ideas") or [] if i["id"] == idea_id), None)
        if found is None:
            return JSONResponse({"error": "That plan doesn't exist."}, status_code=404)
        if body.videoId != found["videoId"]:
            return JSONResponse({"error": "That isn't this plan's video."}, status_code=422)
        with comments_lock:
            stored = load(key(idea_id)) or []
            if len(stored) >= MAX_PER_IDEA:
                return JSONResponse({"error": "This plan has the most comments it can hold."}, status_code=409)
            comment = Comment(id=secrets.token_urlsafe(9), ideaId=idea_id, createdAt=int(time.time() * 1000),
                              source=source, **body.model_dump())
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
        return add(idea_id, body, "staff")

    @router.get("/api/review/{token}/ideas/{idea_id}/comments", response_model=list[Comment])
    def review_list(token: str, idea_id: str):
        return listed(idea_id) if link_idea(token, idea_id) else not_found()

    @router.post("/api/review/{token}/ideas/{idea_id}/comments", response_model=Comment)
    def review_add(token: str, idea_id: str, body: NewComment):
        return add(idea_id, body, "review") if link_idea(token, idea_id) else not_found()

    return router
