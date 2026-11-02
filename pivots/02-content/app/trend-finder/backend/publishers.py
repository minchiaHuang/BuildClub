"""Publisher backends: post a finished video to social platforms and read its numbers back.

PUBLISHER=fake (default) records posts locally with no network. PUBLISHER=ayrshare talks to Ayrshare and
needs AYRSHARE_API_KEY in the environment; without it get_publisher() raises PublisherError.

Ayrshare API facts, checked against the public docs on 2026-11-02:
  POST https://api.ayrshare.com/api/post            https://www.ayrshare.com/docs/apis/post/post
    header Authorization: Bearer <key>; body post (str), platforms (list), mediaUrls (https:// only,
    video needs a paid plan), scheduleDate (UTC "YYYY-MM-DDThh:mm:ssZ"). Success: status, id (the Ayrshare
    post id), postIds[{status, platform, id, postUrl?}]. Scheduled: status "scheduled", id, scheduleDate.
  POST https://api.ayrshare.com/api/analytics/post   https://www.ayrshare.com/docs/apis/analytics/post
    body id (the top-level post id, not a platform id), platforms (optional). Per-platform metric names:
    TikTok videoViews/likeCount/commentsCount/shareCount (no saves); Instagram viewsCount|playsCount/
    likeCount/commentsCount/sharesCount/savedCount; YouTube views/likes/comments (no shares, no saves).
UNVERIFIED (assumed, never called): the analytics response nests as {<platform>: {analytics: {...}}};
  GET /api/post/<id> for status; the real error body shape. Local files cannot be sent: Ayrshare wants a
  public https URL, and no upload step is built, so a local path is refused with a clear error.
"""

import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from typing import Callable, Optional, Protocol

AYRSHARE_BASE = "https://api.ayrshare.com/api"
METRIC_KEYS = ("views", "likes", "comments", "shares", "saves")


class PublisherError(Exception):
    pass


class Publisher(Protocol):
    def publish(self, video: str, caption: str, platforms: list, schedule_at: Optional[int] = None) -> list:
        """One record per platform: {platform, status scheduled|published|failed, externalId, url, publishedAt, error}."""

    def get_status(self, external_id: str, platform: str) -> str: ...

    def fetch_metrics(self, external_id: str, platform: str) -> dict:
        """views, likes, comments, shares, saves; None for what the platform does not give."""


def _digest(*parts) -> str:
    return hashlib.sha1("|".join(map(str, parts)).encode()).hexdigest()


class FakePublisher:
    """Deterministic and offline: the same inputs give the same ids, urls and numbers."""

    def publish(self, video, caption, platforms, schedule_at=None):
        now = int(time.time())
        later = schedule_at is not None and schedule_at > now
        records = []
        for platform in platforms:
            ext = "fake-" + _digest(video, caption, platform, schedule_at)[:12]
            records.append({"platform": platform, "status": "scheduled" if later else "published",
                            "externalId": ext, "url": f"https://fake.example/{platform}/{ext}",
                            "publishedAt": None if later else now, "error": None})
        return records

    def get_status(self, external_id, platform):
        return "published"

    def fetch_metrics(self, external_id, platform):
        n = int(_digest(external_id, platform)[:6], 16)
        views = 1000 + n % 9000
        return {"views": views, "likes": views // 10, "comments": views // 100, "shares": views // 200,
                "saves": views // 300}


def _urllib_http(method: str, url: str, headers: dict, body: Optional[dict]) -> tuple:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read() or b"{}")
        except ValueError:
            return exc.code, {}


class AyrsharePublisher:
    def __init__(self, api_key: str, http: Callable = _urllib_http):
        self.key = api_key
        self.http = http

    def _call(self, method, path, body=None):
        status, data = self.http(method, f"{AYRSHARE_BASE}{path}", {"Authorization": f"Bearer {self.key}"}, body)
        if status >= 400 or (isinstance(data, dict) and data.get("status") == "error"):
            detail = ""
            if isinstance(data, dict):
                detail = data.get("message") or "; ".join(str(e.get("message", e)) for e in data.get("errors") or [])
            raise PublisherError(f"Ayrshare error {status}: {detail or 'no detail'}")
        return data

    def publish(self, video, caption, platforms, schedule_at=None):
        if not video.startswith("https://"):
            raise PublisherError("Ayrshare needs a public https:// video URL; a local file cannot be sent.")
        body = {"post": caption, "platforms": list(platforms), "mediaUrls": [video], "isVideo": True}
        if schedule_at is not None:
            body["scheduleDate"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(schedule_at))
        data = self._call("POST", "/post", body)
        top = data.get("id")
        scheduled = data.get("status") == "scheduled"
        by_platform = {p.get("platform"): p for p in data.get("postIds") or []}
        now = int(time.time())
        records = []
        for platform in platforms:
            hit = by_platform.get(platform) or {}
            failed = bool(hit) and hit.get("status") not in (None, "success")
            records.append({"platform": platform,
                            "status": "failed" if failed else "scheduled" if scheduled else "published",
                            "externalId": top, "url": hit.get("postUrl"),
                            "publishedAt": None if scheduled or failed else now,
                            "error": f"Ayrshare could not post to {platform}." if failed else None})
        return records

    def get_status(self, external_id, platform):
        data = self._call("GET", f"/post/{external_id}")  # UNVERIFIED endpoint
        return str(data.get("status", "unknown"))

    def fetch_metrics(self, external_id, platform):
        data = self._call("POST", "/analytics/post", {"id": external_id, "platforms": [platform]})
        a = (data.get(platform) or {}).get("analytics") or {}  # UNVERIFIED nesting

        def pick(*names):
            return next((a[n] for n in names if isinstance(a.get(n), int)), None)
        return {"views": pick("videoViews", "viewsCount", "playsCount", "views"),
                "likes": pick("likeCount", "likes"), "comments": pick("commentsCount", "comments"),
                "shares": pick("shareCount", "sharesCount"), "saves": pick("savedCount")}


def mode() -> str:
    return os.environ.get("PUBLISHER", "fake").strip().lower() or "fake"


def get_publisher() -> Publisher:
    chosen = mode()
    if chosen == "fake":
        return FakePublisher()
    if chosen == "ayrshare":
        key = os.environ.get("AYRSHARE_API_KEY")
        if not key:
            raise PublisherError("PUBLISHER=ayrshare needs AYRSHARE_API_KEY in the environment.")
        return AyrsharePublisher(key)
    raise PublisherError(f"Unknown PUBLISHER {chosen!r}; use fake or ayrshare.")
