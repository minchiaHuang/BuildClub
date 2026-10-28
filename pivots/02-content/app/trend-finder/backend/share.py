"""Share link for the approver: one unguessable token per client, no login.

A token only ever shows that client's waiting ideas, and lets the approver change nothing but
status, rejectReason and decidedAt of one of them. Storage is the server's key/value store."""

import secrets
import threading
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from models import DecideRequest, ReviewList, SavedIdea, ShareCreated, ShareLink, ShareRequest

PREFIX = "share:"
# Every read-modify-write of the ideas list (Daphne's PUT, Annie's decision) takes this lock.
ideas_lock = threading.Lock()

DECISION_FIELDS = ("status", "rejectReason", "decidedAt")


def merge_ideas(stored: list, incoming: list) -> list:
    """Daphne's tab sends the whole list back. An idea decided after she last sent or saw it
    keeps the decision; everything else (due date, notes, shots) comes from her copy."""
    old = {i["id"]: i for i in stored or []}
    merged = []
    for idea in incoming:
        theirs = old.get(idea["id"])
        decided = (theirs or {}).get("decidedAt")
        if decided and decided > max(idea.get("decidedAt") or 0, idea.get("sentAt") or 0):
            idea = {k: v for k, v in idea.items() if k not in DECISION_FIELDS}
            idea.update({k: theirs[k] for k in DECISION_FIELDS if k in theirs})
        merged.append(idea)
    return merged


def decide_idea(ideas: list, client_id: str, idea_id: str, approved: bool, reason, now_ms: int):
    """Annie's answer. Returns (new ideas list, decided idea) or None when she may not decide it."""
    for n, idea in enumerate(ideas or []):
        if idea["id"] == idea_id and idea["clientId"] == client_id and idea["status"] == "waiting":
            decided = {k: v for k, v in idea.items() if k != "rejectReason"}
            decided.update(status="approved" if approved else "rejected", decidedAt=now_ms)
            if not approved and reason and reason.strip():
                decided["rejectReason"] = reason.strip()
            return ideas[:n] + [decided] + ideas[n + 1:], decided
    return None


def no_such_link() -> JSONResponse:
    return JSONResponse({"error": "This link isn't active."}, status_code=404)


def make_router(db, load, save) -> APIRouter:
    router = APIRouter()

    def link_of(token: str):
        data = load(PREFIX + token)
        return data if isinstance(data, dict) and "clientId" in data else None

    @router.post("/api/share", response_model=ShareCreated)
    def create_share(body: ShareRequest, request: Request):
        base = str(request.base_url).rstrip("/")
        with db() as conn:
            rows = conn.execute("SELECT key, value FROM store WHERE key LIKE 'share:%'").fetchall()
        import json
        token = next((k[len(PREFIX):] for k, v in rows if json.loads(v).get("clientId") == body.clientId), None)
        if token is None:
            token = secrets.token_urlsafe(24)  # 192 bits
            save(PREFIX + token, ShareLink(clientId=body.clientId, createdAt=int(time.time() * 1000)))
        return ShareCreated(token=token, url=f"{base}/review/{token}")

    @router.delete("/api/share/{token}", status_code=204)
    def revoke_share(token: str):
        with db() as conn:
            conn.execute("DELETE FROM store WHERE key = ?", (PREFIX + token,))
        return Response(status_code=204)

    @router.get("/api/review/{token}", response_model=ReviewList, response_model_exclude_none=True)
    def get_review(token: str):
        link = link_of(token)
        if link is None:
            return no_such_link()
        clients = load("clients") or []
        name = next((c["name"] for c in clients if c["id"] == link["clientId"]), "")
        library = load("library") or {}
        videos = {v.get("id"): v for v in library.get("videos", [])}
        formats = {f.get("id"): f for f in library.get("formats", [])}
        items = []
        for idea in load("ideas") or []:
            if idea["clientId"] == link["clientId"] and idea["status"] == "waiting":
                video = videos.get(idea["videoId"])
                items.append({"idea": idea, "video": video, "format": formats.get((video or {}).get("formatId"))})
        return {"client": {"name": name}, "ideas": items}

    @router.post("/api/review/{token}/decide", response_model=SavedIdea, response_model_exclude_none=True)
    def decide(token: str, body: DecideRequest):
        link = link_of(token)
        if link is None:
            return no_such_link()
        with ideas_lock:
            result = decide_idea(load("ideas"), link["clientId"], body.ideaId, body.decision == "approved",
                                 body.reason, int(time.time() * 1000))
            if result is None:
                return JSONResponse({"error": "This idea isn't waiting for review."}, status_code=404)
            ideas, decided = result
            save("ideas", [SavedIdea(**i) for i in ideas])
        return decided

    return router
