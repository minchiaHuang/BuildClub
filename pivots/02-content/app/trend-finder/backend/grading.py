"""Colour-grading presets for the cut: ffmpeg filter strings, a one-frame before/after preview, and the
routes that list the presets and serve the preview. Applied to the finished picture in cutting.render_cut."""

import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Callable, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response

import cutting
from cutting import CutError

# name -> (label, ffmpeg video filter chain). "" means no change.
PRESETS: dict[str, tuple[str, str]] = {
    "none": ("Original", ""),
    "warm": ("Warm", "colorbalance=rs=0.08:gs=0.02:bs=-0.10:rm=0.06:bm=-0.06,eq=saturation=1.08"),
    "cool": ("Cool", "colorbalance=rs=-0.08:bs=0.10:rm=-0.05:bm=0.06,eq=saturation=1.03"),
    "vivid": ("Vivid", "eq=contrast=1.12:saturation=1.35:gamma=0.98"),
    "muted": ("Muted", "eq=contrast=0.94:saturation=0.7:brightness=0.01"),
    "bw": ("Black and white", "hue=s=0,eq=contrast=1.1"),
}

SCHEMA = (
    # The options of the latest "Make the video" request (grade and subtitle burn-in), as JSON.
    "CREATE TABLE IF NOT EXISTS cut_options (idea_id TEXT PRIMARY KEY, options TEXT NOT NULL)",
)

BAD_GRADE = "Choose a colour grade from the list."
NO_TAKE = "Upload a take first, then the preview can show the grade."
PREVIEW_W, PREVIEW_H = 360, 640


def grade_filter(name: str) -> str:
    """The ffmpeg filter chain of a preset ('' for none). Unknown names raise ValueError."""
    if name not in PRESETS:
        raise ValueError(name)
    return PRESETS[name][1]


def list_presets() -> list[dict]:
    return [{"id": k, "label": label} for k, (label, _) in PRESETS.items()]


def preview_graph(name: str) -> str:
    """One frame, original on the left and graded on the right, each 360x640."""
    chain = grade_filter(name) or "null"
    return (f"[0:v]scale={PREVIEW_W}:{PREVIEW_H}:force_original_aspect_ratio=increase,"
            f"crop={PREVIEW_W}:{PREVIEW_H},setsar=1,format=yuv420p,split[a][b];[b]{chain}[g];[a][g]hstack[o]")


def render_preview(src: Path, name: str, at: float = 0.5) -> bytes:
    """A PNG of one frame of `src` before and after the preset."""
    fd, tmp = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        cutting._ffmpeg(["-ss", cutting.num(max(at, 0.0)), "-i", str(src), "-filter_complex", preview_graph(name),
                         "-map", "[o]", "-frames:v", "1", tmp], "Making the preview")
        return Path(tmp).read_bytes()
    finally:
        Path(tmp).unlink(missing_ok=True)


def make_router(db, media_dir: Callable[[], Path]) -> APIRouter:
    router = APIRouter()

    @router.get("/api/cut/grades")
    def grades():
        return {"presets": list_presets()}

    @router.get("/api/ideas/{idea_id}/cut/grade-preview")
    def grade_preview(idea_id: str, preset: str, t: float = 0.5):
        if preset not in PRESETS:
            return JSONResponse({"error": BAD_GRADE}, status_code=422)
        root = media_dir().resolve()
        if (root / idea_id).resolve().parent != root:
            return JSONResponse({"error": NO_TAKE}, status_code=404)
        with db() as conn:
            row = conn.execute("SELECT id, ext FROM takes WHERE idea_id = ? AND chosen = 1 ORDER BY shot LIMIT 1",
                               (idea_id,)).fetchone()
        src = root / idea_id / f"{row[0]}.{row[1]}" if row else None
        if src is None or not src.is_file():
            return JSONResponse({"error": NO_TAKE}, status_code=404)
        if not shutil.which("ffmpeg"):
            return JSONResponse({"error": cutting.NO_FFMPEG}, status_code=503)
        try:
            return Response(render_preview(src, preset, t), media_type="image/png")
        except CutError as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    return router


def load_options(conn, idea_id: str) -> dict:
    row = conn.execute("SELECT options FROM cut_options WHERE idea_id = ?", (idea_id,)).fetchone()
    return json.loads(row[0]) if row else {}


def save_options(conn, idea_id: str, options: dict) -> None:
    conn.execute("INSERT OR REPLACE INTO cut_options (idea_id, options) VALUES (?, ?)",
                 (idea_id, json.dumps(options)))
