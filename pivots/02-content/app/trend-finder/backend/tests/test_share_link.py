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
    assert r.json()["code"] == "link_closed"
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


def reject(client, token, idea_id="ia", **body):
    return client.post(f"/api/review/{token}/decide", json={"ideaId": idea_id, "decision": "rejected", **body})


def stored(client):
    return {i["id"]: i for i in client.get("/api/ideas").json()}


def test_reject_with_tags_round_trips(client, two_clients):
    token, _ = link(client, "a")
    r = reject(client, token, tags=["Other", "Doesn't fit the brand's tone"], reason="x")
    assert r.status_code == 200
    assert r.json()["rejectTags"] == ["Other", "Doesn't fit the brand's tone"]
    saved = stored(client)["ia"]
    assert saved["rejectTags"] == ["Other", "Doesn't fit the brand's tone"]
    assert saved["rejectReason"] == "x"


def test_unknown_tag_is_accepted(client, two_clients):
    token, _ = link(client, "a")
    assert reject(client, token, tags=["Too long a shoot"]).status_code == 200


def test_reject_tag_limits(client, two_clients):
    token, _ = link(client, "a")
    assert reject(client, token, tags=["x" * 41]).status_code == 422
    assert reject(client, token, tags=["a", "b", "c", "d", "e", "f"]).status_code == 422
    assert stored(client)["ia"]["status"] == "waiting"


def test_old_idea_without_tags_still_loads(client, two_clients):
    token, _ = link(client, "a")
    assert "rejectTags" not in stored(client)["ia"]
    review = client.get(f"/api/review/{token}").json()
    assert "rejectTags" not in review["ideas"][0]["idea"]


def test_put_ideas_keeps_newer_reject_tags(client, two_clients):
    token, _ = link(client, "a")
    reject(client, token, tags=["Other"], reason="x")
    older = idea("ia", "a", dueDate="2026-11-09")
    r = client.put("/api/ideas", json=[older, idea("ib", "b"), idea("ia-saved", "a", "saved")])
    assert r.status_code == 200
    saved = stored(client)["ia"]
    assert saved["rejectTags"] == ["Other"]
    assert saved["dueDate"] == "2026-11-09"
    assert saved["status"] == "rejected"


def test_approve_after_resend_drops_old_tags(client, two_clients):
    token, _ = link(client, "a")
    reject(client, token, tags=["Other"])
    client.put("/api/ideas", json=[idea("ia", "a", sentAt=2**50), idea("ib", "b"), idea("ia-saved", "a", "saved")])
    r = client.post(f"/api/review/{token}/decide", json={"ideaId": "ia", "decision": "approved"})
    assert r.status_code == 200
    assert "rejectTags" not in r.json()
    assert "rejectTags" not in stored(client)["ia"]


def test_reject_then_resend_keeps_history(client, two_clients):
    token, _ = link(client, "a")
    client.post(f"/api/review/{token}/decide", json={"ideaId": "ia", "decision": "rejected",
                                                     "reason": "too long", "tags": ["Too hard or costly"]})
    sent = next(i for i in client.get("/api/ideas").json() if i["id"] == "ia")
    assert [h["decision"] for h in sent["history"]] == ["rejected"]
    # Staff sends it again from a copy that still holds the history, with the reason cleared.
    resend = {k: v for k, v in sent.items() if k not in ("rejectReason", "rejectTags")}
    resend.update(status="waiting", sentAt=sent["decidedAt"] + 1)
    client.put("/api/ideas", json=[resend, idea("ib", "b")])
    client.post(f"/api/review/{token}/decide", json={"ideaId": "ia", "decision": "approved"})
    done = next(i for i in client.get("/api/ideas").json() if i["id"] == "ia")
    assert [h["decision"] for h in done["history"]] == ["rejected", "approved"]
    assert done["history"][0]["reason"] == "too long"
    assert done["history"][0]["tags"] == ["Too hard or costly"]
    assert done["history"][0]["decidedAt"] > 0


def test_decide_twice_returns_404(client, two_clients):
    token, _ = link(client, "a")
    body = {"ideaId": "ia", "decision": "approved"}
    assert client.post(f"/api/review/{token}/decide", json=body).status_code == 200
    again = client.post(f"/api/review/{token}/decide", json=body)
    assert again.status_code == 404
    assert again.json()["code"] == "not_waiting"
    saved = next(i for i in client.get("/api/ideas").json() if i["id"] == "ia")
    assert len(saved["history"]) == 1
