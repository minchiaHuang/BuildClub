import json
import shutil
import subprocess
import time
from types import SimpleNamespace

import pytest

import analyze
from models import Breakdown

URL = "https://www.tiktok.com/@a/video/1"
RESULT = Breakdown.model_validate({
    "shotList": [{"time": "0-2s", "shot": "close-up of tofu"}],
    "why": {"hook": "h", "first3s": "f", "length": "l", "format": "fo", "sound": "s"},
    "props": ["tofu"],
    "editorNotes": "cut fast",
    "lines": [{"time": "0-1s", "text": "look", "role": "hook"}],
})


def wait(jobs, job_id, timeout=5):
    end = time.time() + timeout
    while time.time() < end:
        job = jobs.get(job_id)
        if job.status in ("done", "failed"):
            return job
        time.sleep(0.02)
    raise AssertionError("job did not finish")


def fake_prepare(url, work, step):
    step("Downloading the video", 0.1)
    return {"url": url, "lengthSec": 2, "shots": [], "frames": [], "speech": []}


@pytest.mark.parametrize("url", ["", "https://youtube.com/watch?v=1", "http://www.tiktok.com/@a/video/1"])
def test_analyze_needs_a_tiktok_or_instagram_link(client, url):
    assert client.post("/api/analyze", json={"url": url}).status_code == 400


@pytest.mark.parametrize("url", ["https://www.youtube.com/shorts/abc123", "https://youtube.com/shorts/abc123"])
def test_analyze_takes_a_youtube_shorts_link(client, monkeypatch, url):
    import server
    queued = []
    monkeypatch.setattr(server.jobs, "submit", lambda u: queued.append(u) or "job1")  # no real download
    r = client.post("/api/analyze", json={"url": url})
    assert (r.status_code, queued) == (200, [url])


def test_unknown_job_is_404(client):
    assert client.get("/api/analyze/nope").status_code == 404


def test_job_finishes_and_survives_restart(monkeypatch):
    monkeypatch.setattr(analyze, "prepare", fake_prepare)
    monkeypatch.setattr(analyze, "breakdown", lambda prepared, work: RESULT)
    jobs = analyze.Jobs()
    job_id = jobs.submit(URL)
    job = wait(jobs, job_id)
    assert job.status == "done" and job.progress == 1 and job.result == RESULT
    assert jobs.submit(URL) == job_id  # same link reuses the job

    restarted = analyze.Jobs()
    assert restarted.get(job_id).result == RESULT


def test_failed_job_reports_the_error(monkeypatch):
    monkeypatch.setattr(analyze, "prepare", fake_prepare)

    def broken(prepared, work):
        raise RuntimeError("The AI declined to analyse this video.")

    monkeypatch.setattr(analyze, "breakdown", broken)
    jobs = analyze.Jobs()
    job = wait(jobs, jobs.submit(URL))
    assert job.status == "failed"
    assert job.error == "The AI declined to analyse this video."
    assert analyze.Jobs().get(job.job) is None  # nothing saved, so a retry starts again


def test_job_over_http(client, monkeypatch):
    import server
    monkeypatch.setattr(analyze, "prepare", fake_prepare)
    monkeypatch.setattr(analyze, "breakdown", lambda prepared, work: RESULT)
    monkeypatch.setattr(server, "jobs", analyze.Jobs())
    job_id = client.post("/api/analyze", json={"url": URL}).json()["job"]
    wait(server.jobs, job_id)
    body = client.get(f"/api/analyze/{job_id}").json()
    assert body["status"] == "done"
    assert body["result"]["props"] == ["tofu"]


class FakeAnthropic:
    """Stands in for anthropic.Anthropic(); records the request and returns a canned answer."""
    sent = {}
    stop_reason = "end_turn"

    def __init__(self):
        self.beta = SimpleNamespace(messages=SimpleNamespace(parse=self.parse))

    def parse(self, **kwargs):
        FakeAnthropic.sent = kwargs
        parsed = RESULT if self.stop_reason == "end_turn" else None
        return SimpleNamespace(model="claude-opus-5-5", stop_reason=self.stop_reason, parsed_output=parsed,
                               usage=SimpleNamespace(input_tokens=10, output_tokens=20))


@pytest.fixture
def prepared(tmp_path, monkeypatch):
    monkeypatch.setattr(analyze.anthropic, "Anthropic", FakeAnthropic)
    (tmp_path / "frames").mkdir()
    (tmp_path / "frames" / "00.jpg").write_bytes(b"jpg")
    return {"lengthSec": 2, "shots": [{"start": 0, "end": 2}], "frames": [{"t": 0.5, "file": "frames/00.jpg"}],
            "speech": [{"start": 0, "end": 1.5, "text": "hello"}]}


def test_breakdown_sends_frames_and_transcript(prepared, tmp_path, monkeypatch):
    monkeypatch.setattr(FakeAnthropic, "stop_reason", "end_turn")
    assert analyze.breakdown(prepared, tmp_path) == RESULT
    sent = FakeAnthropic.sent
    assert sent["model"] == analyze.AI_MODEL
    assert sent["max_tokens"] == analyze.AI_MAX_TOKENS
    assert sent["output_format"] is Breakdown
    assert sent["output_config"] == {"effort": "high"}
    content = sent["messages"][0]["content"]
    assert [c["type"] for c in content] == ["text", "text", "image", "text"]
    assert "[0.0-1.5s] hello" in content[-1]["text"]
    assert json.loads((tmp_path / "usage.json").read_text())["output"] == 20


@pytest.mark.parametrize("stop", ["refusal", "max_tokens"])
def test_breakdown_raises_when_the_answer_is_unusable(prepared, tmp_path, monkeypatch, stop):
    monkeypatch.setattr(FakeAnthropic, "stop_reason", stop)
    with pytest.raises(RuntimeError):
        analyze.breakdown(prepared, tmp_path)


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="needs ffmpeg")
def test_shots_and_frames_on_a_generated_video(tmp_path):
    video = tmp_path / "video.mp4"
    inputs = []
    for color in ("red", "blue", "green"):
        inputs += ["-f", "lavfi", "-i", f"color=c={color}:s=320x240:d=1:r=25"]
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", "concat=n=3:v=1:a=0",
                    "-pix_fmt", "yuv420p", str(video)], check=True)
    total, has_audio = analyze.probe(video)
    assert total == pytest.approx(3, abs=0.1) and not has_audio
    cuts = analyze.shots(video, total)
    assert [round(a) for a, _ in cuts] == [0, 1, 2]
    picked = analyze.frames(video, cuts, tmp_path)
    assert [f["t"] for f in picked] == [0.5, 0.5, 1.5, 2.5]
    assert all((tmp_path / f["file"]).stat().st_size > 0 for f in picked)
