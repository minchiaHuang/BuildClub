"""The approver's side of a finished cut: list, play and decide through the review link, no login."""

import os

import pytest

import renders
import server
from test_auth import add_user, login
from test_renders import A, fake_pipeline, finished_cut, review_link, send, setup, start, wait_for, with_take  # noqa: F401
from test_takes import idea, store_ideas

B = {**A, "id": "b", "name": "Plant Pal"}


def token_of(client, client_id="a"):
    return client.post("/api/share", json={"clientId": client_id}).json()["token"]


@pytest.fixture
def sent(client, setup, fake_pipeline):
    """A finished, sent cut for plan ia; returns its review token."""
    finished_cut(client)
    token = token_of(client)
    assert send(client).status_code == 200
    return token


def version_of(client, token="") -> str:
    return client.get(f"/api/review/{token}").json()["cuts"][0]["cut"]["version"]


def decide(client, token, decision="approved", version=None, idea_id="ia", **extra):
    version = version if version is not None else version_of(client, token)
    return client.post(f"/api/review/{token}/cuts/{idea_id}/decide",
                       json={"decision": decision, "version": version, **extra})


def row():
    with server.db() as conn:
        return conn.execute("SELECT status, decided_at, reason FROM cut_reviews WHERE idea_id = 'ia'").fetchone()


def test_review_lists_waiting_cut(client, sent):
    body = client.get(f"/api/review/{sent}").json()
    assert len(body["cuts"]) == 1
    item = body["cuts"][0]
    assert item["idea"]["id"] == "ia" and "notes" not in item["idea"]
    cut = item["cut"]
    assert cut["url"] == f"/api/review/{sent}/cuts/ia/file?v={cut['version']}"
    assert isinstance(cut["version"], str) and cut["version"].isdigit()
    assert cut["durationSec"] == 12.5 and isinstance(cut["sentAt"], int)


def test_review_lists_no_unsent_cut(client, setup, fake_pipeline):
    finished_cut(client)
    assert client.get(f"/api/review/{token_of(client)}").json()["cuts"] == []


def test_cut_file_plays_inline(client, sent):
    url = client.get(f"/api/review/{sent}").json()["cuts"][0]["cut"]["url"]
    r = client.get(url)
    assert r.status_code == 200 and r.headers["content-type"] == "video/mp4"
    assert "attachment" not in r.headers.get("content-disposition", "")
    assert r.content == renders_final()
    ranged = client.get(url, headers={"Range": "bytes=0-9"})
    assert ranged.status_code == 206 and len(ranged.content) == 10


def renders_final():
    return (server.MEDIA_DIR / "ia" / "cut" / "final.mp4").read_bytes()


def test_cut_file_ignores_download_param(client, sent):
    r = client.get(f"/api/review/{sent}/cuts/ia/file?download=1")
    assert r.status_code == 200 and "content-disposition" not in r.headers


@pytest.fixture
def other_client(client, sent):
    """Client b has its own sent cut for plan ib; `sent` (client a's token) must not reach it."""
    client.put("/api/clients", json=[A, B])
    store_ideas(idea("ia"), idea("ib"), idea("iw", "waiting"))
    server.save("ideas", [idea("ia"), idea("ib").model_copy(update={"clientId": "b"})])
    with_take(client, idea_id="ib")
    assert start(client, "ib").status_code == 202
    wait_for(client, "ib")
    token_of(client, "b")
    assert send(client, "ib").status_code == 200


def test_cut_file_other_client_404(client, other_client, sent):
    r = client.get(f"/api/review/{sent}/cuts/ib/file")
    assert r.status_code == 404 and r.json()["code"] == "not_waiting"


def test_cut_decide_other_client_404(client, other_client, sent):
    r = decide(client, sent, idea_id="ib", version="1")
    assert r.status_code == 404 and r.json()["code"] == "not_waiting"
    with server.db() as conn:
        assert conn.execute("SELECT status FROM cut_reviews WHERE idea_id = 'ib'").fetchone() == ("waiting",)


def test_reopened_plan_hides_cut(client, sent):
    version = version_of(client, sent)
    server.save("ideas", [idea("ia", "waiting")])
    assert client.get(f"/api/review/{sent}").json()["cuts"] == []
    assert client.get(f"/api/review/{sent}/cuts/ia/file").status_code == 404
    r = decide(client, sent, version=version)
    assert r.status_code == 404 and r.json()["code"] == "not_waiting"
    assert row()[0] == "waiting"


def test_cut_file_traversal_404(client, sent):
    # An approved plan whose id climbs out of the media folder, with a review row and a file waiting there.
    (server.MEDIA_DIR.parent / "cut").mkdir(exist_ok=True)
    (server.MEDIA_DIR.parent / "cut" / "final.mp4").write_bytes(b"outside")
    version = (server.MEDIA_DIR.parent / "cut" / "final.mp4").stat().st_mtime_ns
    server.save("ideas", [idea("ia"), idea("..")])
    with server.db() as conn:
        conn.execute("INSERT INTO cut_reviews (idea_id, version, status, sent_at) VALUES ('..', ?, 'waiting', 1)", (version,))
    assert [c["idea"]["id"] for c in client.get(f"/api/review/{sent}").json()["cuts"]] == ["ia"]
    r = client.get(f"/api/review/{sent}/cuts/%2E%2E/file")
    assert r.status_code == 404 and r.json().get("code") == "not_waiting"
    r = decide(client, sent, idea_id="%2E%2E", version=str(version))
    assert r.status_code == 404 and r.json()["code"] == "not_waiting"
    with server.db() as conn:
        assert conn.execute("SELECT status FROM cut_reviews WHERE idea_id = '..'").fetchone() == ("waiting",)


def test_revoked_link_404_link_closed(client, sent):
    version = version_of(client, sent)
    client.delete(f"/api/share/{sent}")
    for r in (client.get(f"/api/review/{sent}/cuts/ia/file"), decide(client, sent, version=version)):
        assert r.status_code == 404 and r.json()["code"] == "link_closed"
    assert row()[0] == "waiting"


def test_approve_cut(client, sent):
    r = decide(client, sent)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "approved" and isinstance(body["decidedAt"], int) and "reason" not in body
    review = client.get("/api/ideas/ia/cut").json()["review"]
    assert review["status"] == "approved" and review["decidedAt"] == body["decidedAt"]
    assert client.get(f"/api/review/{sent}").json()["cuts"] == []


def test_send_back_needs_reason_422(client, sent):
    for extra in ({}, {"reason": ""}, {"reason": "   "}):
        r = decide(client, sent, "rejected", **extra)
        assert r.status_code == 422 and r.json()["error"] == renders.NEED_REASON
    assert row()[0] == "waiting"


def test_send_back_keeps_reason(client, sent):
    r = decide(client, sent, "rejected", reason="  Cut the intro  ")
    assert r.status_code == 200 and r.json()["status"] == "rejected" and r.json()["reason"] == "Cut the intro"
    review = client.get("/api/ideas/ia/cut").json()["review"]
    assert review["status"] == "rejected" and review["reason"] == "Cut the intro"
    assert client.get(f"/api/review/{sent}").json()["cuts"] == []


def test_decide_with_old_version_409(client, sent):
    for old in ("1", str(int(version_of(client, sent)) + 1)):  # numeric-looking but different
        r = decide(client, sent, version=old)
        assert r.status_code == 409 and r.json() == {"error": renders.REPLACED, "code": "replaced"}
    assert row()[0] == "waiting"


def test_decide_version_must_be_a_string(client, sent):
    r = client.post(f"/api/review/{sent}/cuts/ia/decide", json={"decision": "approved", "version": 5})
    assert r.status_code == 422
    assert row()[0] == "waiting"


def test_replaced_file_hides_cut(client, sent):
    path = server.MEDIA_DIR / "ia" / "cut" / "final.mp4"
    stat = path.stat()
    os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1_000_000))  # a different final.mp4 than was sent
    assert client.get(f"/api/review/{sent}").json()["cuts"] == []
    assert client.get(f"/api/review/{sent}/cuts/ia/file").status_code == 404


def test_second_decision_404_not_waiting(client, sent):
    version = version_of(client, sent)
    assert decide(client, sent, version=version).status_code == 200
    r = decide(client, sent, "rejected", version=version, reason="late")
    assert r.status_code == 404 and r.json()["code"] == "not_waiting"
    assert row()[0] == "approved"


def test_signed_in_cut_file_still_needs_login(client, sent):
    add_user()
    assert client.get("/api/ideas/ia/cut/file").status_code == 401
    assert client.get(f"/api/review/{sent}/cuts/ia/file").status_code == 200  # the approver needs no account
    assert login(client).status_code == 200
    assert client.get("/api/ideas/ia/cut/file").status_code == 200


def test_reapproved_plan_hides_cut_when_takes_changed(client, sent):
    server.save("ideas", [idea("ia", "waiting")])
    assert client.get(f"/api/review/{sent}").json()["cuts"] == []
    assert row()[0] == "waiting"  # the row stays; only the view is hidden
    server.save("ideas", [idea("ia")])
    other = with_take(client)
    client.post(f"/api/ideas/ia/takes/{other['id']}/choose")
    assert client.get(f"/api/review/{sent}").json()["cuts"] == []
    assert client.get(f"/api/review/{sent}/cuts/ia/file").status_code == 404


def test_reapproved_plan_lists_cut_again_when_nothing_changed(client, sent):
    # Intended: same video, same takes, so the approver sees the waiting card again without a resend.
    server.save("ideas", [idea("ia", "waiting")])
    server.save("ideas", [idea("ia")])
    assert len(client.get(f"/api/review/{sent}").json()["cuts"]) == 1
