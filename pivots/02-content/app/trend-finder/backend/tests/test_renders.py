"""The cut: music upload, starting a job, progress, restart handling, stale detection and serving the MP4."""

import threading
import time
from collections import namedtuple
from urllib.parse import quote

import pytest

import cutting
import renders
import server
from cutting import CutError
from test_auth import add_user
from test_takes import MP4, idea, store_ideas, up

from models import SavedIdea  # noqa: F401  (idea() builds one)

A = {"id": "a", "name": "Tofu Bar", "niche": "food", "audience": "students",
     "monthlyTarget": 8, "examples": [], "cannot": []}
MP3 = b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\x00" * 64
M4A = b"\x00\x00\x00\x18ftypM4A " + b"\x00" * 64
WAV = b"RIFF\x24\x00\x00\x00WAVEfmt " + b"\x00" * 32
FINAL = b"fake-cut-output" * 100


@pytest.fixture
def setup(client, monkeypatch):
    client.put("/api/clients", json=[A])
    store_ideas(idea("ia"), idea("ib"), idea("iw", "waiting"))
    monkeypatch.setattr(cutting, "missing_tools", lambda: None)
    monkeypatch.setattr(cutting, "probe", lambda path: {"duration": 10.0})


def usage(free):
    return namedtuple("usage", "total used free")(0, 0, free)


def wait_for(client, idea_id="ia", timeout=5):
    end = time.time() + timeout
    while time.time() < end:
        state = client.get(f"/api/ideas/{idea_id}/cut").json()
        if state["status"] in ("done", "failed"):
            return state
        time.sleep(0.02)
    raise AssertionError("cut did not finish")


def fake_render(takes, music, speed, work, out, step, **kw):
    step(0.2, "Joining the takes")
    out.write_bytes(FINAL)
    return {"size": len(FINAL), "durationSec": 12.5}


@pytest.fixture
def fake_pipeline(monkeypatch):
    calls = []

    def run(takes, music, speed, work, out, step, **kw):
        calls.append({"takes": takes, "music": music, "speed": speed, "out": out})
        return fake_render(takes, music, speed, work, out, step)

    monkeypatch.setattr(renders, "run_pipeline", run)
    return calls


@pytest.fixture
def slow_pipeline(monkeypatch):
    release, started = threading.Event(), threading.Event()

    def run(takes, music, speed, work, out, step, **kw):
        step(0.2, "Joining the takes")
        started.set()
        release.wait(5)
        return fake_render(takes, music, speed, work, out, step)

    monkeypatch.setattr(renders, "run_pipeline", run)
    yield started, release
    release.set()
    time.sleep(0.1)


def start(client, idea_id="ia", shots=1, speed=1.1):
    return client.post(f"/api/ideas/{idea_id}/cut", json={"shotCount": shots, "speed": speed})


def with_take(client, shot=0, idea_id="ia"):
    return up(client, idea=idea_id, shot=shot).json()


def put_music(client, body=MP3, ctype="audio/mpeg", licensed="yes", name="song.mp3", idea_id="ia"):
    headers = {"content-type": ctype, "x-filename": quote(name)}
    if licensed:
        headers["x-license-confirmed"] = licensed
    return client.put(f"/api/ideas/{idea_id}/cut/music", content=body, headers=headers)


def cut_dir(idea_id="ia"):
    return server.MEDIA_DIR / idea_id / "cut"


def test_no_cut_yet(client, setup):
    assert client.get("/api/ideas/ia/cut").json() == {
        "status": "none", "progress": 0, "step": "", "speed": 1.1, "stale": False, "music": None,
        "review": None}
    assert client.get("/api/ideas/nope/cut").status_code == 404


def test_cut_needs_a_chosen_take_for_every_shot(client, setup):
    with_take(client, shot=0)
    r = start(client, shots=2)
    assert r.status_code == 409 and r.json()["error"] == "Choose a take for shot 2 first."
    assert client.get("/api/ideas/ia/cut").json()["status"] == "none"


def test_not_approved_409(client, setup):
    r = start(client, "iw")
    assert r.status_code == 409 and r.json()["error"] == "Only an approved plan can be cut."


def test_bad_request_bodies_422(client, setup):
    with_take(client)
    r = start(client, speed=1.5)
    assert r.status_code == 422 and r.json()["error"] == "Choose a speed of 1x, 1.1x or 1.25x."
    for shots in (0, 51, "2", 1.5, None):
        assert client.post("/api/ideas/ia/cut", json={"shotCount": shots, "speed": 1.0}).status_code == 422


def test_missing_tools_503(client, setup, monkeypatch):
    with_take(client)
    queued = []
    monkeypatch.setattr(renders, "run_pipeline", lambda *a, **k: queued.append(1))
    for sentence in (cutting.NO_FFMPEG, cutting.NO_WHISPER):
        monkeypatch.setattr(cutting, "missing_tools", lambda s=sentence: s)
        r = start(client)
        assert r.status_code == 503 and r.json()["error"] == sentence
    assert client.get("/api/ideas/ia/cut").json()["status"] == "none"
    time.sleep(0.1)
    assert queued == []


def test_cut_runs_and_reports_progress(client, setup, fake_pipeline):
    t = with_take(client)
    r = start(client)
    assert r.status_code == 202 and r.json()["status"] == "queued" and r.json()["progress"] == 0
    state = wait_for(client)
    assert state["status"] == "done" and state["progress"] == 1 and state["step"] == "Done"
    assert state["output"]["url"].startswith("/api/ideas/ia/cut/file?v=")
    assert {k: v for k, v in state["output"].items() if k != "url"} == {"size": len(FINAL), "durationSec": 12.5}
    assert state["stale"] is False and state["speed"] == 1.1 and "error" not in state
    assert fake_pipeline[0]["takes"][0]["id"] == t["id"] and fake_pipeline[0]["music"] is None
    assert fake_pipeline[0]["out"] == cut_dir() / "work" / "next.mp4"
    f = client.get(state["output"]["url"])
    assert f.status_code == 200 and f.content == FINAL and f.headers["content-type"] == "video/mp4"
    assert "attachment" not in f.headers.get("content-disposition", "")
    ranged = client.get(state["output"]["url"], headers={"range": "bytes=0-9"})
    assert ranged.status_code == 206 and ranged.content == FINAL[:10]
    assert not (cut_dir() / "work").exists()


def test_progress_is_visible_while_running(client, setup, slow_pipeline):
    with_take(client)
    started, release = slow_pipeline
    start(client)
    assert started.wait(5)
    state = client.get("/api/ideas/ia/cut").json()
    assert state["status"] == "running" and state["step"] == "Joining the takes" and state["progress"] == 0.2
    assert "output" not in state
    release.set()
    assert wait_for(client)["status"] == "done"


def test_download_has_attachment_header(client, setup, fake_pipeline):
    with_take(client)
    start(client)
    wait_for(client)
    f = client.get("/api/ideas/ia/cut/file?download=1")
    assert f.status_code == 200
    assert f.headers["content-disposition"] == 'attachment; filename="remake-ia.mp4"'
    assert client.get("/api/ideas/ib/cut/file").status_code == 404


def test_failure_is_reported_and_work_dir_removed(client, setup, monkeypatch):
    with_take(client)

    def boom(takes, music, speed, work, out, step, **kw):
        work.mkdir(parents=True, exist_ok=True)
        (work / "joined.mkv").write_bytes(b"x")
        raise CutError("boom")

    monkeypatch.setattr(renders, "run_pipeline", boom)
    start(client)
    state = wait_for(client)
    assert state["status"] == "failed" and state["error"] == "boom" and "output" not in state
    assert not (cut_dir() / "work").exists()


def test_unexpected_error_gets_a_generic_sentence(client, setup, monkeypatch, capsys):
    with_take(client)

    def boom(*a, **k):
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(renders, "run_pipeline", boom)
    start(client)
    state = wait_for(client)
    assert state["error"] == "Something went wrong while making the cut."
    assert "secret internal detail" in capsys.readouterr().out


def test_one_active_cut_per_plan_409(client, setup, slow_pipeline):
    with_take(client)
    started, release = slow_pipeline
    assert start(client).status_code == 202
    assert started.wait(5)
    r = start(client)
    assert r.status_code == 409 and r.json()["error"] == "A cut is already being made for this plan."
    m = put_music(client)
    assert m.status_code == 409 and m.json()["error"] == "A cut is already being made for this plan."
    release.set()
    wait_for(client)


def test_rerun_replaces_old_output(client, setup, monkeypatch):
    with_take(client)
    outputs = iter([b"first-cut", b"second-cut-longer"])

    def run(takes, music, speed, work, out, step, **kw):
        data = next(outputs)
        out.write_bytes(data)
        return {"size": len(data), "durationSec": 3.0}

    monkeypatch.setattr(renders, "run_pipeline", run)
    start(client)
    assert wait_for(client)["output"]["size"] == len(b"first-cut")
    r = start(client, speed=1.25)
    assert r.json()["status"] == "queued" and r.json()["output"]["size"] == len(b"first-cut")
    state = wait_for(client)
    assert state["output"]["size"] == len(b"second-cut-longer") and state["speed"] == 1.25
    assert client.get("/api/ideas/ia/cut/file").content == b"second-cut-longer"
    assert not (cut_dir() / "work").exists()


def test_output_url_changes_after_every_successful_run(client, setup, fake_pipeline):
    with_take(client)
    start(client)
    first = wait_for(client)["output"]["url"]
    assert client.get("/api/ideas/ia/cut").json()["output"]["url"] == first  # stable between runs
    start(client)
    second = wait_for(client)["output"]["url"]
    assert second != first
    assert client.get(second).status_code == 200  # the file route ignores the version


def test_failed_rerun_keeps_old_output(client, setup, monkeypatch):
    with_take(client)
    mode = {"fail": False}

    def run(takes, music, speed, work, out, step, **kw):
        if mode["fail"]:
            raise CutError("second run broke")
        out.write_bytes(FINAL)
        return {"size": len(FINAL), "durationSec": 1.0}

    monkeypatch.setattr(renders, "run_pipeline", run)
    start(client)
    wait_for(client)
    mode["fail"] = True
    start(client)
    state = wait_for(client)
    assert state["status"] == "failed" and state["error"] == "second run broke"
    assert state["output"]["size"] == len(FINAL)
    assert client.get("/api/ideas/ia/cut/file").content == FINAL


def test_restart_marks_running_failed(client, setup):
    with_take(client)
    folder = cut_dir() / "work"
    folder.mkdir(parents=True)
    (folder / "joined.mkv").write_bytes(b"x")
    with server.db() as conn:
        conn.execute("INSERT INTO renders (idea_id, status, progress, step, speed, signature, started_at) "
                     "VALUES ('ia', 'running', 0.4, 'Rendering', 1.1, 's', 1)")
        conn.execute("INSERT INTO renders (idea_id, status, progress, step, speed, signature, started_at) "
                     "VALUES ('ib', 'queued', 0, 'Waiting', 1.1, 's', 1)")
    renders.recover(server.db)
    for i in ("ia", "ib"):
        state = client.get(f"/api/ideas/{i}/cut").json()
        assert state["status"] == "failed"
        assert state["error"] == "The server restarted while this was being made. Make it again."
    assert not folder.exists()


def test_lifespan_recovers_on_startup(client, setup):
    from fastapi.testclient import TestClient
    with server.db() as conn:
        conn.execute("INSERT INTO renders (idea_id, status, progress, step, speed, signature, started_at) "
                     "VALUES ('ia', 'running', 0.4, 'Rendering', 1.1, 's', 1)")
    with TestClient(server.app) as c:
        assert c.get("/api/ideas/ia/cut").json()["status"] == "failed"


def test_survives_restart_when_done(client, setup, fake_pipeline):
    from fastapi.testclient import TestClient
    with_take(client)
    start(client)
    first = wait_for(client)
    again = TestClient(server.app).get("/api/ideas/ia/cut").json()
    assert again["status"] == "done" and again["output"] == first["output"]


def test_stale_after_choosing_another_take(client, setup, fake_pipeline):
    with_take(client)
    start(client)
    assert wait_for(client)["stale"] is False
    other = with_take(client)
    assert client.get("/api/ideas/ia/cut").json()["stale"] is False  # an unchosen extra take changes nothing
    client.post(f"/api/ideas/ia/takes/{other['id']}/choose")
    assert client.get("/api/ideas/ia/cut").json()["stale"] is True


def test_stale_after_music_change_but_not_speed(client, setup, fake_pipeline):
    with_take(client)
    start(client, speed=1.25)
    assert wait_for(client)["stale"] is False
    put_music(client)
    assert client.get("/api/ideas/ia/cut").json()["stale"] is True


def test_stale_ignores_takes_beyond_the_shot_count(client, setup, fake_pipeline):
    with_take(client, shot=0)
    start(client, shots=1)
    wait_for(client)
    with_take(client, shot=3)
    assert client.get("/api/ideas/ia/cut").json()["stale"] is False
    assert client.get("/api/ideas/ia/cut?shots=1").json()["stale"] is False


def test_music_upload_rules(client, setup, monkeypatch):
    r = put_music(client, licensed=None)
    assert r.status_code == 422 and r.json()["error"] == "Confirm you own this music or have the license to use it."
    assert put_music(client, licensed="no").status_code == 422
    r = put_music(client, ctype="video/mp4")
    assert r.status_code == 415 and r.json()["error"] == "Upload an .mp3, .m4a or .wav audio file."
    assert put_music(client, body=b"not audio at all", ctype="audio/mpeg").status_code == 415
    assert put_music(client, body=MP3, ctype="audio/wav").status_code == 415
    assert not list(cut_dir().glob("*")) if cut_dir().exists() else True

    ok = put_music(client)
    assert ok.status_code == 200 and ok.json()["music"] == {"name": "song.mp3", "size": len(MP3)}
    with server.db() as conn:
        music_id, ext, licensed_at = conn.execute("SELECT id, ext, licensed_at FROM cut_music").fetchone()
    assert licensed_at > 0
    old = cut_dir() / f"music-{music_id}.{ext}"
    assert old.read_bytes() == MP3

    again = put_music(client, body=M4A, ctype="audio/mp4", name="new.m4a")
    assert again.json()["music"] == {"name": "new.m4a", "size": len(M4A)}
    assert not old.exists() and len(list(cut_dir().glob("music-*"))) == 1
    assert put_music(client, body=WAV, ctype="audio/x-wav", name="w.wav").status_code == 200
    mask = put_music(client, body=b"\xff\xfb\x90\x00" + b"\x00" * 20)
    assert mask.status_code == 200

    monkeypatch.setattr(renders, "MAX_MUSIC_BYTES", 10)
    big = put_music(client)
    assert big.status_code == 413 and big.json()["error"] == "The music file is over the 30 MB limit."
    assert client.get("/api/ideas/ia/cut").json()["music"] is not None  # a refused upload keeps the old file

    gone = client.delete("/api/ideas/ia/cut/music")
    assert gone.status_code == 200 and gone.json()["music"] is None
    assert not list(cut_dir().glob("music-*"))
    with server.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM cut_music").fetchone()[0] == 0
    assert not list(cut_dir().glob(".*"))


def test_music_is_passed_to_the_pipeline(client, setup, fake_pipeline):
    with_take(client)
    put_music(client)
    start(client)
    wait_for(client)
    assert fake_pipeline[0]["music"].name.startswith("music-") and fake_pipeline[0]["music"].read_bytes() == MP3


def test_music_needs_an_approved_plan(client, setup):
    assert put_music(client, idea_id="iw").status_code == 409
    assert client.delete("/api/ideas/iw/cut/music").status_code == 409
    assert put_music(client, idea_id="nope").status_code == 404


def test_total_input_over_10_minutes_409(client, setup, monkeypatch):
    with_take(client, shot=0)
    with_take(client, shot=1)
    monkeypatch.setattr(cutting, "probe", lambda path: {"duration": 301.0})
    r = start(client, shots=2)
    assert r.status_code == 409 and "10 minutes" in r.json()["error"]
    assert client.get("/api/ideas/ia/cut").json()["status"] == "none"


def test_not_enough_disk_409(client, setup, monkeypatch):
    with_take(client)
    free = 4 * len(MP4) - 1
    monkeypatch.setattr(renders.shutil, "disk_usage", lambda p: usage(free))
    r = start(client)
    assert r.status_code == 409 and r.json()["error"] == "There isn't enough free disk space to make the cut."
    monkeypatch.setattr(renders.shutil, "disk_usage", lambda p: usage(free + 1))
    monkeypatch.setattr(renders, "run_pipeline", fake_render)
    assert start(client).status_code == 202
    wait_for(client)


def test_cut_routes_need_sign_in(client, setup, fake_pipeline):
    with_take(client)
    start(client)
    wait_for(client)
    add_user()
    for r in (client.get("/api/ideas/ia/cut"), client.get("/api/ideas/ia/cut/file"), start(client),
              put_music(client), client.delete("/api/ideas/ia/cut/music")):
        assert r.status_code == 401


def test_review_link_shows_no_cut(client, setup, fake_pipeline):
    with_take(client)
    start(client)
    wait_for(client)
    store_ideas(idea("ia", "waiting"), idea("ib"))
    token = client.post("/api/share", json={"clientId": "a"}).json()["token"]
    body = client.get(f"/api/review/{token}").text
    assert "/cut/file" not in body and "remake-" not in body


def test_reopened_plan_keeps_output_read_only(client, setup, fake_pipeline):
    with_take(client)
    start(client)
    wait_for(client)
    store_ideas(idea("ia", "waiting"), idea("ib"))
    state = client.get("/api/ideas/ia/cut").json()
    assert state["status"] == "done" and state["output"]["size"] == len(FINAL)
    assert client.get(state["output"]["url"]).status_code == 200
    assert start(client).status_code == 409
    assert put_music(client).status_code == 409
    assert client.delete("/api/ideas/ia/cut/music").status_code == 409


def test_two_starts_cannot_both_pass(client, setup, slow_pipeline):
    with_take(client)
    started, release = slow_pipeline
    results = []
    threads = [threading.Thread(target=lambda: results.append(start(client).status_code)) for _ in range(4)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sorted(results) == [202, 409, 409, 409]
    release.set()
    wait_for(client)


def test_stale_when_the_number_of_picked_shots_changes(client, setup, fake_pipeline):
    with_take(client, shot=0)
    start(client, shots=1)
    assert wait_for(client)["stale"] is False
    with_take(client, shot=1)
    assert client.get("/api/ideas/ia/cut?shots=2").json()["stale"] is True  # the plan gained a shot
    assert client.get("/api/ideas/ia/cut?shots=1").json()["stale"] is False  # orphan takes don't count


# --- sending a finished cut for approval -------------------------------------------------------------------

def finished_cut(client):
    with_take(client)
    assert start(client).status_code == 202
    return wait_for(client)


def review_link(client):
    assert client.post("/api/share", json={"clientId": "a"}).status_code in (200, 201)


def send(client, idea_id="ia"):
    return client.post(f"/api/ideas/{idea_id}/cut/review")


def review_rows():
    with server.db() as conn:
        return conn.execute("SELECT idea_id, status FROM cut_reviews").fetchall()


def test_send_for_review_sets_waiting(client, setup, fake_pipeline):
    finished_cut(client)
    review_link(client)
    r = send(client)
    assert r.status_code == 200
    review = r.json()["review"]
    assert review["status"] == "waiting" and isinstance(review["sentAt"], int)
    assert client.get("/api/ideas/ia/cut").json()["review"] == review


def test_send_needs_a_cut_409(client, setup, fake_pipeline):
    review_link(client)
    r = send(client)
    assert r.status_code == 409 and r.json()["error"] == "Make the video first."


def test_send_stale_cut_409(client, setup, fake_pipeline):
    finished_cut(client)
    review_link(client)
    other = with_take(client)
    client.post(f"/api/ideas/ia/takes/{other['id']}/choose")
    r = send(client)
    assert r.status_code == 409
    assert r.json()["error"] == "The takes or music changed after this was made. Make it again before sending it."


def test_send_while_cutting_409(client, setup, slow_pipeline):
    started, _ = slow_pipeline
    review_link(client)
    with_take(client)
    start(client)
    assert started.wait(5)
    r = send(client)
    assert r.status_code == 409 and r.json()["error"] == "Wait for the cut to finish before sending it."


def test_send_needs_review_link_409(client, setup, fake_pipeline):
    finished_cut(client)
    r = send(client)
    assert r.status_code == 409
    assert r.json()["error"] == "This client's review link is turned off. Make a new one on the Shortlist first."


def test_send_not_approved_409(client, setup, fake_pipeline):
    review_link(client)
    r = send(client, "iw")
    assert r.status_code == 409 and r.json()["error"] == renders.NOT_APPROVED
    assert send(client, "nope").status_code == 404


def test_send_already_approved_409(client, setup, fake_pipeline):
    finished_cut(client)
    review_link(client)
    assert send(client).status_code == 200
    with server.db() as conn:
        conn.execute("UPDATE cut_reviews SET status = 'approved', decided_at = 1 WHERE idea_id = 'ia'")
    r = send(client)
    assert r.status_code == 409 and r.json()["error"] == "This video is already approved."


def test_recut_clears_review(client, setup, fake_pipeline):
    finished_cut(client)
    review_link(client)
    send(client)
    assert start(client).status_code == 202
    assert wait_for(client)["review"] is None
    assert review_rows() == []


def test_failed_recut_keeps_review(client, setup, fake_pipeline, monkeypatch):
    finished_cut(client)
    review_link(client)
    send(client)

    def boom(*a, **k):
        raise CutError("nope")

    monkeypatch.setattr(renders, "run_pipeline", boom)
    assert start(client).status_code == 202
    state = wait_for(client)
    assert state["status"] == "failed" and state["review"]["status"] == "waiting"


def test_review_survives_restart(client, setup, fake_pipeline):
    finished_cut(client)
    review_link(client)
    send(client)
    renders.recover(server.db)
    assert client.get("/api/ideas/ia/cut").json()["review"]["status"] == "waiting"
