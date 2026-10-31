import pytest

A = {"id": "a", "name": "Tofu Bar", "niche": "food", "audience": "students",
     "monthlyTarget": 8, "examples": [], "cannot": []}
B = {**A, "id": "b", "name": "Plant Pal"}


def idea(id, client_id, status="waiting"):
    return {"id": id, "videoId": f"v-{id}", "clientId": client_id, "status": status,
            "dueDate": "2026-11-02", "notes": "", "sentAt": 1000}


@pytest.fixture
def setup(client):
    client.put("/api/clients", json=[A, B])
    client.put("/api/ideas", json=[idea("ia", "a"), idea("ib", "b")])


def note(at, text="nice", video="v-ia", author="Annie"):
    return {"videoId": video, "atSec": at, "text": text, "author": author}


def test_post_and_list_sorted_by_time(client, setup):
    first = client.post("/api/ideas/ia/comments", json=note(12.5))
    assert first.status_code == 200
    assert first.json()["ideaId"] == "ia" and first.json()["id"] and first.json()["createdAt"] > 0
    client.post("/api/ideas/ia/comments", json=note(3.0))
    got = client.get("/api/ideas/ia/comments").json()
    assert [c["atSec"] for c in got] == [3.0, 12.5]


def test_text_over_500_rejected(client, setup):
    assert client.post("/api/ideas/ia/comments", json=note(1, "x" * 500)).status_code == 200
    assert client.post("/api/ideas/ia/comments", json=note(1, "x" * 501)).status_code == 422
    assert client.post("/api/ideas/ia/comments", json=note(1, "")).status_code == 422
    assert client.post("/api/ideas/ia/comments", json=note(-1)).status_code == 422
    assert client.post("/api/ideas/ia/comments", json=note(1, author="")).status_code == 422


def test_200_per_idea_cap(client, setup):
    for i in range(200):
        assert client.post("/api/ideas/ia/comments", json=note(i)).status_code == 200
    assert client.post("/api/ideas/ia/comments", json=note(1)).status_code == 409
    # Another idea has its own allowance.
    assert client.post("/api/ideas/ib/comments", json=note(1, video="v-ib")).status_code == 200


def test_junk_video_id_rejected_on_both_routes(client, setup):
    token = client.post("/api/share", json={"clientId": "a"}).json()["token"]
    for n in range(3):
        assert client.post(f"/api/review/{token}/ideas/ia/comments", json=note(1, video=f"junk{n}")).status_code == 422
        assert client.post("/api/ideas/ia/comments", json=note(1, video=f"junk{n}")).status_code == 422
    assert client.get("/api/ideas/ia/comments").json() == []


def test_missing_idea_is_404(client, setup):
    assert client.post("/api/ideas/nope/comments", json=note(1, video="v-nope")).status_code == 404
    assert client.get("/api/ideas/nope/comments").json() == []


def test_at_sec_must_be_finite_and_bounded(client, setup):
    for raw in ("Infinity", "NaN", "86401", "1e30"):
        body = '{"videoId": "v-ia", "atSec": %s, "text": "x", "author": "A"}' % raw
        r = client.post("/api/ideas/ia/comments", content=body, headers={"content-type": "application/json"})
        assert r.status_code == 422, raw
    assert client.post("/api/ideas/ia/comments", json=note(86400)).status_code == 200


def test_source_is_set_by_the_server(client, setup):
    token = client.post("/api/share", json={"clientId": "a"}).json()["token"]
    spoof = {**note(1), "source": "staff"}
    assert client.post(f"/api/review/{token}/ideas/ia/comments", json=spoof).json()["source"] == "review"
    assert client.post("/api/ideas/ia/comments", json={**note(2), "source": "review"}).json()["source"] == "staff"
    got = client.get(f"/api/review/{token}/ideas/ia/comments").json()
    assert [c["source"] for c in got] == ["review", "staff"]


def test_share_link_can_comment_only_own_client(client, setup):
    token = client.post("/api/share", json={"clientId": "a"}).json()["token"]
    ok = client.post(f"/api/review/{token}/ideas/ia/comments", json=note(5))
    assert ok.status_code == 200
    assert client.get(f"/api/review/{token}/ideas/ia/comments").json()[0]["atSec"] == 5
    assert client.post(f"/api/review/{token}/ideas/ib/comments", json=note(5)).status_code == 404
    assert client.get(f"/api/review/{token}/ideas/ib/comments").status_code == 404
    assert client.get("/api/review/nope/ideas/ia/comments").status_code == 404


def test_revoked_link_cannot_comment_but_staff_still_sees(client, setup):
    token = client.post("/api/share", json={"clientId": "a"}).json()["token"]
    client.post(f"/api/review/{token}/ideas/ia/comments", json=note(5))
    client.delete(f"/api/share/{token}")
    assert client.post(f"/api/review/{token}/ideas/ia/comments", json=note(6)).status_code == 404
    assert client.get(f"/api/review/{token}/ideas/ia/comments").status_code == 404
    assert len(client.get("/api/ideas/ia/comments").json()) == 1


def test_no_edit_or_delete_routes(client, setup):
    client.post("/api/ideas/ia/comments", json=note(5))
    for path in ("/api/ideas/ia/comments",):
        assert client.put(path, json=note(1)).status_code == 405
        assert client.delete(path).status_code == 405
    token = client.post("/api/share", json={"clientId": "a"}).json()["token"]
    p = f"/api/review/{token}/ideas/ia/comments"
    assert client.put(p, json=note(1)).status_code == 405
    assert client.delete(p).status_code == 405
