"""Publishing: one row per post of an approved idea on a platform, and the numbers that come back.

A post can only be made from a finished video the manager approved on the review link (cut_reviews).
Posting goes through publishers.get_publisher() (PUBLISHER=fake by default, or ayrshare)."""

import os
import secrets
import time
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import publish_summary
import publishers
import renders

SCHEMA = (
    "CREATE TABLE IF NOT EXISTS publications (id TEXT PRIMARY KEY, idea_id TEXT NOT NULL, variant TEXT NOT NULL DEFAULT 'A', "
    "platform TEXT NOT NULL, scheduled_at INTEGER, status TEXT NOT NULL, external_id TEXT, error TEXT, created_at INTEGER NOT NULL, "
    "url TEXT, published_at INTEGER, caption TEXT NOT NULL DEFAULT '')",
    "CREATE TABLE IF NOT EXISTS publication_metrics (publication_id TEXT NOT NULL, views INTEGER, likes INTEGER, "
    "comments INTEGER, shares INTEGER, fetched_at INTEGER NOT NULL, source TEXT, saves INTEGER, followers INTEGER)",
)
PLATFORMS = ("tiktok", "instagram", "youtube")
def is_demo() -> bool:
    return os.environ.get("REMAKE_DEMO") == "1"


NOT_APPROVED = "Only a finished video the manager approved can be published."


def migrate(conn) -> None:
    """Databases made before posts kept a url, a caption or saves have fewer columns; add them and leave rows alone."""
    for table, columns in (("publications", ("url TEXT", "published_at INTEGER", "caption TEXT NOT NULL DEFAULT ''")),
                           ("publication_metrics", ("saves INTEGER", "followers INTEGER"))):
        have = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
        for column in columns:
            if column.split()[0] not in have:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column}")


def approved_cut(conn, load, root, idea_id: str):
    """The path of the idea's final.mp4 when the manager approved exactly this video, else None."""
    idea = next((i for i in load("ideas") or [] if i.get("id") == idea_id), None)
    if idea is None or idea.get("status") != "approved":
        return None
    folder = renders.cut_folder(root, idea_id)
    version = renders.final_version(folder)
    review = renders.review_row(conn, idea_id)
    if version is None or review is None or review[1] != "approved" or review[0] != version:
        return None
    if renders.is_stale(conn, idea_id, renders.shot_count(idea)):
        return None
    return folder / "final.mp4"


class PublicationCreate(BaseModel):
    ideaId: str
    platform: str
    variant: str = "A"
    scheduledAt: Optional[int] = None
    caption: str = Field(default="", max_length=2200)


class PublishRequest(BaseModel):
    caption: str = Field(default="", max_length=2200)
    platforms: list[str] = Field(min_length=1, max_length=len(PLATFORMS))
    scheduleAt: Optional[int] = Field(default=None, strict=True, ge=0)
    variant: str = "A"


Count = Optional[int]


class MetricsIn(BaseModel):
    """Numbers typed in by hand: whole numbers, zero or more. The source is always 'manual'."""
    model_config = {"extra": "forbid"}
    views: Count = Field(default=None, strict=True, ge=0)
    likes: Count = Field(default=None, strict=True, ge=0)
    comments: Count = Field(default=None, strict=True, ge=0)
    shares: Count = Field(default=None, strict=True, ge=0)
    saves: Count = Field(default=None, strict=True, ge=0)
    followers: Count = Field(default=None, strict=True, ge=0)
    fetchedAt: Count = Field(default=None, strict=True, ge=0)


COUNTS = ("views", "likes", "comments", "shares", "saves")


def seed_demo(db) -> None:
    """Demo mode only, and only into an empty table: one approved idea posted as two variants with numbers."""
    if not is_demo():
        return
    now = int(time.time())
    with db() as conn:
        if conn.execute("SELECT COUNT(*) FROM publications").fetchone()[0]:
            return
        for variant, views, likes in (("A", 12400, 960), ("B", 8100, 540)):
            pid = f"demo-{variant.lower()}"
            conn.execute(f"INSERT INTO publications ({COLUMNS}) VALUES (?, 'demo-ab', ?, 'tiktok', NULL, 'published', ?, NULL, ?, NULL, ?, '')",
                         (pid, variant, f"fake-{pid}", now, now))
            conn.execute("INSERT INTO publication_metrics (publication_id, views, likes, comments, shares, fetched_at, source) "
                         "VALUES (?, ?, ?, ?, ?, ?, 'demo')", (pid, views, likes, views // 100, views // 200, now))


COLUMNS = "id, idea_id, variant, platform, scheduled_at, status, external_id, error, created_at, url, published_at, caption"


def to_json(row) -> dict:
    return {"id": row[0], "ideaId": row[1], "variant": row[2], "platform": row[3], "scheduledAt": row[4],
            "status": row[5], "externalId": row[6], "error": row[7], "createdAt": row[8], "url": row[9],
            "publishedAt": row[10], "caption": row[11]}


def visible() -> str:
    """Demo rows stay out of every read outside demo mode; so do fake posts once a real publisher is in use."""
    out = "" if is_demo() else " AND id NOT LIKE 'demo-%'"
    if not is_demo() and publishers.mode() != "fake":
        out += " AND COALESCE(external_id, '') NOT LIKE 'fake-%'"
    return out


def metric_filter() -> str:
    return "" if is_demo() else " AND COALESCE(source, '') != 'demo'"


def make_router(db, load, media_dir) -> APIRouter:
    router = APIRouter()

    def error(status: int, message: str) -> JSONResponse:
        return JSONResponse({"error": message}, status_code=status)

    def row_of(conn, pid):
        return conn.execute(f"SELECT {COLUMNS} FROM publications WHERE id = ?", (pid,)).fetchone()

    def new_draft(conn, idea_id, variant, platform, caption, scheduled_at) -> str:
        pid = secrets.token_urlsafe(9)
        conn.execute(f"INSERT INTO publications ({COLUMNS}) VALUES (?, ?, ?, ?, ?, 'draft', NULL, NULL, ?, NULL, NULL, ?)",
                     (pid, idea_id, variant, platform, scheduled_at, int(time.time()), caption))
        return pid

    def post_row(pid: str, video: str, publisher) -> int:
        """Claim the draft, post it, store the outcome. Returns the HTTP status the outcome deserves."""
        with db() as conn:
            row = row_of(conn, pid)
            # Claim atomically so a double click or a concurrent request cannot post twice.
            claimed = conn.execute("UPDATE publications SET status = 'publishing' WHERE id = ? AND status IN ('draft', 'failed')",
                                   (pid,)).rowcount
        if not claimed:
            return 409
        try:
            record = publisher.publish(video, row[11], [row[3]], row[4])[0]
        except Exception as exc:  # whatever the platform client raises is stored and shown
            record = {"status": "failed", "error": str(exc), "externalId": None, "url": None, "publishedAt": None}
        with db() as conn:
            conn.execute("UPDATE publications SET status = ?, external_id = ?, url = ?, published_at = ?, error = ? WHERE id = ?",
                         (record["status"], record.get("externalId"), record.get("url"), record.get("publishedAt"),
                          record.get("error"), pid))
        return 502 if record["status"] == "failed" else 200

    def publisher_or_error():
        try:
            return publishers.get_publisher(), None
        except publishers.PublisherError as exc:
            return None, error(503, str(exc))

    @router.post("/api/publications")
    def create(body: PublicationCreate):
        if body.platform not in PLATFORMS:
            return error(422, "Unknown platform.")
        with db() as conn:
            if approved_cut(conn, load, media_dir().resolve(), body.ideaId) is None:
                return error(409, NOT_APPROVED)
            pid = new_draft(conn, body.ideaId, body.variant, body.platform, body.caption, body.scheduledAt)
            return to_json(row_of(conn, pid))

    @router.post("/api/publications/{pid}/publish")
    def publish(pid: str):
        publisher, failure = publisher_or_error()
        with db() as conn:
            row = row_of(conn, pid)
            video = None if row is None else approved_cut(conn, load, media_dir().resolve(), row[1])
        if row is None:
            return error(404, "No such publication.")
        if failure:
            return failure
        if video is None:
            return error(409, NOT_APPROVED)
        status = post_row(pid, str(video), publisher)
        with db() as conn:
            out = row_of(conn, pid)
        if status == 409:
            return error(409, "Only a draft or failed publication can be published.")
        return JSONResponse(to_json(out), status_code=status)

    @router.post("/api/ideas/{idea_id}/publish")
    def publish_idea(idea_id: str, body: PublishRequest):
        if any(p not in PLATFORMS for p in body.platforms) or len(set(body.platforms)) != len(body.platforms):
            return error(422, "Unknown or repeated platform.")
        publisher, failure = publisher_or_error()
        if failure:
            return failure
        with db() as conn:
            video = approved_cut(conn, load, media_dir().resolve(), idea_id)
            if video is None:
                return error(409, NOT_APPROVED)
            pids = [new_draft(conn, idea_id, body.variant, p, body.caption, body.scheduleAt) for p in body.platforms]
        statuses = [post_row(pid, str(video), publisher) for pid in pids]
        with db() as conn:
            posts = [to_json(row_of(conn, pid)) for pid in pids]
        return JSONResponse({"posts": posts}, status_code=502 if all(s == 502 for s in statuses) else 200)

    @router.get("/api/ideas/{idea_id}/publications")
    def listing(idea_id: str):
        with db() as conn:
            rows = conn.execute(f"SELECT {COLUMNS} FROM publications WHERE idea_id = ?{visible()} ORDER BY created_at, variant",
                                (idea_id,)).fetchall()
        return [to_json(r) for r in rows]

    @router.post("/api/publications/{pid}/metrics")
    def add_metrics(pid: str, body: MetricsIn):
        values = [getattr(body, k) for k in COUNTS]
        if all(v is None for v in values):
            return error(422, "Enter at least one number.")
        with db() as conn:
            if row_of(conn, pid) is None:
                return error(404, "No such publication.")
            conn.execute("INSERT INTO publication_metrics (publication_id, views, likes, comments, shares, saves, followers, fetched_at, source) "
                         "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')",
                         (pid, *values, body.followers, body.fetchedAt if body.fetchedAt is not None else int(time.time())))
        return {"ok": True}

    @router.post("/api/publications/{pid}/metrics/fetch")
    def fetch_metrics(pid: str):
        publisher, failure = publisher_or_error()
        with db() as conn:
            row = row_of(conn, pid)
        if row is None:
            return error(404, "No such publication.")
        if failure:
            return failure
        if not row[6]:
            return error(409, "This post has not been published yet.")
        try:
            got = publisher.fetch_metrics(row[6], row[3])
        except Exception as exc:
            return error(502, str(exc))
        with db() as conn:
            conn.execute("INSERT INTO publication_metrics (publication_id, views, likes, comments, shares, saves, fetched_at, source) "
                         "VALUES (?, ?, ?, ?, ?, ?, ?, 'api')", (pid, *(got.get(k) for k in COUNTS), int(time.time())))
        return {"ok": True, "metrics": got}

    @router.get("/api/publishing/mode")
    def publishing_mode():
        """Tells the UI whether posts are simulated (the fake publisher), so it never calls one "published"."""
        mode = publishers.mode()
        return {"mode": mode, "simulated": mode == "fake"}

    @router.get("/api/publishing/summary")
    def summary():
        videos = {v.get("id"): v for v in (load("library") or {}).get("videos", [])}
        topics_of = {}
        for idea in load("ideas") or []:
            tags = (videos.get(idea.get("videoId")) or {}).get("hashtags") or []
            topics_of[idea["id"]] = sorted({t.lower().lstrip("#") for t in tags if t.strip("# ")})
        with db() as conn:
            rows = publish_summary.latest_by_post(conn, visible(), metric_filter())
        return publish_summary.summarise(rows, topics_of)

    @router.get("/api/ideas/{idea_id}/compare")
    def compare(idea_id: str):
        with db() as conn:
            pubs = conn.execute(f"SELECT id, variant, platform FROM publications WHERE idea_id = ?{visible()} ORDER BY variant, created_at",
                                (idea_id,)).fetchall()
            variants = []
            for pid, variant, platform in pubs:
                snap = conn.execute("SELECT views, likes, comments, shares, fetched_at, source, saves, followers FROM publication_metrics "
                                    f"WHERE publication_id = ?{metric_filter()} ORDER BY fetched_at DESC, rowid DESC LIMIT 1", (pid,)).fetchone()
                latest = None if snap is None else {**dict(zip(COUNTS, snap[:4])), "fetchedAt": snap[4], "source": snap[5],
                                                    "saves": snap[6], "followers": snap[7]}
                variants.append({"variant": variant, "publicationId": pid, "platform": platform, "latest": latest,
                                 "viewsVsBest": None})
        views = [v["latest"]["views"] for v in variants if v["latest"] and v["latest"]["views"] is not None]
        best = max(views, default=0)
        if len(variants) > 1 and len(views) > 1 and best > 0:
            for v in variants:
                if v["latest"] and v["latest"]["views"] is not None:
                    v["viewsVsBest"] = v["latest"]["views"] / best
        return {"variants": variants}

    return router
