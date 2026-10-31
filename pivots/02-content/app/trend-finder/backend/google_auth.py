"""Google sign-in, off until GOOGLE_CLIENT_ID is set. It only signs in people who already have an
account: the Google email must match a user, and the user row then remembers Google's stable id
(google_sub). It never makes accounts. Tests replace exchange_code, so nothing reaches Google."""

import hmac
import hashlib
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Callable

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse

import auth

STATE_COOKIE = "tf_google_state"
STATE_SECONDS = 10 * 60
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"

_fallback_key = secrets.token_bytes(32)  # used to sign state when no client secret is set


def client_id() -> str:
    return os.environ.get("GOOGLE_CLIENT_ID", "").strip()


def enabled() -> bool:
    return bool(client_id())


def _sign(nonce: str) -> str:
    key = os.environ.get("GOOGLE_CLIENT_SECRET", "").encode() or _fallback_key
    return hmac.new(key, nonce.encode(), hashlib.sha256).hexdigest()


def make_state() -> str:
    nonce = secrets.token_urlsafe(16)
    return f"{nonce}.{_sign(nonce)}"


def state_ok(state: str | None, cookie: str | None) -> bool:
    if not state or not cookie or not secrets.compare_digest(state.encode(), cookie.encode()):
        return False
    nonce, _, sig = state.partition(".")
    return secrets.compare_digest(sig.encode(), _sign(nonce).encode())


def redirect_uri() -> str:
    """The callback address registered with Google, e.g. https://host/api/auth/google/callback."""
    return os.environ.get("GOOGLE_REDIRECT_URI", "").strip()


def _post_form(url: str, fields: dict) -> dict:
    req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode(), method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


def exchange_code(code: str) -> dict:
    """Trade the code for Google's answer about the person: {"sub", "email", "email_verified"}.
    Replaced in tests. Google checks the id_token itself via its tokeninfo endpoint."""
    tokens = _post_form(TOKEN_URL, {"code": code, "client_id": client_id(), "redirect_uri": redirect_uri(),
                                    "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""), "grant_type": "authorization_code"})
    info = _post_form(TOKENINFO_URL, {"id_token": tokens["id_token"]})
    if info.get("aud") != client_id():
        raise ValueError("The Google token was meant for another app.")
    return {"sub": info["sub"], "email": info.get("email", ""), "email_verified": str(info.get("email_verified")).lower() == "true"}


Exchange = Callable[[str], dict]


def make_router(db, cookie_secure) -> APIRouter:
    router = APIRouter()

    @router.get("/api/auth/config")
    def config():
        return {"google": enabled()}

    @router.get("/api/auth/google/start")
    def start(request: Request):
        if not enabled():
            return JSONResponse({"error": "Google sign-in is not enabled."}, status_code=404)
        state = make_state()
        query = urllib.parse.urlencode({"client_id": client_id(), "redirect_uri": redirect_uri(), "response_type": "code",
                                        "scope": "openid email", "state": state})
        response = RedirectResponse(f"{AUTH_URL}?{query}", status_code=302)
        response.set_cookie(STATE_COOKIE, state, max_age=STATE_SECONDS, path="/api/auth/google", httponly=True, samesite="lax",
                            secure=cookie_secure(request))
        return response

    @router.get("/api/auth/google/callback")
    def callback(request: Request, code: str = "", state: str = ""):
        if not enabled():
            return JSONResponse({"error": "Google sign-in is not enabled."}, status_code=404)
        if not state_ok(state, request.cookies.get(STATE_COOKIE)):
            return JSONResponse({"error": "The Google sign-in expired. Try again."}, status_code=400)
        try:
            who = exchange_code(code)
        except (ValueError, KeyError, OSError):
            return JSONResponse({"error": "Google did not accept that sign-in."}, status_code=400)
        email = auth.normalise(who.get("email", ""))
        if not who.get("email_verified") or not who.get("sub") or not email:
            return JSONResponse({"error": "Google has not verified that email."}, status_code=403)
        with db() as conn:
            row = conn.execute("SELECT email, google_sub FROM users WHERE email = ?", (email,)).fetchone()
            if row is None or (row[1] and row[1] != who["sub"]):
                return JSONResponse({"error": "No Remake account for that Google email."}, status_code=403)
            conn.execute("UPDATE users SET google_sub = ? WHERE email = ?", (who["sub"], email))
            token = auth.start_session(conn, email, time.time())
        response = RedirectResponse("/", status_code=302)
        response.set_cookie(auth.COOKIE, token, max_age=auth.SESSION_SECONDS, path="/", httponly=True, samesite="lax",
                            secure=cookie_secure(request))
        response.delete_cookie(STATE_COOKIE, path="/api/auth/google")
        return response

    return router
