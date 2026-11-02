"""Subtitles for the cut: cues from whisper word timings (remapped to the FINAL video), .srt text, cue
pictures drawn with Pillow (the local ffmpeg has no subtitles/drawtext filter) and the routes that serve and
edit the cues. Burn-in composites one overlay stream of those pictures in cutting.render_cut."""

import json
import os
import re
from pathlib import Path
from typing import Callable, Literal, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

import cutting

Cue = dict  # {"id": int, "start": float, "end": float, "text": str}

MAX_UNITS = 32      # a cue holds at most this many width units (a CJK character is 2, anything else 1)
MAX_CUE_SEC = 4.0
MAX_GAP_SEC = 0.6   # a pause this long starts a new cue
SENTENCE_END = ".!?。！？"
MIN_BREAK_UNITS = 10  # a sentence end only starts a new cue once the cue is this wide
MAX_TEXT = 200

FRAME_W, FRAME_H = 1080, 1920
SIZES = {"S": 44, "M": 56, "L": 72}
MARGIN_X = 70
BOTTOM_EDGE = 1460  # bottom of the text block for "bottom": above the platform's own buttons and caption
FONT_ENV = "SUBTITLE_FONT"
FONT_CANDIDATES = (
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
)

NO_FONT = ("No font with Chinese characters was found for the subtitles. Set SUBTITLE_FONT to the path of a "
           ".ttf/.ttc/.otf font file and try again.")
NO_PILLOW = "The Pillow package isn't installed, so subtitles can't be drawn."
NO_CUES = "There are no subtitles for this plan yet."
BAD_CUES = "Send every subtitle with its id and its text, in the form the page loaded them."


class SubtitleError(Exception):
    """A one-sentence reason the subtitles could not be made."""


class BurnStyle(BaseModel):
    size: Literal["S", "M", "L"] = "M"
    position: Literal["bottom", "middle"] = "bottom"
    box: bool = True


class CueEdit(BaseModel):
    id: int = Field(strict=True)
    text: str = Field(max_length=MAX_TEXT)


class CueEdits(BaseModel):
    cues: list[CueEdit]


def is_cjk(ch: str) -> bool:
    o = ord(ch)
    return (0x2E80 <= o <= 0x9FFF or 0xAC00 <= o <= 0xD7AF or 0xF900 <= o <= 0xFAFF
            or 0x3000 <= o <= 0x303F or 0xFF00 <= o <= 0xFFEF)


def width_units(text: str) -> int:
    return sum(2 if is_cjk(c) else 1 for c in text)


def join_text(parts: list[str]) -> str:
    """Words joined with a space, except beside a CJK character (Chinese has no spaces)."""
    out = ""
    for p in parts:
        if out and not (is_cjk(out[-1]) or is_cjk(p[0])):
            out += " "
        out += p
    return out


def remap_words(words: list[cutting.Word], keeps: list[tuple[float, float]], speed: float) -> list[cutting.Word]:
    """Word timings from the joined timeline to the final video: fillers and words inside removed gaps
    are dropped, the kept intervals are laid end to end, and the result is divided by the speed."""
    starts, acc = [], 0.0
    for a, b in keeps:
        starts.append(acc)
        acc += b - a
    out = []
    for s, e, text in sorted(words, key=lambda w: w[0]):
        if cutting.is_filler(text):
            continue
        hits = [(off + max(s, a) - a, off + min(e, b) - a)
                for (a, b), off in zip(keeps, starts) if min(e, b) > max(s, a)]
        if hits:
            out.append((hits[0][0] / speed, max(hits[-1][1], hits[0][0] + 0.05) / speed, text))
    return out


def group_cues(words: list[cutting.Word]) -> list[Cue]:
    """Readable cues: a cue is cut at MAX_UNITS wide, MAX_CUE_SEC long, a pause, or a sentence end."""
    groups, cur = [], []
    for w in words:
        if cur:
            prev = cur[-1]
            text = join_text([x[2] for x in cur] + [w[2]])
            wide = width_units(join_text([x[2] for x in cur]))
            if (width_units(text) > MAX_UNITS or w[1] - cur[0][0] > MAX_CUE_SEC
                    or w[0] - prev[1] > MAX_GAP_SEC
                    or (prev[2][-1] in SENTENCE_END and wide >= MIN_BREAK_UNITS)):
                groups.append(cur)
                cur = []
        cur.append(w)
    if cur:
        groups.append(cur)
    cues = []
    for i, g in enumerate(groups):
        end = g[-1][1]
        if i + 1 < len(groups):
            end = min(end, groups[i + 1][0][0])  # never overlap the next cue
        cues.append({"id": i, "start": round(g[0][0], 3), "end": round(max(end, g[0][0] + 0.05), 3),
                     "text": join_text([x[2] for x in g])})
    return cues


def build_cues(words: list[cutting.Word], keeps: list[tuple[float, float]], speed: float) -> list[Cue]:
    return group_cues(remap_words(words, keeps, speed))


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def to_srt(cues: list[Cue]) -> str:
    blocks = [f"{n}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}\n"
              for n, c in enumerate(cues, 1)]
    return "\n".join(blocks)


# ---- picture of a cue -------------------------------------------------------------------------------------

def find_font() -> str:
    """$SUBTITLE_FONT if it is a file, else the first known CJK font on this machine."""
    custom = os.environ.get(FONT_ENV, "")
    if custom and Path(custom).is_file():
        return custom
    for path in FONT_CANDIDATES:
        if Path(path).is_file():
            return path
    raise SubtitleError(NO_FONT)


def _pillow():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        raise SubtitleError(NO_PILLOW)
    return Image, ImageDraw, ImageFont


def wrap_lines(text: str, font, max_width: float) -> list[str]:
    """Greedy wrap to a pixel width; a CJK character may break anywhere, latin breaks at spaces."""
    tokens = re.findall(r"[⺀-鿿가-힯豈-﫿　-〿＀-￯]|[^\s⺀-鿿"
                        r"가-힯豈-﫿　-〿＀-￯]+|\s+", text)
    lines, cur = [], ""
    for tok in tokens:
        if tok.isspace():
            cur += " " if cur and not cur.endswith(" ") else ""
            continue
        trial = cur + tok
        if cur and font.getlength(trial.rstrip()) > max_width:
            lines.append(cur.rstrip())
            cur = tok
        else:
            cur = trial
    if cur.strip():
        lines.append(cur.rstrip())
    return lines or [""]


def render_cue_png(text: str, style: BurnStyle, path: Path, font_path: Optional[str] = None) -> Path:
    """A transparent 1080x1920 picture with the cue drawn at the style's size and position."""
    Image, ImageDraw, ImageFont = _pillow()
    size = SIZES[style.size]
    font = ImageFont.truetype(font_path or find_font(), size)
    lines = wrap_lines(text, font, FRAME_W - 2 * MARGIN_X)
    line_h = int(size * 1.3)
    pad = int(size * 0.4)
    block_h = line_h * len(lines)
    width = max(font.getlength(line) for line in lines)
    top = BOTTOM_EDGE - block_h if style.position == "bottom" else (FRAME_H - block_h) // 2
    img = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if style.box:
        x0, x1 = (FRAME_W - width) / 2 - pad, (FRAME_W + width) / 2 + pad
        draw.rounded_rectangle((x0, top - pad // 2, x1, top + block_h + pad // 2), radius=pad // 2,
                               fill=(0, 0, 0, 170))
    for n, line in enumerate(lines):
        draw.text((FRAME_W / 2, top + n * line_h + (line_h - size) / 2), line, font=font, fill=(255, 255, 255, 255),
                  anchor="mt", stroke_width=0 if style.box else max(2, size // 16), stroke_fill=(0, 0, 0, 255))
    img.save(path)
    return path


def write_overlay(cues: list[Cue], style: BurnStyle, folder: Path, total: float) -> Path:
    """Draw every cue and write an ffmpeg concat list (picture, how long) that covers [0, total + 1 s]:
    a blank picture fills the gaps. Returns the list file."""
    Image, _, _ = _pillow()
    folder.mkdir(parents=True, exist_ok=True)
    font_path = find_font()
    blank = folder / "blank.png"
    Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0)).save(blank)
    entries, cursor = [], 0.0
    for c in cues:
        start, end = max(c["start"], cursor), c["end"]
        if end - start < 0.02:
            continue
        if start - cursor > 0.001:
            entries.append((blank, start - cursor))
        entries.append((render_cue_png(c["text"], style, folder / f"cue{c['id']}.png", font_path), end - start))
        cursor = end
    entries.append((blank, max(total - cursor, 0.0) + 1.0))
    lines = [line for p, d in entries for line in (f"file '{p}'", f"duration {cutting.num(d)}")]
    lines.append(f"file '{entries[-1][0]}'")  # the concat demuxer ignores the last duration
    listing = folder / "cues.txt"
    listing.write_text("\n".join(lines) + "\n")
    return listing


def overlay_graph(video_label: str, input_index: int) -> str:
    """Filtergraph piece putting the cue stream (input `input_index`) over `video_label`; output [vo]."""
    return f";[{video_label}][{input_index}:v]overlay=0:0:format=auto:eof_action=pass[vo]"


# ---- saved cues -------------------------------------------------------------------------------------------

def cues_path(root: Path, idea_id: str) -> Optional[Path]:
    folder = (root.resolve() / idea_id).resolve()
    return folder / "cut" / "cues.json" if folder.parent == root.resolve() else None


def save_cues(path: Path, cues: list[Cue], signature: str, edited: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_suffix(".part")
    part.write_text(json.dumps({"signature": signature, "edited": edited, "cues": cues}), encoding="utf-8")
    os.replace(part, path)


def load_cues(path: Optional[Path]) -> Optional[dict]:
    try:
        data = json.loads(path.read_text(encoding="utf-8")) if path else None
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) and isinstance(data.get("cues"), list) else None


def reusable_cues(path: Optional[Path], signature: str) -> Optional[list[Cue]]:
    """The user's edited cues, but only when they were made from the same takes and speed (otherwise
    their timings would not match the new video)."""
    data = load_cues(path)
    return data["cues"] if data and data.get("edited") and data.get("signature") == signature else None


def make_router(media_dir: Callable[[], Path], exists: Callable[[str], bool]) -> APIRouter:
    router = APIRouter()

    def saved(idea_id: str):
        if not exists(idea_id):
            return None, JSONResponse({"error": "That plan doesn't exist."}, status_code=404)
        path = cues_path(media_dir(), idea_id)
        data = load_cues(path)
        if data is None:
            return None, JSONResponse({"error": NO_CUES}, status_code=404)
        return (path, data), None

    @router.get("/api/ideas/{idea_id}/cut/subtitles")
    def get_cues(idea_id: str):
        got, refused = saved(idea_id)
        if refused:
            return refused
        return {"cues": got[1]["cues"], "edited": bool(got[1].get("edited"))}

    @router.get("/api/ideas/{idea_id}/cut/subtitles.srt")
    def get_srt(idea_id: str):
        got, refused = saved(idea_id)
        if refused:
            return refused
        return Response(to_srt(got[1]["cues"]), media_type="application/x-subrip; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="remake-{idea_id}.srt"'})

    @router.put("/api/ideas/{idea_id}/cut/subtitles")
    def put_cues(idea_id: str, body: CueEdits):
        got, refused = saved(idea_id)
        if refused:
            return refused
        path, data = got
        old = data["cues"]
        if [e.id for e in body.cues] != [c["id"] for c in old] or any(not e.text.strip() for e in body.cues):
            return JSONResponse({"error": BAD_CUES}, status_code=422)
        cues = [{**c, "text": e.text.strip()} for c, e in zip(old, body.cues)]
        save_cues(path, cues, data.get("signature", ""), True)
        return {"cues": cues, "edited": True}

    return router
