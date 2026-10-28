import base64
import json

import pytest

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


IMG = base64.b64encode(b"\x89PNG fake screenshot bytes").decode()
IMG_ANSWER = 'JSON: {"keywords": ["latte art", "cafe asmr"], "formatName": "Cafe ASMR", "description": "A barista pours latte art."}'


def test_like_image_cached_by_hash(client, monkeypatch):
    calls = []

    def fake(model, system, content, max_tokens):
        calls.append((model, content))
        return IMG_ANSWER

    monkeypatch.setattr(assist, "call_claude", fake)
    body = {"image": IMG, "mediaType": "image/png"}
    first = client.post("/api/like-image", json=body)
    second = client.post("/api/like-image", json=body)
    assert first.status_code == 200 and second.json() == first.json()
    assert first.json() == {"keywords": ["latte art", "cafe asmr"], "formatName": "Cafe ASMR",
                            "description": "A barista pours latte art."}
    assert len(calls) == 1 and calls[0][0] == "claude-haiku-5-5"
    image_block = calls[0][1][0]
    assert image_block == {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": IMG}}
    assert server.load(f"spend:{server.today()}")["claude"] == server.IMAGE_USD  # the second upload was free


def test_like_image_too_big_413(client, monkeypatch):
    monkeypatch.setattr(assist, "call_claude", lambda *a: pytest.fail("Claude must not be called"))
    big = base64.b64encode(b"x" * (5 * 1024 * 1024 + 1)).decode()
    r = client.post("/api/like-image", json={"image": big, "mediaType": "image/jpeg"})
    assert r.status_code == 413
    just_fits = base64.b64encode(b"x" * (5 * 1024 * 1024)).decode()
    monkeypatch.setattr(assist, "call_claude", lambda *a: IMG_ANSWER)
    assert client.post("/api/like-image", json={"image": just_fits, "mediaType": "image/jpeg"}).status_code == 200


def test_like_image_bad_type_422(client, monkeypatch):
    monkeypatch.setattr(assist, "call_claude", lambda *a: pytest.fail("Claude must not be called"))
    assert client.post("/api/like-image", json={"image": IMG, "mediaType": "image/gif"}).status_code == 422
    assert client.post("/api/like-image", json={"image": "!!not base64!!", "mediaType": "image/png"}).status_code == 400


def test_like_image_prompt_forbids_writing_scripts(client, monkeypatch):
    systems = []
    monkeypatch.setattr(assist, "call_claude", lambda model, system, *a: systems.append(system) or IMG_ANSWER)
    client.post("/api/like-image", json={"image": IMG, "mediaType": "image/webp"})
    assert "Do not write a script" in systems[0]


ANSWER_TEXT = 'Here: {"lines": ["Most of these use a split screen.", "The hooks open on a question."]}'


def answer_body(n=2):
    vids = [{"id": f"v{i}", "platform": "tiktok", "hook": "Is this chicken?", "views": 1000 * (i + 1),
             "outlier": 12.5, "hashtags": ["food"], "music": "original sound"} for i in range(n)]
    return {"query": "why do food reactions work", "videos": vids}


def test_answer_cached(client, monkeypatch):
    calls = []
    monkeypatch.setattr(assist, "call_claude", lambda *a: calls.append(a) or ANSWER_TEXT)
    first = client.post("/api/answer", json=answer_body())
    second = client.post("/api/answer", json=answer_body())
    assert first.status_code == 200 and second.json() == first.json()
    assert first.json()["lines"] == ["Most of these use a split screen.", "The hooks open on a question."]
    assert first.json()["basis"] == "Written from the 2 real videos below"
    assert len(calls) == 1 and calls[0][0] == "claude-haiku-5-5"
    assert server.load(f"spend:{server.today()}")["claude"] == server.ASK_USD
    assert client.post("/api/answer", json=answer_body(31)).status_code == 422


def test_answer_over_budget_429(client, monkeypatch):
    monkeypatch.setattr(assist, "call_claude", lambda *a: pytest.fail("Claude must not be called"))
    monkeypatch.setattr(server, "DAILY_CLAUDE_USD", 0.001)
    assert client.post("/api/answer", json=answer_body()).status_code == 429


def test_answer_prompt_is_explain_only(client, monkeypatch):
    systems = []
    monkeypatch.setattr(assist, "call_claude", lambda model, system, *a: systems.append(system) or ANSWER_TEXT)
    client.post("/api/answer", json=answer_body())
    assert "Explain patterns in these real videos. Do not write scripts or captions." in systems[0]
