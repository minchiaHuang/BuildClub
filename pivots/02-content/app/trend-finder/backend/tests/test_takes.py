"""Real-footage takes per shot of an approved plan: upload, list, fetch, choose and delete."""

from urllib.parse import quote

import pytest

import server
import takes
from models import SavedIdea
from test_auth import add_user

A = {"id": "a", "name": "Tofu Bar", "niche": "food", "audience": "students",
     "monthlyTarget": 8, "examples": [], "cannot": []}
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64


def idea(id, status="approved"):
    return SavedIdea(id=id, videoId=f"v-{id}", clientId="a", status=status, dueDate="2026-11-02", notes="")


def store_ideas(*ideas):
    # PUT /api/ideas guards decisions, so the tests write the store directly (as test_share_link does).
    server.save("ideas", list(ideas))


@pytest.fixture
def setup(client):
    client.put("/api/clients", json=[A])
    store_ideas(idea("ia"), idea("ib"), idea("iw", "waiting"))


def up(client, idea="ia", shot=0, body=MP4, ctype="video/mp4", name="IMG_0001.MOV"):
    return client.post(f"/api/ideas/{idea}/shots/{shot}/takes", content=body,
                       headers={"content-type": ctype, "x-filename": quote(name)})


def media_files():
    return [p for p in server.MEDIA_DIR.rglob("*") if p.is_file()] if server.MEDIA_DIR.exists() else []


def test_upload_then_list_and_fetch(client, setup):
    t = up(client).json()
    assert t["shot"] == 0 and t["chosen"] is True and t["size"] == len(MP4) and t["name"] == "IMG_0001.MOV"
    assert t["url"] == f"/api/ideas/ia/takes/{t['id']}/file"
    assert client.get("/api/ideas/ia/takes").json() == [t]
    f = client.get(t["url"])
    assert f.status_code == 200 and f.content == MP4 and f.headers["content-type"] == "video/mp4"


def test_second_take_is_not_chosen(client, setup):
    up(client)
    assert up(client).json()["chosen"] is False


def test_list_sorted_by_shot_then_time(client, setup):
    b = up(client, shot=2).json()
    a = up(client, shot=0).json()
    assert [t["id"] for t in client.get("/api/ideas/ia/takes").json()] == [a["id"], b["id"]]


def test_survives_restart(client, setup):
    t = up(client).json()
    from fastapi.testclient import TestClient
    assert TestClient(server.app).get("/api/ideas/ia/takes").json() == [t]


def test_wrong_content_type_415(client, setup):
    r = up(client, ctype="text/plain")
    assert r.status_code == 415 and r.json()["error"] == "Upload an .mp4 or .mov video file."


def test_wrong_magic_bytes_415(client, setup):
    r = up(client, body=b"hello world, not a video at all")
    assert r.status_code == 415 and r.json()["error"] == "Upload an .mp4 or .mov video file."
    assert client.get("/api/ideas/ia/takes").json() == []
    assert media_files() == []


def test_empty_body_415(client, setup):
    assert up(client, body=b"").status_code == 415
    assert media_files() == []


def test_declared_over_cap_413(client, setup, monkeypatch):
    monkeypatch.setattr(takes, "MAX_TAKE_BYTES", 100)
    r = up(client, body=MP4 + b"\x00" * 200)
    assert r.status_code == 413 and r.json()["error"] == "The file is over the 200 MB limit."
    assert media_files() == []


def test_over_cap_mid_stream_leaves_nothing(client, setup, monkeypatch):
    monkeypatch.setattr(takes, "MAX_TAKE_BYTES", 100)

    def chunks():  # generator body: no Content-Length, so only the streaming cap can catch it
        yield MP4
        yield b"\x00" * 200

    assert up(client, body=chunks()).status_code == 413
    assert client.get("/api/ideas/ia/takes").json() == []
    assert media_files() == []


def test_not_approved_409(client, setup):
    r = up(client, idea="iw")
    assert r.status_code == 409 and r.json()["error"] == "Only an approved plan can take footage."


def test_unknown_plan_404(client, setup):
    r = up(client, idea="nope")
    assert r.status_code == 404 and r.json()["error"] == "That plan doesn't exist."
    assert client.get("/api/ideas/nope/takes").status_code == 404


def test_unknown_take_file_404(client, setup):
    r = client.get("/api/ideas/ia/takes/nope/file")
    assert r.status_code == 404 and r.json()["error"] == "That take doesn't exist."


def test_shot_out_of_range_422(client, setup):
    for shot in (50, -1):
        r = up(client, shot=shot)
        assert r.status_code == 422 and r.json()["error"] == "The shot number must be between 1 and 50."


def test_take_cap_per_shot_409(client, setup, monkeypatch):
    monkeypatch.setattr(takes, "MAX_TAKES_PER_SHOT", 2)
    up(client)
    up(client)
    r = up(client)
    assert r.status_code == 409 and r.json()["error"] == "This shot has the most takes it can hold (2)."
    assert up(client, shot=1).status_code == 200
    assert len(media_files()) == 3


def test_filename_never_reaches_disk(client, setup):
    up(client, name="../../evil.sh")
    assert all(p.parent == server.MEDIA_DIR / "ia" and "evil" not in p.name for p in media_files())


def test_takes_need_sign_in(client, setup):
    t = up(client).json()
    add_user()  # from now on every non-public /api path needs a session
    assert up(client).status_code == 401
    assert client.get("/api/ideas/ia/takes").status_code == 401
    assert client.get(t["url"]).status_code == 401


def test_review_link_shows_no_takes(client, setup):
    t = up(client).json()
    store_ideas(idea("ia", "waiting"), idea("ib"))
    token = client.post("/api/share", json={"clientId": "a"}).json()["token"]
    for path in (f"/api/review/{token}", f"/api/review/{token}/ideas/ia/takes"):
        assert t["id"] not in client.get(path).text


def test_choose_moves_the_pick(client, setup):
    up(client)
    b = up(client).json()
    got = client.post(f"/api/ideas/ia/takes/{b['id']}/choose").json()
    assert [t["chosen"] for t in got] == [False, True]


def test_choose_is_per_shot(client, setup):
    a = up(client, shot=0).json()
    b = up(client, shot=1).json()
    c = up(client, shot=1).json()
    got = {t["id"]: t["chosen"] for t in client.post(f"/api/ideas/ia/takes/{c['id']}/choose").json()}
    assert got == {a["id"]: True, b["id"]: False, c["id"]: True}


def test_delete_removes_file_and_unchooses(client, setup):
    a = up(client).json()
    up(client)
    got = client.delete(f"/api/ideas/ia/takes/{a['id']}").json()
    assert len(got) == 1 and got[0]["chosen"] is False
    assert client.get(a["url"]).status_code == 404
    assert len(media_files()) == 1


def test_take_of_other_plan_404(client, setup):
    other = up(client, idea="ib").json()
    for r in (client.post(f"/api/ideas/ia/takes/{other['id']}/choose"),
              client.delete(f"/api/ideas/ia/takes/{other['id']}")):
        assert r.status_code == 404 and r.json()["error"] == "That take doesn't exist."
    assert client.get("/api/ideas/ib/takes").json() == [other]


def test_reopened_plan_keeps_takes_read_only(client, setup):
    t = up(client).json()
    store_ideas(idea("ia", "waiting"), idea("ib"))
    assert client.get("/api/ideas/ia/takes").json() == [t]
    assert client.get(t["url"]).status_code == 200
    assert up(client).status_code == 409
    for r in (client.post(f"/api/ideas/ia/takes/{t['id']}/choose"), client.delete(f"/api/ideas/ia/takes/{t['id']}")):
        assert r.status_code == 409 and r.json()["error"] == "Only an approved plan can take footage."
    assert client.get("/api/ideas/ia/takes").json() == [t]
