import json

import analyze
import assist
import server

URL = "https://www.tiktok.com/@a/video/1"
VOCAB = ["A kitchen", "A blender"]


def save_breakdown(url, with_needs=False):
    work = analyze.JOBS_DIR / analyze.job_id_for(url)
    work.mkdir(parents=True)
    data = {
        "shotList": [{"time": "0-2s", "shot": "blend tofu"}],
        "why": {"hook": "h", "first3s": "f", "length": "l", "format": "fo", "sound": "s"},
        "props": ["blender"], "editorNotes": "cut fast", "lines": [],
    }
    if with_needs:
        data["needs"] = []
    (work / "breakdown.json").write_text(json.dumps(data))
    return work


def test_needs_backfill_is_cached(client, monkeypatch):
    work = save_breakdown(URL)
    calls = []

    def fake(model, system, content, max_tokens):
        calls.append(model)
        return 'Sure: ["A blender", "A drone"]'

    monkeypatch.setattr(assist, "call_claude", fake)
    for _ in range(2):
        r = client.post("/api/needs", json={"url": URL, "needs": VOCAB})
        assert (r.status_code, r.json()) == (200, {"needs": ["A blender"]})
    assert calls == ["claude-haiku-5-5"]
    assert json.loads((work / "breakdown.json").read_text())["needs"] == ["A blender"]


def test_needs_backfill_over_budget(client, monkeypatch):
    save_breakdown(URL)
    monkeypatch.setattr(server, "DAILY_CLAUDE_USD", 0)
    monkeypatch.setattr(assist, "call_claude", lambda *a, **k: (_ for _ in ()).throw(AssertionError("called")))
    assert client.post("/api/needs", json={"url": URL, "needs": VOCAB}).status_code == 429


def test_needs_backfill_without_a_breakdown_is_404(client):
    assert client.post("/api/needs", json={"url": URL, "needs": VOCAB}).status_code == 404


LIKE_ANSWER = 'Here: {"keywords": ["blended tofu", "crispy asmr", "x", "y"], "formatName": "Crispy ASMR"}'


def test_like_reuses_analyze_job(client, monkeypatch):
    save_breakdown(URL)
    calls = []
    monkeypatch.setattr(assist, "call_claude", lambda model, *a: calls.append(model) or LIKE_ANSWER)
    started = client.post("/api/like", json={"url": URL})
    assert (started.status_code, started.json()) == (200, {"job": analyze.job_id_for(URL)})
    r = client.get(f"/api/like/{started.json()['job']}")
    body = r.json()
    assert r.status_code == 200 and body["status"] == "done"
    assert body["keywords"] == ["blended tofu", "crispy asmr", "x"] and body["formatName"] == "Crispy ASMR"
    assert body["breakdown"]["props"] == ["blender"]
    assert calls == ["claude-haiku-5-5"]
    assert server.jobs._q.qsize() == 0  # no new breakdown was queued


def test_like_keywords_cached(client, monkeypatch):
    work = save_breakdown(URL)
    calls = []
    monkeypatch.setattr(assist, "call_claude", lambda *a: calls.append(1) or LIKE_ANSWER)
    job = analyze.job_id_for(URL)
    first = client.get(f"/api/like/{job}").json()
    second = client.get(f"/api/like/{job}").json()
    assert first == second and len(calls) == 1
    assert json.loads((work / "like.json").read_text())["formatName"] == "Crispy ASMR"


def test_like_bad_url_400(client):
    r = client.post("/api/like", json={"url": "https://example.com/video"})
    assert r.status_code == 400
