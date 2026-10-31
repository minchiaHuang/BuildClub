"""Cutting a rough take into a publishable reel: pure helpers (word timing, keep intervals,
ffmpeg filtergraph strings, tool output parsers). Nothing here runs a program or touches the database."""

import json
import re
import shutil
import string
from pathlib import Path

import analyze

Word = tuple[float, float, str]  # start, end, text (seconds)

FILLERS = {"um", "umm", "uh", "uhh", "er", "erm", "hm", "hmm"}  # English only; Chinese fillers are unverified
MIN_FRAGMENT = 0.08  # seconds; shorter keep intervals are dropped
FADE = 0.012         # seconds of fade at every seam
LOUDNORM = "I=-13:TP=-1.5:LRA=11"  # reel-studio finish.py target, not a platform rule

NO_FFMPEG = ("ffmpeg isn't installed on this computer, so the cut can't be made. "
             "Install it (brew install ffmpeg) and try again.")
NO_WHISPER = ("whisper.cpp or its model wasn't found (looked for /opt/homebrew/bin/whisper-cli "
              "and ~/models/ggml-large-v3-turbo-q5_0.bin), so the cut can't be made.")


def num(x: float) -> str:
    """A short, stable decimal for filtergraph strings."""
    return f"{x:.3f}".rstrip("0").rstrip(".") or "0"


def parse_words(data: dict) -> list[Word]:
    """whisper-cli JSON (one word per segment, offsets in ms) to sorted (start, end, text) in seconds."""
    words = []
    for seg in data.get("transcription", []):
        text = seg.get("text", "").strip()
        if not text or (text[0], text[-1]) in {("[", "]"), ("(", ")")}:
            continue
        words.append((seg["offsets"]["from"] / 1000, seg["offsets"]["to"] / 1000, text))
    return sorted(words, key=lambda w: w[0])


def is_filler(text: str) -> bool:
    return text.strip().lower().strip(string.punctuation + " ") in FILLERS


def _effective_ends(words: list[Word], silences: list[tuple[float, float]]) -> list[float]:
    """whisper's word end can swallow the silence after it; trust the earliest silence that starts
    inside the word and runs to (or past) its end."""
    ends = []
    for i, (start, end, _) in enumerate(words):
        starts = [s for s, e in silences if start < s < end and e >= end]
        nxt = words[i + 1][0] if i + 1 < len(words) else end
        ends.append(min(starts) if starts else min(end, nxt))
    return ends


def keep_intervals(words: list[Word], silences: list[tuple[float, float]], total: float,
                   *, keep: float = 0.12, min_gap: float = 0.4) -> list[tuple[float, float]]:
    """Sorted, disjoint intervals of [0, total] to keep: fillers and gaps longer than min_gap are cut,
    leaving `keep` seconds of air beside each real word."""
    if not words:
        return [(0.0, total)]
    words = sorted(words, key=lambda w: w[0])
    ends = _effective_ends(words, silences)
    removals = []
    for (start, _, text), end in zip(words, ends):
        if is_filler(text):
            removals.append((start, end))
    # gaps: head, between words, tail; each side next to a filler gets no keep (the filler goes whole)
    edges = [(0.0, words[0][0], False, is_filler(words[0][2]))]
    for i in range(len(words) - 1):
        edges.append((ends[i], words[i + 1][0], is_filler(words[i][2]), is_filler(words[i + 1][2])))
    edges.append((ends[-1], total, is_filler(words[-1][2]), False))
    for lo, hi, left_filler, right_filler in edges:
        if hi - lo > min_gap:
            a = lo if left_filler else lo + keep
            b = hi if right_filler else hi - keep
            if b > a:
                removals.append((a, b))
    merged = []
    for a, b in sorted(removals):
        a, b = max(a, 0.0), min(b, total)
        if b <= a:
            continue
        if merged and a <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], b))
        else:
            merged.append((a, b))
    keeps, cursor = [], 0.0
    for a, b in merged + [(total, total)]:
        if a - cursor >= MIN_FRAGMENT:
            keeps.append((cursor, a))
        cursor = b
    return keeps


def atempo_chain(speed: float) -> str:
    """ffmpeg atempo only accepts 0.5-2.0 per filter, so larger speeds are split."""
    if speed == 1.0:
        return ""
    parts, rest = [], speed
    while rest > 2.0:
        parts.append(2.0)
        rest /= 2.0
    parts.append(round(rest, 6))
    return ",".join(f"atempo={p}" for p in parts)


def output_duration(keeps: list[tuple[float, float]], speed: float) -> float:
    return sum(b - a for a, b in keeps) / speed


def build_join_graph(takes: list[dict]) -> str:
    """Filtergraph that crops every take to 1080x1920/30fps/48 kHz stereo and concatenates them.
    Input i is take i; a take without audio gets generated silence of its length."""
    parts, labels = [], ""
    for i, take in enumerate(takes):
        parts.append(f"[{i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
                     f"setsar=1,fps=30,format=yuv420p[v{i}]")
        if take["hasAudio"]:
            parts.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo[a{i}]")
        else:
            parts.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{num(take['duration'])}[a{i}]")
        labels += f"[v{i}][a{i}]"
    parts.append(f"{labels}concat=n={len(takes)}:v=1:a=1[v][a]")
    return ";".join(parts)


def build_cut_graph(keeps: list[tuple[float, float]], speed: float, *, music: bool, audio_only: bool,
                    loudnorm: dict | None) -> str:
    """Filtergraph over the joined file (input 0) and optional music (input 1): keep the intervals,
    speed up, mix, loudnorm. loudnorm None is measuring pass 1; a dict is pass 2 with those measurements.
    Outputs are [v] (unless audio_only) and [a]."""
    parts, labels = [], ""
    for i, (a, b) in enumerate(keeps):
        span = f"start={num(a)}:end={num(b)}"
        if not audio_only:
            parts.append(f"[0:v]trim={span},setpts=PTS-STARTPTS[v{i}]")
        fade_out = num(b - a - FADE)
        parts.append(f"[0:a]atrim={span},asetpts=PTS-STARTPTS,afade=t=in:d={FADE},"
                     f"afade=t=out:st={fade_out}:d={FADE}[a{i}]")
        labels += ("" if audio_only else f"[v{i}]") + f"[a{i}]"
    n = len(keeps)
    if audio_only:
        parts.append(f"{labels}concat=n={n}:v=0:a=1[ac]")
    else:
        parts.append(f"{labels}concat=n={n}:v=1:a=1[vc][ac]")
        parts.append(f"[vc]setpts=PTS/{num(speed)}[v]" if speed != 1.0 else "[vc]null[v]")
    tempo = atempo_chain(speed)
    parts.append(f"[ac]{tempo or 'anull'}[as]")
    mixed = "as"
    if music:
        out = output_duration(keeps, speed)
        parts.append(f"[1:a]atrim=0:{num(out)},volume=0.25,afade=t=in:d=1.2,"
                     f"afade=t=out:st={num(out - 1.2)}:d=1.2[m]")
        parts.append("[as][m]amix=inputs=2:duration=first:normalize=0[am]")
        mixed = "am"
    if loudnorm is None:
        norm = f"loudnorm={LOUDNORM}:print_format=json"
    else:
        norm = (f"loudnorm={LOUDNORM}:measured_I={num(loudnorm['input_i'])}:measured_TP={num(loudnorm['input_tp'])}:"
                f"measured_LRA={num(loudnorm['input_lra'])}:measured_thresh={num(loudnorm['input_thresh'])}:"
                f"offset={num(loudnorm['target_offset'])}:linear=true")
    parts.append(f"[{mixed}]{norm},aresample=48000[a]")
    return ";".join(parts)


def parse_loudnorm(stderr: str) -> dict:
    """The measurement block loudnorm prints at the end of ffmpeg's stderr."""
    block = json.loads(stderr[stderr.rindex("{"):stderr.rindex("}") + 1])
    return {k: float(block[k]) for k in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")}


def parse_silences(stderr: str, total: float) -> list[tuple[float, float]]:
    """silencedetect lines to (start, end); a silence still open at the end runs to total."""
    out, start = [], None
    for m in re.finditer(r"silence_(start|end): (-?[\d.]+)", stderr):
        if m.group(1) == "start":
            start = float(m.group(2))
        elif start is not None:
            out.append((start, float(m.group(2))))
            start = None
    if start is not None:
        out.append((start, total))
    return out


def parse_progress(line: str, total: float) -> float | None:
    """One `-progress pipe:1` line to a 0-1 fraction of total, or None for any other line."""
    m = re.match(r"out_time_us=(\d+)$", line.strip())
    if not m or total <= 0:
        return None
    return min(1.0, int(m.group(1)) / 1e6 / total)


def missing_tools() -> str | None:
    """The 503 sentence for the first missing program, else None. Reads analyze's paths at call time."""
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        return NO_FFMPEG
    if not (Path(analyze.WHISPER).is_file() and Path(analyze.MODEL).is_file()):
        return NO_WHISPER
    return None
