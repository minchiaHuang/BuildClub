"""Video breakdown jobs. A job downloads one video, finds its shots, saves a frame per shot and
transcribes the speech, all locally and free (yt-dlp, ffmpeg, whisper.cpp). Claude then reads the
frames and transcript and explains why the video works, as a Breakdown.

Adapted from brand-studio/brand_studio/style_analysis.py and clipkit's single-worker queue.
Jobs run one at a time. A job's id comes from its URL, so asking for the same video again
reuses the work in jobs/<id>/.
"""

import base64
import hashlib
import json
import queue
import re
import subprocess
import threading
from pathlib import Path

import anthropic

from models import AnalyzeJob, Breakdown

HERE = Path(__file__).resolve().parent
JOBS_DIR = HERE / "jobs"
WHISPER = "/opt/homebrew/bin/whisper-cli"
MODEL = Path.home() / "models" / "ggml-large-v3-turbo-q5_0.bin"
CUT_THRESHOLD = 0.15  # ffmpeg scene score; 0.3 missed 4 of 13 cuts on a real episode (2026-10-18)
MIN_SHOT = 0.25       # seconds; closer cuts are flashes, not shots
MAX_FRAMES = 12       # frames sent to the AI step, which is billed per image
AI_MODEL = "claude-opus-5-5"
AI_MAX_TOKENS = 16000  # caps one breakdown at about US$0.36 (2026-10-27 prices)

PROMPT = """You are helping a social media manager understand why a short video went viral, so
their client can film something similar. Explain what the video does; do not write a new script.

Below are frames from the video (each labelled with its time) and the speech transcript with
timestamps. The video may not be in English: write everything in plain English, and translate
any quoted speech or on-screen text.

- why.hook: what makes people stop scrolling.
- why.first3s: what happens in the first 3 seconds and why it holds attention.
- why.length, why.format, why.sound: how the length, filming style and sound help it.
- shotList: the shots in order, time as "0-2s"; text is on-screen text, if any.
- props: things the client would need to film it.
- editorNotes: 2-3 short instructions for an editor matching this style.
- lines: the key spoken or on-screen lines in order, each with the job it does.

shotList text and lines text hold only the words themselves, translated: no quote marks, no
notes in brackets, no comments on the language or the subtitles. Leave shotList text empty when
there is no on-screen text.

Only describe what the frames and transcript show. If something is unclear, say so briefly in
editorNotes rather than guessing. Keep each sentence short and simple."""


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL)


def download(url: str, work: Path) -> Path:
    r = run(["yt-dlp", "--no-playlist", "--socket-timeout", "30", "-f", "bv*[height<=1080]+ba/b",
             "--merge-output-format", "mp4", "-o", str(work / "video.%(ext)s"), url])
    files = [p for p in work.glob("video.*") if p.suffix != ".part"]
    if r.returncode != 0 or not files:
        raise RuntimeError(f"Could not download the video: {r.stderr.strip()[-200:]}")
    return files[0]


def probe(video: Path) -> tuple[float, bool]:
    """Length in seconds and whether it has sound."""
    r = run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(video)])
    data = json.loads(r.stdout or "{}")
    total = float(data.get("format", {}).get("duration") or 0)
    return total, any(s.get("codec_type") == "audio" for s in data.get("streams", []))


def shots(video: Path, total: float) -> list[tuple[float, float]]:
    """(start, end) of each shot; cuts closer than MIN_SHOT to the previous one are dropped."""
    r = run(["ffmpeg", "-v", "info", "-i", str(video), "-an", "-vf",
             f"select='gt(scene,{CUT_THRESHOLD})',showinfo", "-f", "null", "-"])
    edges = [0.0]
    for c in sorted(float(t) for t in re.findall(r"pts_time:([0-9.]+)", r.stderr)):
        if c - edges[-1] >= MIN_SHOT and total - c >= MIN_SHOT:
            edges.append(c)
    edges.append(total)
    return list(zip(edges, edges[1:]))


def frames(video: Path, cuts: list[tuple[float, float]], work: Path) -> list[dict]:
    """One frame at the middle of each shot, evenly thinned to MAX_FRAMES. The first frame is
    always the opening (0.5 s), since the hook is what the breakdown cares about most."""
    idx = list(range(len(cuts)))
    if len(idx) > MAX_FRAMES - 1:
        idx = [idx[round(i * (len(idx) - 1) / (MAX_FRAMES - 2))] for i in range(MAX_FRAMES - 1)]
    times = [0.5] + [round((cuts[i][0] + cuts[i][1]) / 2, 2) for i in idx]
    out = []
    (work / "frames").mkdir(exist_ok=True)
    for n, t in enumerate(times):
        path = work / "frames" / f"{n:02d}.jpg"
        r = run(["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", str(video),
                 "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", str(path)])
        if r.returncode == 0 and path.exists():
            out.append({"t": t, "file": f"frames/{path.name}"})
    return out


def transcribe(video: Path, work: Path) -> list[dict]:
    """Speech as [{start, end, text}] in seconds; empty when there is no speech or no model."""
    if not (Path(WHISPER).is_file() and MODEL.is_file()):
        return []
    wav = work / "audio.wav"
    r = run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", str(wav)])
    if r.returncode != 0:
        return []
    run([WHISPER, "-m", str(MODEL), "-f", str(wav), "-l", "auto", "-oj", "-of", str(work / "speech")])
    wav.unlink(missing_ok=True)
    try:
        segments = json.loads((work / "speech.json").read_text(encoding="utf-8", errors="replace"))["transcription"]
    except (OSError, ValueError, KeyError):
        return []
    return [{"start": s["offsets"]["from"] / 1000, "end": s["offsets"]["to"] / 1000, "text": s["text"].strip()}
            for s in segments if s["text"].strip()]


def prepare(url: str, work: Path, step) -> dict:
    """Everything the AI step reads, saved as work/prepared.json."""
    step("Downloading the video", 0.1)
    video = download(url, work)
    total, has_audio = probe(video)
    step("Finding the shots", 0.3)
    cuts = shots(video, total)
    picked = frames(video, cuts, work)
    step("Reading the speech", 0.5)
    speech = transcribe(video, work) if has_audio else []
    video.unlink(missing_ok=True)  # frames and transcript are all we keep
    prepared = {
        "url": url,
        "lengthSec": round(total, 2),
        "shots": [{"start": round(a, 2), "end": round(b, 2)} for a, b in cuts],
        "frames": picked,
        "speech": speech,
    }
    (work / "prepared.json").write_text(json.dumps(prepared, indent=2, ensure_ascii=False), encoding="utf-8")
    return prepared


def breakdown(prepared: dict, work: Path) -> Breakdown:
    content = [{"type": "text", "text": f"Video length: {prepared['lengthSec']} seconds, "
                                        f"{len(prepared['shots'])} shots."}]
    for f in prepared["frames"]:
        data = base64.standard_b64encode((work / f["file"]).read_bytes()).decode()
        content.append({"type": "text", "text": f"Frame at {f['t']}s:"})
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}})
    speech = "\n".join(f"[{s['start']:.1f}-{s['end']:.1f}s] {s['text']}" for s in prepared["speech"])
    content.append({"type": "text", "text": f"Transcript:\n{speech or '(no speech)'}\n\n{PROMPT}"})

    response = anthropic.Anthropic().beta.messages.parse(
        model=AI_MODEL,
        max_tokens=AI_MAX_TOKENS,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        output_format=Breakdown,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[{"role": "user", "content": content}],
    )
    u = response.usage
    print(f"[analyze] {work.name} {response.model} in={u.input_tokens} out={u.output_tokens} "
          f"stop={response.stop_reason}", flush=True)
    (work / "usage.json").write_text(json.dumps({"model": response.model, "input": u.input_tokens,
                                                 "output": u.output_tokens}), encoding="utf-8")
    if response.stop_reason == "refusal":
        raise RuntimeError("The AI declined to analyse this video.")
    if response.stop_reason == "max_tokens" or response.parsed_output is None:
        raise RuntimeError(f"The AI answer was incomplete ({response.stop_reason}).")
    return response.parsed_output


class Jobs:
    """One worker thread runs jobs in order. State lives in memory; finished breakdowns are
    saved to jobs/<id>/breakdown.json, so they survive a restart."""

    def __init__(self):
        self._jobs: dict[str, AnalyzeJob] = {}
        self._q: queue.Queue = queue.Queue()
        self._lock = threading.Lock()
        threading.Thread(target=self._work, name="analyze-worker", daemon=True).start()

    def submit(self, url: str) -> str:
        job_id = hashlib.sha1(url.encode()).hexdigest()[:12]
        with self._lock:
            current = self.get(job_id)
            if current and current.status != "failed":
                return job_id
            self._jobs[job_id] = AnalyzeJob(job=job_id, status="queued", progress=0, step="Waiting to start")
        self._q.put((job_id, url))
        return job_id

    def get(self, job_id: str):
        if job_id in self._jobs:
            return self._jobs[job_id]
        saved = JOBS_DIR / job_id / "breakdown.json"
        if saved.exists():
            result = Breakdown.model_validate_json(saved.read_text(encoding="utf-8"))
            return AnalyzeJob(job=job_id, status="done", progress=1, step="Done", result=result)
        return None

    def _set(self, job_id: str, **fields) -> None:
        with self._lock:
            self._jobs[job_id] = self._jobs[job_id].model_copy(update=fields)

    def _work(self) -> None:
        while True:
            job_id, url = self._q.get()
            work = JOBS_DIR / job_id
            try:
                work.mkdir(parents=True, exist_ok=True)
                step = lambda text, progress: self._set(job_id, status="running", step=text, progress=progress)
                saved = work / "prepared.json"
                prepared = json.loads(saved.read_text(encoding="utf-8")) if saved.exists() else prepare(url, work, step)
                step("Explaining why it works", 0.7)
                result = breakdown(prepared, work)
                (work / "breakdown.json").write_text(result.model_dump_json(indent=2), encoding="utf-8")
                self._set(job_id, status="done", progress=1, step="Done", result=result)
            except Exception as e:
                print(f"[analyze] {job_id} failed: {e}", flush=True)
                self._set(job_id, status="failed", error=str(e))
                for leftover in work.glob("video.*"):
                    leftover.unlink(missing_ok=True)
