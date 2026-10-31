"""Cutting a rough take into a publishable reel: pure helpers (word timing, keep intervals,
ffmpeg filtergraph strings, tool output parsers). Nothing here runs a program or touches the database."""

import json
import math
import os
import re
import shutil
import string
import subprocess
import threading
from pathlib import Path

import analyze

Word = tuple[float, float, str]  # start, end, text (seconds)

FILLERS = {"um", "umm", "uh", "uhh", "er", "erm", "hm", "hmm"}  # English only; Chinese fillers are unverified
MIN_FRAGMENT = 0.08  # seconds; shorter keep intervals are dropped
FADE = 0.012         # seconds of fade at every seam
MAX_INPUT_SEC = 600  # total length of the chosen takes
WHISPER_TIMEOUT = 900
FFMPEG_TIMEOUT = 1800  # seconds; any single ffmpeg/ffprobe call, so a hung process can't stall the worker
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


def wordless_spans(durations: list[float], words: list[Word]) -> list[tuple[float, float]]:
    """(start, end) in the joined timeline of every take that has no transcribed word starting inside it."""
    spans, offset = [], 0.0
    for d in durations:
        end = offset + d
        if not any(offset <= w[0] < end for w in words):
            spans.append((offset, end))
        offset = end
    return spans


def keep_intervals(words: list[Word], silences: list[tuple[float, float]], total: float,
                   *, keep: float = 0.12, min_gap: float = 0.4,
                   protected: list[tuple[float, float]] = ()) -> list[tuple[float, float]]:
    """Sorted, disjoint intervals of [0, total] to keep: fillers and gaps longer than min_gap are cut,
    leaving `keep` seconds of air beside each real word. Nothing inside a `protected` span is ever cut."""
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
    for pa, pb in sorted(protected):
        cut_up = []
        for a, b in merged:
            if b <= pa or a >= pb:
                cut_up.append((a, b))
                continue
            if a < pa:
                cut_up.append((a, pa))
            if b > pb:
                cut_up.append((pb, b))
        merged = cut_up
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


class CutError(Exception):
    """A one-sentence, human-readable reason the cut could not be made."""


def run(cmd: list[str], *, timeout: float | None = FFMPEG_TIMEOUT) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=timeout)
    except FileNotFoundError:
        raise CutError(NO_WHISPER if cmd[0] == analyze.WHISPER else NO_FFMPEG)
    except subprocess.TimeoutExpired:
        raise CutError(f"{Path(cmd[0]).name} took too long, so the cut was stopped.")


def _ffmpeg(args: list[str], what: str, *, quiet: bool = True) -> subprocess.CompletedProcess:
    """Run ffmpeg; a failure becomes a CutError carrying the tail of stderr."""
    r = run(["ffmpeg", "-y", "-nostdin", "-v", "error" if quiet else "info", *args])
    if r.returncode != 0:
        raise CutError(f"{what} failed: {r.stderr.strip()[-200:]}")
    return r


def probe(path: Path) -> dict:
    r = run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)])
    if r.returncode != 0:
        raise CutError(f"Could not read {Path(path).name}: {r.stderr.strip()[-200:]}")
    data = json.loads(r.stdout or "{}")
    streams = data.get("streams", [])
    v = next((s for s in streams if s.get("codec_type") == "video"), {})
    a = next((s for s in streams if s.get("codec_type") == "audio"), {})
    fps = 0.0
    if v.get("avg_frame_rate", "0/0") not in ("0/0", "0"):
        n, d = v["avg_frame_rate"].split("/")
        fps = round(float(n) / float(d), 3) if float(d) else 0.0
    return {"duration": float(data.get("format", {}).get("duration") or 0),
            "width": v.get("width"), "height": v.get("height"), "fps": fps, "hasAudio": bool(a),
            "vcodec": v.get("codec_name"), "acodec": a.get("codec_name"), "pix_fmt": v.get("pix_fmt"),
            "sample_rate": int(a["sample_rate"]) if a.get("sample_rate") else None}


def measure_loudness(path: Path) -> dict:
    """Integrated loudness (LUFS) and true peak (dBFS) from ebur128's closing summary."""
    r = run(["ffmpeg", "-nostdin", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"])
    summary = r.stderr[r.stderr.rfind("Summary:"):]
    i = re.search(r"\bI:\s+(-?[\d.]+|-inf) LUFS", summary)
    pk = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary)
    if r.returncode != 0 or not i or not pk:
        raise CutError("Could not measure the loudness of the result.")
    return {"I": float(i.group(1)), "peak": float(pk.group(1))}


def transcribe_words(wav: Path, work: Path) -> list[Word]:
    """Word timings from whisper.cpp. A missing tool or a failed run is an error, never an empty list."""
    if not (Path(analyze.WHISPER).is_file() and Path(analyze.MODEL).is_file()):
        raise CutError(NO_WHISPER)
    base = Path(work) / "words"
    base.with_suffix(".json").unlink(missing_ok=True)
    r = run([analyze.WHISPER, "-m", str(analyze.MODEL), "-f", str(wav), "-l", "auto", "-ml", "1", "-sow",
             "-ojf", "-of", str(base), "-np"], timeout=WHISPER_TIMEOUT)
    if r.returncode != 0:
        raise CutError(f"Finding the words failed: {r.stderr.strip()[-200:]}")
    try:
        return parse_words(json.loads(base.with_suffix(".json").read_text(encoding="utf-8", errors="replace")))
    except (OSError, ValueError):
        raise CutError("Finding the words failed: whisper.cpp produced no readable result.")


def _render_pass(cmd: list[str], total: float, on_progress, err_path: Path) -> None:
    """Run ffmpeg with `-progress pipe:1`, reporting a 0-1 fraction; stderr goes to a file so it can't block."""
    timed_out = False
    with open(err_path, "w+") as err:
        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=err, stdin=subprocess.DEVNULL, text=True)
        except FileNotFoundError:
            raise CutError(NO_FFMPEG)

        def expire():
            nonlocal timed_out
            timed_out = True
            proc.kill()

        timer = threading.Timer(FFMPEG_TIMEOUT, expire)
        timer.start()
        try:
            for line in proc.stdout:
                frac = parse_progress(line, total)
                if frac is not None:
                    on_progress(frac)
            code = proc.wait()
        finally:
            timer.cancel()
            if proc.poll() is None:
                proc.kill()
                proc.wait()
        err.seek(0)
        tail = err.read().strip()[-200:]
    if timed_out:
        raise CutError("Rendering the video took too long, so the cut was stopped.")
    if code != 0:
        raise CutError(f"Rendering the video failed: {tail}")


def render_cut(takes: list[dict], music: Path | None, speed: float, work: Path, out: Path, step,
               *, words_fn=transcribe_words) -> dict:
    """Join the takes, cut silences and fillers, speed up, mix music, two-pass loudnorm, and write `out`
    (via out.with_suffix('.part')). `step(progress, text)` is called at each milestone. Intermediate
    files stay in `work`; removing `work` is the caller's job."""
    work, out = Path(work), Path(out)
    work.mkdir(parents=True, exist_ok=True)
    out.parent.mkdir(parents=True, exist_ok=True)

    step(0.02, "Checking the takes")
    infos = [{**t, **probe(t["path"])} for t in takes]
    if not infos:
        raise CutError("There are no takes to cut.")
    if sum(i["duration"] for i in infos) > MAX_INPUT_SEC:
        raise CutError(f"The chosen takes are too long (over {MAX_INPUT_SEC // 60} minutes in total).")

    step(0.10, "Joining the takes")
    joined = work / "joined.mkv"
    (work / "join.txt").write_text(build_join_graph(infos))
    cmd = []
    for i in infos:
        cmd += ["-i", str(i["path"])]
    _ffmpeg([*cmd, "-/filter_complex", str(work / "join.txt"), "-map", "[v]", "-map", "[a]",
             "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-c:a", "pcm_s16le", str(joined)],
            "Joining the takes")
    total = probe(joined)["duration"]

    step(0.15, "Listening for words")
    wav = work / "audio.wav"
    _ffmpeg(["-i", str(joined), "-vn", "-ac", "1", "-ar", "16000", str(wav)], "Extracting the sound")
    words = words_fn(wav, work)

    if words:
        step(0.50, "Finding silences")
        r = _ffmpeg(["-i", str(joined), "-vn", "-af", "silencedetect=n=-35dB:d=0.15", "-f", "null", "-"],
                    "Finding silences", quiet=False)
        silences = parse_silences(r.stderr, total)
    else:
        step(0.50, "No speech found, so nothing was cut.")
        silences = []
    keeps = keep_intervals(words, silences, total, protected=wordless_spans([i["duration"] for i in infos], words))
    if sum(b - a for a, b in keeps) < 1.0:
        raise CutError("Less than a second would be left after cutting, so nothing was made.")

    step(0.60, "Measuring the sound")
    use_music = music is not None
    src = ["-i", str(joined)] + (["-stream_loop", "-1", "-i", str(music)] if use_music else [])
    g1, g2 = work / "g1.txt", work / "g2.txt"
    g1.write_text(build_cut_graph(keeps, speed, music=use_music, audio_only=True, loudnorm=None))
    r = _ffmpeg([*src, "-/filter_complex", str(g1), "-map", "[a]", "-f", "null", "-"],
                "Measuring the sound", quiet=False)
    measured = None
    if "{" not in r.stderr:
        raise CutError("Measuring the sound failed: ffmpeg gave no loudness reading.")
    try:
        measured = parse_loudnorm(r.stderr)
    except (ValueError, KeyError):
        raise CutError("Measuring the sound failed: the loudness reading was unreadable.")
    if not all(math.isfinite(v) for v in measured.values()):
        measured = None  # all-silent audio: nothing to normalise, so drop loudnorm from the final graph
    graph = build_cut_graph(keeps, speed, music=use_music, audio_only=False, loudnorm=measured)
    if measured is None:
        graph = re.sub(r"loudnorm=[^,;]*,", "", graph)
    g2.write_text(graph)

    expected = output_duration(keeps, speed)
    part = out.with_suffix(".part")
    step(0.65, "Rendering")
    _render_pass(["ffmpeg", "-y", "-nostdin", "-v", "error", *src, "-/filter_complex", str(g2),
                  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "18", "-preset", "medium",
                  "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                  "-movflags", "+faststart", "-t", num(expected + 0.5), "-f", "mp4",
                  "-progress", "pipe:1", "-nostats", str(part)],
                 expected, lambda f: step(0.65 + 0.30 * f, "Rendering"), work / "render.err")

    step(0.97, "Checking the result")
    p = probe(part)
    got = (p["width"], p["height"], p["fps"], p["vcodec"], p["acodec"], p["pix_fmt"], p["sample_rate"])
    if got != (1080, 1920, 30, "h264", "aac", "yuv420p", 48000):
        part.unlink(missing_ok=True)
        raise CutError("The finished video didn't match the expected format, so it was discarded.")
    os.replace(part, out)
    return {"size": out.stat().st_size, "durationSec": p["duration"]}
