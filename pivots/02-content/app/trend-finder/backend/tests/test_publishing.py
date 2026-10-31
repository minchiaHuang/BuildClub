import publishing
import server


def idea(id, status):
    return {"id": id, "videoId": f"v-{id}", "clientId": "a", "status": status,
            "dueDate": "2026-11-02", "notes": "", "sentAt": 1000}


def put_ideas(client):
    client.put("/api/ideas", json=[idea("ok", "approved"), idea("wait", "waiting")])


def test_create_draft_for_approved_idea(client):
    put_ideas(client)
    r = client.post("/api/publications", json={"ideaId": "ok", "platform": "tiktok"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "draft" and body["variant"] == "A" and body["ideaId"] == "ok"
    assert body["scheduledAt"] is None and body["externalId"] is None
    listed = client.get("/api/ideas/ok/publications").json()
    assert [p["id"] for p in listed] == [body["id"]]


def test_create_for_waiting_idea_409(client):
    put_ideas(client)
    r = client.post("/api/publications", json={"ideaId": "wait", "platform": "tiktok"})
    assert r.status_code == 409


def test_publish_503_when_no_publisher(client, monkeypatch):
    monkeypatch.delenv("REMAKE_DEMO", raising=False)
    monkeypatch.delenv("AYRSHARE_API_KEY", raising=False)
    put_ideas(client)
    pid = client.post("/api/publications", json={"ideaId": "ok", "platform": "youtube"}).json()["id"]
    r = client.post(f"/api/publications/{pid}/publish")
    assert r.status_code == 503
    assert r.json() == {"error": "Publishing is not enabled."}


def test_publish_with_fake_in_demo_sets_published_and_external_id(client, monkeypatch):
    monkeypatch.setenv("REMAKE_DEMO", "1")
    put_ideas(client)
    pid = client.post("/api/publications", json={"ideaId": "ok", "platform": "instagram"}).json()["id"]
    r = client.post(f"/api/publications/{pid}/publish")
    assert r.status_code == 200
    assert r.json()["status"] == "published" and r.json()["externalId"] == f"fake-{pid}"


def test_publisher_error_sets_failed_and_error_text(client, monkeypatch):
    monkeypatch.delenv("REMAKE_DEMO", raising=False)
    monkeypatch.setenv("AYRSHARE_API_KEY", "x")
    put_ideas(client)
    pid = client.post("/api/publications", json={"ideaId": "ok", "platform": "tiktok"}).json()["id"]
    r = client.post(f"/api/publications/{pid}/publish")
    assert r.status_code == 502
    row = client.get("/api/ideas/ok/publications").json()[0]
    assert row["status"] == "failed" and "Ayrshare not wired yet" in row["error"]
