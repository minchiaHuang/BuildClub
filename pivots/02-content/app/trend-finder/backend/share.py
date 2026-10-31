"""Share link for the approver: one unguessable token per client, no login.

A token only ever shows that client's waiting ideas, and lets the approver change nothing but
status, rejectReason and decidedAt of one of them. Storage is the server's key/value store."""

import json
import secrets
import threading
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from models import DecideRequest, ReviewIdea, ReviewList, SavedIdea, ShareCreated, ShareLink, ShareRequest

PREFIX = "share:"
# Every read-modify-write of the ideas list (Daphne's PUT, Annie's decision) takes this lock.
ideas_lock = threading.Lock()
# Creating and revoking links scan then write the share rows, so they take turns.
share_lock = threading.Lock()

DECISION_FIELDS = ("status", "rejectReason", "rejectTags", "decidedAt")
# Counts every change to the ideas list, so a tab holding an older copy can be told to reload (If-Match).
REV_KEY = "ideas:rev"


def ideas_rev(load) -> int:
    return int(load(REV_KEY) or 0)


def bump_ideas_rev(db, load) -> int:
    """Call with ideas_lock held, right after the list is saved."""
    rev = ideas_rev(load) + 1
    with db() as conn:
        conn.execute("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)", (REV_KEY, json.dumps(rev)))
    return rev


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
        # The history only grows: keep the longer copy, so a stale tab cannot shorten it.
        kept = (theirs or {}).get("history") or []
        if len(kept) > len(idea.get("history") or []):
            idea = {**idea, "history": kept}
        merged.append(idea)
    return merged


def decide_idea(ideas: list, client_id: str, idea_id: str, approved: bool, reason, now_ms: int, tags=None):
    """Annie's answer. Returns (new ideas list, decided idea) or None when she may not decide it."""
    for n, idea in enumerate(ideas or []):
        if idea["id"] == idea_id and idea["clientId"] == client_id and idea["status"] == "waiting":
            decided = {k: v for k, v in idea.items() if k not in ("rejectReason", "rejectTags")}
            decided.update(status="approved" if approved else "rejected", decidedAt=now_ms)
            entry = {"decision": decided["status"], "decidedAt": now_ms}
            if not approved and reason and reason.strip():
                decided["rejectReason"] = entry["reason"] = reason.strip()
            if not approved and tags:
                decided["rejectTags"] = entry["tags"] = list(tags)
            decided["history"] = list(idea.get("history") or []) + [entry]
            return ideas[:n] + [decided] + ideas[n + 1:], decided
    return None


def no_such_link() -> JSONResponse:
    return JSONResponse({"error": "This link isn't active.", "code": "link_closed"}, status_code=404)


def active_link(load, token: str):
    """The link behind a token, or None when it was never made or has been turned off."""
    data = load(PREFIX + token)
    return data if isinstance(data, dict) and "clientId" in data else None


def make_router(db, load, save) -> APIRouter:
    router = APIRouter()

    def link_of(token: str):
        return active_link(load, token)

    def keys_of(client_id: str) -> list:
        with db() as conn:
            rows = conn.execute("SELECT key, value FROM store WHERE key LIKE 'share:%'").fetchall()
        return [k for k, v in rows if json.loads(v).get("clientId") == client_id]

    @router.post("/api/share", response_model=ShareCreated)
    def create_share(body: ShareRequest, request: Request):
        if not any(c["id"] == body.clientId for c in load("clients") or []):
            return JSONResponse({"error": "No such client."}, status_code=404)
        base = str(request.base_url).rstrip("/")
        with share_lock:
            keys = keys_of(body.clientId)
            if keys:
                token = keys[0][len(PREFIX):]
            else:
                token = secrets.token_urlsafe(24)  # 192 bits
                save(PREFIX + token, ShareLink(clientId=body.clientId, createdAt=int(time.time() * 1000)))
        return ShareCreated(token=token, url=f"{base}/review/{token}")

    # Turns off every link a client has, without ever minting one.
    @router.delete("/api/share", status_code=204)
    def revoke_client_shares(clientId: str):
        with share_lock:
            keys = keys_of(clientId)
            with db() as conn:
                conn.executemany("DELETE FROM store WHERE key = ?", [(k,) for k in keys])
        return Response(status_code=204)

    @router.delete("/api/share/{token}", status_code=204)
    def revoke_share(token: str):
        with share_lock, db() as conn:
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
                items.append({"idea": {k: v for k, v in idea.items() if k != "notes"}, "video": video, "format": formats.get((video or {}).get("formatId"))})
        return {"client": {"name": name}, "ideas": items}

    @router.post("/api/review/{token}/decide", response_model=ReviewIdea, response_model_exclude_none=True)
    def decide(token: str, body: DecideRequest):
        link = link_of(token)
        if link is None:
            return no_such_link()
        with ideas_lock:
            result = decide_idea(load("ideas"), link["clientId"], body.ideaId, body.decision == "approved",
                                 body.reason, int(time.time() * 1000), body.tags)
            if result is None:
                return JSONResponse({"error": "This idea isn't waiting for review.", "code": "not_waiting"}, status_code=404)
            ideas, decided = result
            save("ideas", [SavedIdea(**i) for i in ideas])
            bump_ideas_rev(db, load)
        return {k: v for k, v in decided.items() if k != "notes"}

    return router
