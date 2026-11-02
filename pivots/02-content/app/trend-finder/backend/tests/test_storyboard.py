"""Per-shot script lines and storyboard frames: model back-compat, generate all / one, `edited`, fake and
mocked-real frame images, path traversal. No test reaches Claude or OpenAI."""

import base64
import json

import pytest

import server
import storyboard
from models import SavedIdea, Shot

A = {"id": "a", "name": "Tofu Bar", "niche": "food", "audience": "students",
     "monthlyTarget": 8, "examples": [], "cannot": ["no swearing"]}
SHOTS = [{"time": "0-3s", "shot": "Close-up of tofu sizzling"},
         {"time": "3-8s", "shot": "Pour the sauce", "text": "Sauce"},
         {"time": "8-12s", "shot": "Plate and smile to camera"}]


def put(*ideas):
    server.save("ideas", [SavedIdea(**i) for i in ideas])


def idea(id="i1", shots=SHOTS, status="saved"):
    return {"id": id, "videoId": "v", "clientId": "a", "status": status, "dueDate": "2026-11-02",
            "notes": "crispy", "shots": shots}


@pytest.fixture(autouse=True)
def demo_mode(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("FRAME_IMAGE_PROVIDER", raising=False)

    def no_claude(*a, **k):
        raise AssertionError("Claude called in demo mode")
    monkeypatch.setattr(storyboard.assist, "call_claude", no_claude)


@pytest.fixture
def setup(client):
    client.put("/api/clients", json=[A])
    put(idea(), idea("i2"))


# ---- data model -------------------------------------------------------------------------------

def test_old_shots_load_without_new_fields():
    s = Shot(**{"time": "0-3s", "shot": "x"})
    assert s.line is None and s.purpose is None and s.options is None and s.edited is None
    assert s.frameImage is None and s.palette is None


def test_old_saved_plans_still_load(client, setup):
    got = client.get("/api/ideas").json()
    assert got[0]["shots"][0] == {"time": "0-3s", "shot": "Close-up of tofu sizzling"}


def test_new_fields_round_trip_through_put(client, setup):
    shot = {**SHOTS[0], "line": "Hi", "purpose": "hook", "options": ["a", "b", "c"], "edited": True,
            "frameImage": "/api/ideas/i1/frames/0-abc.svg", "palette": ["#112233", "#AABBCC"]}
    r = client.put("/api/ideas", json=[idea(shots=[shot])])
    assert r.status_code == 200
    assert client.get("/api/ideas").json()[0]["shots"][0] == shot


@pytest.mark.parametrize("bad", [{"purpose": "intro"}, {"options": ["a", "b", "c", "d"]},
                                 {"palette": ["red"]}, {"palette": ["#12345"]},
                                 {"palette": ["#000000"] * 9}, {"frameImage": "javascript:alert(1)"}])
def test_shot_validation(bad):
    with pytest.raises(Exception):
        Shot(time="0", shot="x", **bad)


# ---- script ------------------------------------------------------------------------------------

def test_generate_script_demo_is_deterministic(client, setup):
    a = client.post("/api/ideas/i1/script", json={})
    b = client.post("/api/ideas/i1/script", json={})
    assert a.status_code == 200 and a.json() == b.json()
    body = a.json()
    assert body["source"] == "demo"
    shots = body["shots"]
    assert [s["purpose"] for s in shots] == ["hook", "body", "cta"]
    assert all(s["line"] and len(s["options"]) == 3 for s in shots)
    assert shots[0]["shot"] == SHOTS[0]["shot"]  # the plan's own text is untouched


def test_generate_script_does_not_write_the_store(client, setup):
    client.post("/api/ideas/i1/script", json={})
    assert "line" not in client.get("/api/ideas").json()[0]["shots"][0]


def test_generate_script_keeps_edited_shot_unless_forced(client, setup):
    shots = [dict(SHOTS[0]), {**SHOTS[1], "line": "MY WORDS", "edited": True, "purpose": "body"}, dict(SHOTS[2])]
    put(idea(shots=shots))
    kept = client.post("/api/ideas/i1/script", json={}).json()["shots"]
    assert kept[1]["line"] == "MY WORDS" and kept[1]["edited"] is True
    assert kept[0]["line"] and kept[2]["line"]
    forced = client.post("/api/ideas/i1/script", json={"force": True}).json()["shots"]
    assert forced[1]["line"] != "MY WORDS" and forced[1]["edited"] is False


def test_regenerate_one_shot_returns_only_that_shot(client, setup):
    r = client.post("/api/ideas/i1/shots/1/script", json={})
    assert r.status_code == 200
    body = r.json()
    assert body["index"] == 1 and body["purpose"] == "body" and body["line"] and len(body["options"]) == 3
    assert "shots" not in body
    assert client.get("/api/ideas").json()[0]["shots"] == SHOTS  # nothing touched


def test_regenerate_one_matches_the_full_script_for_that_shot(client, setup):
    full = client.post("/api/ideas/i1/script", json={}).json()["shots"]
    one = client.post("/api/ideas/i1/shots/2/script", json={}).json()
    assert one["line"] == full[2]["line"] and one["options"] == full[2]["options"]


def test_regenerate_one_refuses_an_edited_shot_unless_forced(client, setup):
    put(idea(shots=[{**SHOTS[0], "line": "mine", "edited": True}, SHOTS[1]]))
    assert client.post("/api/ideas/i1/shots/0/script", json={}).status_code == 409
    assert client.post("/api/ideas/i1/shots/0/script", json={"force": True}).status_code == 200


def test_script_errors(client, setup):
    assert client.post("/api/ideas/nope/script", json={}).status_code == 404
    assert client.post("/api/ideas/i1/shots/3/script", json={}).status_code == 404
    assert client.post("/api/ideas/i1/shots/-1/script", json={}).status_code == 404
    put(idea("i3", shots=None))
    assert client.post("/api/ideas/i3/script", json={}).status_code == 409


def test_claude_path_uses_assist_and_the_budget(client, setup, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    seen = []

    def fake(model, system, content, max_tokens):
        seen.append(content[0]["text"])
        return json.dumps({"shots": [{"line": f"L{n}", "options": [f"a{n}", f"b{n}", f"c{n}", "extra"]}
                                     for n in range(3)]})
    monkeypatch.setattr(storyboard.assist, "call_claude", fake)
    body = client.post("/api/ideas/i1/script", json={}).json()
    assert body["source"] == "claude"
    assert [s["line"] for s in body["shots"]] == ["L0", "L1", "L2"]
    assert body["shots"][0]["options"] == ["a0", "b0", "c0"]
    assert "Tofu Bar" in seen[0] and "no swearing" in seen[0]
    assert server.load(f"spend:{server.today()}")["claude"] > 0


def test_claude_garbage_is_a_502(client, setup, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    monkeypatch.setattr(storyboard.assist, "call_claude", lambda *a, **k: "sorry, no")
    assert client.post("/api/ideas/i1/script", json={}).status_code == 502


def test_claude_over_budget_is_429(client, setup, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    monkeypatch.setattr(server, "DAILY_CLAUDE_USD", 0)
    assert client.post("/api/ideas/i1/script", json={}).status_code == 429


# ---- frames ------------------------------------------------------------------------------------

def test_fake_frame_is_a_free_svg(client, setup):
    r = client.post("/api/ideas/i1/shots/0/frame", json={"line": "Look <at> this & that"})
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "fake" and body["frameImage"].startswith("/api/ideas/i1/frames/0-")
    f = client.get(body["frameImage"])
    assert f.status_code == 200 and f.headers["content-type"].startswith("image/svg+xml")
    assert "Look &lt;at&gt; this &amp; that" in f.text and "HOOK" in f.text
    assert (server.MEDIA_DIR / "i1" / "frames").is_dir()
    assert server.load(f"spend:{server.today()}") is None  # zero cost


def test_frame_uses_stored_line_and_does_not_touch_ideas(client, setup):
    put(idea(shots=[{**SHOTS[0], "line": "Stored line", "purpose": "cta"}]))
    body = client.post("/api/ideas/i1/shots/0/frame", json={}).json()
    text = client.get(body["frameImage"]).text
    assert "Stored line" in text and "CTA" in text
    assert "frameImage" not in client.get("/api/ideas").json()[0]["shots"][0]


def test_frame_errors(client, setup):
    assert client.post("/api/ideas/nope/shots/0/frame", json={}).status_code == 404
    assert client.post("/api/ideas/i1/shots/9/frame", json={}).status_code == 404


def test_frame_path_traversal_rejected(client, setup, tmp_path):
    (server.MEDIA_DIR).mkdir(parents=True, exist_ok=True)
    secret = server.MEDIA_DIR.parent / "secret.svg"
    secret.write_text("<svg/>")
    for bad in ("..", "%2e%2e", ".", "a%2f..%2f..", "..%5c"):
        # The HTTP client may fold ".." into the path before sending, so the app can answer 404 or 405.
        assert client.post(f"/api/ideas/{bad}/shots/0/frame", json={}).status_code in (404, 405)
        assert client.get(f"/api/ideas/{bad}/frames/secret.svg").status_code in (404, 405)
        assert not any(server.MEDIA_DIR.parent.glob("frames*"))
    for name in ("..%2fsecret.svg", "%2e%2e%2fsecret.svg", ".hidden.svg", "x.txt", "a%00.svg"):
        assert client.get(f"/api/ideas/i1/frames/{name}").status_code == 404
    assert storyboard.frames_dir(server.MEDIA_DIR, "..") is None
    assert storyboard.frames_dir(server.MEDIA_DIR, "i1") is not None


def test_real_provider_is_mocked_and_budgeted(client, setup, monkeypatch):
    monkeypatch.setenv("FRAME_IMAGE_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 20
    calls = []

    def fake_request(prompt, key):
        calls.append((prompt, key))
        return base64.b64encode(png).decode()
    monkeypatch.setattr(storyboard, "openai_image", fake_request)
    body = client.post("/api/ideas/i1/shots/1/frame", json={"line": "Pour it"}).json()
    assert body["provider"] == "openai" and body["frameImage"].endswith(".png")
    assert client.get(body["frameImage"]).content == png
    assert calls[0][1] == "sk-test" and "Pour the sauce" in calls[0][0] and "Pour it" in calls[0][0]
    assert server.load(f"spend:{server.today()}")["image"] == storyboard.IMAGE_USD


def test_real_provider_without_key_falls_back_to_fake(client, setup, monkeypatch):
    monkeypatch.setenv("FRAME_IMAGE_PROVIDER", "openai")

    def boom(*a):
        raise AssertionError("OpenAI called without a key")
    monkeypatch.setattr(storyboard, "openai_image", boom)
    assert client.post("/api/ideas/i1/shots/0/frame", json={}).json()["provider"] == "fake"


def test_real_provider_failure_is_502_and_bad_png_rejected(client, setup, monkeypatch):
    monkeypatch.setenv("FRAME_IMAGE_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    def fail(prompt, key):
        raise OSError("down")
    monkeypatch.setattr(storyboard, "openai_image", fail)
    assert client.post("/api/ideas/i1/shots/0/frame", json={}).status_code == 502
    monkeypatch.setattr(storyboard, "openai_image", lambda p, k: base64.b64encode(b"not a png").decode())
    assert client.post("/api/ideas/i1/shots/0/frame", json={}).status_code == 502


def test_real_provider_over_budget_is_429(client, setup, monkeypatch):
    monkeypatch.setenv("FRAME_IMAGE_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(server, "DAILY_IMAGE_USD", 0)
    monkeypatch.setattr(storyboard, "openai_image", lambda p, k: pytest.fail("called"))
    assert client.post("/api/ideas/i1/shots/0/frame", json={}).status_code == 429


def test_openai_request_shape(monkeypatch):
    sent = {}

    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self): return json.dumps({"data": [{"b64_json": "QUJD"}]}).encode()

    def fake_open(req, timeout=0):
        sent["url"], sent["auth"] = req.full_url, req.get_header("Authorization")
        sent["body"] = json.loads(req.data)
        return Resp()
    monkeypatch.setattr(storyboard.urllib.request, "urlopen", fake_open)
    assert storyboard.openai_image("draw", "sk-x") == "QUJD"
    assert sent["url"] == "https://api.openai.com/v1/images/generations" and sent["auth"] == "Bearer sk-x"
    assert sent["body"]["model"] == "gpt-image-1" and sent["body"]["quality"] == "low" and sent["body"]["n"] == 1
