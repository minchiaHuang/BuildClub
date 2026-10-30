import pytest

A = {"id": "a", "name": "Tofu Bar", "niche": "food", "audience": "students",
     "monthlyTarget": 8, "examples": [], "cannot": []}
B = {**A, "id": "b", "name": "Plant Pal"}


def idea(id, client_id, status="waiting", **extra):
    return {"id": id, "videoId": f"v-{id}", "clientId": client_id, "status": status,
            "dueDate": "2026-11-02", "notes": "", "sentAt": 1000, **extra}


LIBRARY = {"videos": [{"id": "v-ia", "hook": "hook A", "formatId": "f-a"}],
           "formats": [{"id": "f-a", "name": "Format A", "shotList": []}]}


@pytest.fixture
def two_clients(client):
    client.put("/api/clients", json=[A, B])
    client.put("/api/ideas", json=[idea("ia", "a"), idea("ib", "b"), idea("ia-saved", "a", "saved")])
    client.put("/api/library", json=LIBRARY)


def link(client, client_id="a"):
    body = client.post("/api/share", json={"clientId": client_id}).json()
    return body["token"], body


def test_token_scoped_to_one_client(client, two_clients):
    token, _ = link(client, "a")
    assert len(token) >= 22  # 128 bits or more, URL-safe
    body = client.get(f"/api/review/{token}").json()
    assert body["client"] == {"name": "Tofu Bar"}
    assert [i["idea"]["id"] for i in body["ideas"]] == ["ia"]
    assert body["ideas"][0]["video"]["hook"] == "hook A"
    assert body["ideas"][0]["format"]["name"] == "Format A"


def test_idea_without_library_entry_still_returned(client, two_clients):
    token, _ = link(client, "b")
    body = client.get(f"/api/review/{token}").json()
    assert [i["idea"]["id"] for i in body["ideas"]] == ["ib"]
    assert body["ideas"][0]["idea"]["id"] == "ib"
    assert not body["ideas"][0].get("video")


def test_decide_updates_idea(client, two_clients):
    token, _ = link(client, "a")
    r = client.post(f"/api/review/{token}/decide", json={"ideaId": "ia", "decision": "approved"})
    assert r.status_code == 200
    saved = {i["id"]: i for i in client.get("/api/ideas").json()}
    assert saved["ia"]["status"] == "approved"
    assert saved["ia"]["decidedAt"] > 0
    assert saved["ib"]["status"] == "waiting"
    assert client.get(f"/api/review/{token}").json()["ideas"] == []


def test_reject_keeps_reason(client, two_clients):
    token, _ = link(client, "a")
    r = client.post(f"/api/review/{token}/decide", json={"ideaId": "ia", "decision": "rejected", "reason": "too long"})
    assert r.json()["rejectReason"] == "too long"
    assert r.json()["status"] == "rejected"


def test_decide_rejects_idea_of_other_client(client, two_clients):
    token, _ = link(client, "a")
    r = client.post(f"/api/review/{token}/decide", json={"ideaId": "ib", "decision": "approved"})
    assert r.status_code == 404
    r = client.post(f"/api/review/{token}/decide", json={"ideaId": "ia-saved", "decision": "approved"})
    assert r.status_code == 404
    assert {i["id"]: i["status"] for i in client.get("/api/ideas").json()}["ib"] == "waiting"


def test_revoked_token_404(client, two_clients):
    token, _ = link(client)
    assert client.delete(f"/api/share/{token}").status_code == 204
    assert client.get(f"/api/review/{token}").status_code == 404
    r = client.post(f"/api/review/{token}/decide", json={"ideaId": "ia", "decision": "approved"})
    assert r.status_code == 404
    assert client.get("/api/review/not-a-token").status_code == 404


def test_same_client_reuses_token(client, two_clients):
    t1, body = link(client, "a")
    t2, _ = link(client, "a")
    t3, _ = link(client, "b")
    assert t1 == t2 != t3
    assert body["url"].endswith(f"/review/{t1}")


def test_review_hides_editor_notes(client, two_clients):
    client.put("/api/ideas", json=[idea("ia", "a", notes="secret for editor")])
    token, _ = link(client, "a")
    body = client.get(f"/api/review/{token}").json()
    assert "notes" not in body["ideas"][0]["idea"]
    r = client.post(f"/api/review/{token}/decide", json={"ideaId": "ia", "decision": "approved"})
    assert "notes" not in r.json()
    assert {i["id"]: i for i in client.get("/api/ideas").json()}["ia"]["notes"] == "secret for editor"


def test_unknown_client_gets_no_link(client, two_clients):
    assert client.post("/api/share", json={"clientId": "nobody"}).status_code == 404


def test_turn_off_revokes_every_token_of_the_client(client, two_clients):
    import json as _json
    import server
    t1, _ = link(client, "a")
    t2 = "second-token-for-a"
    with server.db() as conn:
        conn.execute("INSERT INTO store (key, value) VALUES (?, ?)",
                     ("share:" + t2, _json.dumps({"clientId": "a", "createdAt": 1})))
    tb, _ = link(client, "b")
    assert client.get(f"/api/review/{t2}").status_code == 200
    assert client.delete("/api/share", params={"clientId": "a"}).status_code == 204
    assert client.get(f"/api/review/{t1}").status_code == 404
    assert client.get(f"/api/review/{t2}").status_code == 404
    assert client.get(f"/api/review/{tb}").status_code == 200
    with server.db() as conn:
        assert conn.execute("SELECT count(*) FROM store WHERE key LIKE 'share:%'").fetchone()[0] == 1


def test_decide_bumps_ideas_revision(client, two_clients):
    token, _ = link(client, "a")
    rev = client.get("/api/ideas").headers["etag"]
    client.post(f"/api/review/{token}/decide", json={"ideaId": "ia", "decision": "approved"})
    assert client.get("/api/ideas").headers["etag"] != rev
    stale = client.put("/api/ideas", json=[idea("ia", "a")], headers={"If-Match": rev})
    assert stale.status_code == 409
    assert {i["id"]: i["status"] for i in stale.json()["ideas"]}["ia"] == "approved"
