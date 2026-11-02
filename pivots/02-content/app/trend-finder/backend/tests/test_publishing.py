import publishers
import publishing
import server
from publish_helpers import approved_cut


def idea(id, status):
    return {"id": id, "videoId": f"v-{id}", "clientId": "a", "status": status,
            "dueDate": "2026-11-02", "notes": "", "sentAt": 1000}


def put_ideas(client):
    approved_cut(client, "ok")
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


def test_create_for_idea_without_approved_cut_409(client):
    put_ideas(client)
    r = client.post("/api/publications", json={"ideaId": "wait", "platform": "tiktok"})
    assert r.status_code == 409


def test_publish_503_when_no_publisher(client, monkeypatch):
    monkeypatch.delenv("REMAKE_DEMO", raising=False)
    monkeypatch.setenv("PUBLISHER", "ayrshare")
    monkeypatch.delenv("AYRSHARE_API_KEY", raising=False)
    put_ideas(client)
    pid = client.post("/api/publications", json={"ideaId": "ok", "platform": "youtube"}).json()["id"]
    r = client.post(f"/api/publications/{pid}/publish")
    assert r.status_code == 503
    assert "AYRSHARE_API_KEY" in r.json()["error"]


def test_publish_with_fake_in_demo_sets_published_and_external_id(client, monkeypatch):
    monkeypatch.setenv("REMAKE_DEMO", "1")
    put_ideas(client)
    pid = client.post("/api/publications", json={"ideaId": "ok", "platform": "instagram"}).json()["id"]
    r = client.post(f"/api/publications/{pid}/publish")
    assert r.status_code == 200
    assert r.json()["status"] == "published" and r.json()["externalId"].startswith("fake-")


def test_publisher_error_sets_failed_and_error_text(client, monkeypatch):
    monkeypatch.delenv("REMAKE_DEMO", raising=False)
    monkeypatch.setenv("PUBLISHER", "ayrshare")
    monkeypatch.setenv("AYRSHARE_API_KEY", "x")
    put_ideas(client)
    pid = client.post("/api/publications", json={"ideaId": "ok", "platform": "tiktok"}).json()["id"]
    r = client.post(f"/api/publications/{pid}/publish")
    assert r.status_code == 502
    row = client.get("/api/ideas/ok/publications").json()[0]
    assert row["status"] == "failed" and "https" in row["error"]


def make_draft(client, monkeypatch):
    monkeypatch.setenv("REMAKE_DEMO", "1")
    put_ideas(client)
    return client.post("/api/publications", json={"ideaId": "ok", "platform": "tiktok"}).json()["id"]


def test_publish_twice_second_409(client, monkeypatch):
    pid = make_draft(client, monkeypatch)
    assert client.post(f"/api/publications/{pid}/publish").status_code == 200
    assert client.post(f"/api/publications/{pid}/publish").status_code == 409


def test_publish_does_not_call_publisher_again(client, monkeypatch):
    calls = []

    class Counting:
        def publish(self, video, caption, platforms, schedule_at=None):
            calls.append(platforms)
            return [{"platform": "tiktok", "status": "published", "externalId": "ext", "url": None, "publishedAt": 1, "error": None}]
    pid = make_draft(client, monkeypatch)
    monkeypatch.setattr(publishers, "get_publisher", lambda: Counting())
    client.post(f"/api/publications/{pid}/publish")
    client.post(f"/api/publications/{pid}/publish")
    assert calls == [["tiktok"]]


def test_publish_while_publishing_409(client, monkeypatch):
    pid = make_draft(client, monkeypatch)
    with server.db() as conn:
        conn.execute("UPDATE publications SET status = 'publishing' WHERE id = ?", (pid,))
    assert client.post(f"/api/publications/{pid}/publish").status_code == 409


def test_failed_can_be_retried(client, monkeypatch):
    pid = make_draft(client, monkeypatch)
    monkeypatch.setattr(publishers, "get_publisher", lambda: type("Bad", (), {"publish": lambda s, *a: 1 / 0})())
    assert client.post(f"/api/publications/{pid}/publish").status_code == 502
    monkeypatch.setattr(publishers, "get_publisher", lambda: publishers.FakePublisher())
    r = client.post(f"/api/publications/{pid}/publish")
    assert r.status_code == 200 and r.json()["status"] == "published"


def test_demo_rows_hidden_when_demo_off(client, monkeypatch):
    monkeypatch.setenv("REMAKE_DEMO", "1")
    publishing.seed_demo(server.db)
    assert len(client.get("/api/ideas/demo-ab/publications").json()) == 2
    assert all(v["latest"] for v in client.get("/api/ideas/demo-ab/compare").json()["variants"])
    monkeypatch.delenv("REMAKE_DEMO")
    assert client.get("/api/ideas/demo-ab/publications").json() == []
    assert client.get("/api/ideas/demo-ab/compare").json() == {"variants": []}


def test_mode_endpoint_says_simulated_for_fake(client, monkeypatch):
    monkeypatch.delenv("PUBLISHER", raising=False)
    assert client.get("/api/publishing/mode").json() == {"mode": "fake", "simulated": True}
    monkeypatch.setenv("PUBLISHER", "ayrshare")
    assert client.get("/api/publishing/mode").json() == {"mode": "ayrshare", "simulated": False}
