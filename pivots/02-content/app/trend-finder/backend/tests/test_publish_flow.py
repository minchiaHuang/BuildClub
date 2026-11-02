"""Publishing an approved cut: gate, fake publisher, manual metrics, summary, review-link isolation."""

import pytest

import publishers
import server
from publish_helpers import approved_cut
from test_auth import add_user, login


@pytest.fixture(autouse=True)
def fake_mode(monkeypatch):
    monkeypatch.delenv("PUBLISHER", raising=False)
    monkeypatch.delenv("AYRSHARE_API_KEY", raising=False)


def publish(client, idea="ok", **body):
    return client.post(f"/api/ideas/{idea}/publish", json={"caption": "hi", "platforms": ["tiktok", "instagram"], **body})


def test_publish_approved_cut_with_fake(client):
    approved_cut(client)
    r = publish(client)
    assert r.status_code == 200
    posts = r.json()["posts"]
    assert [p["platform"] for p in posts] == ["tiktok", "instagram"]
    assert all(p["status"] == "published" and p["url"].startswith("https://fake.example/") and p["publishedAt"] for p in posts)
    assert [p["id"] for p in client.get("/api/ideas/ok/publications").json()] == [p["id"] for p in posts]


def test_future_schedule_is_scheduled(client):
    approved_cut(client)
    posts = publish(client, scheduleAt=4_000_000_000).json()["posts"]
    assert {p["status"] for p in posts} == {"scheduled"} and posts[0]["scheduledAt"] == 4_000_000_000
    assert posts[0]["publishedAt"] is None


def test_fake_is_deterministic():
    a = publishers.FakePublisher().publish("v", "c", ["tiktok"], None)[0]
    b = publishers.FakePublisher().publish("v", "c", ["tiktok"], None)[0]
    assert a["externalId"] == b["externalId"] and a["url"] == b["url"]


@pytest.mark.parametrize("status", ["waiting", "rejected"])
def test_unapproved_cut_rejected(client, status):
    approved_cut(client, status=status)
    assert publish(client).status_code == 409
    assert client.get("/api/ideas/ok/publications").json() == []


def test_no_cut_rejected(client):
    client.put("/api/ideas", json=[{"id": "ok", "videoId": "v", "clientId": "a", "status": "approved",
                                     "dueDate": "2026-11-02", "notes": "", "sentAt": 1}])
    assert publish(client).status_code == 409


def test_replaced_video_after_approval_rejected(client):
    folder = approved_cut(client)
    (folder / "final.mp4").write_bytes(b"a different video")
    import os
    os.utime(folder / "final.mp4", ns=(1, 1))
    assert publish(client).status_code == 409


def test_bad_platform_and_empty_platforms_422(client):
    approved_cut(client)
    assert publish(client, platforms=["myspace"]).status_code == 422
    assert publish(client, platforms=[]).status_code == 422


def test_publisher_failure_marks_failed(client, monkeypatch):
    approved_cut(client)
    monkeypatch.setenv("PUBLISHER", "ayrshare")
    monkeypatch.setenv("AYRSHARE_API_KEY", "k")
    r = publish(client)
    assert r.status_code == 502
    row = client.get("/api/ideas/ok/publications").json()[0]
    assert row["status"] == "failed" and "https" in row["error"]


def test_missing_key_is_a_clear_error(client, monkeypatch):
    approved_cut(client)
    monkeypatch.setenv("PUBLISHER", "ayrshare")
    r = publish(client)
    assert r.status_code == 503 and "AYRSHARE_API_KEY" in r.json()["error"]
    with pytest.raises(publishers.PublisherError, match="AYRSHARE_API_KEY"):
        publishers.get_publisher()


def post_id(client):
    return publish(client, platforms=["tiktok"]).json()["posts"][0]["id"]


def metrics(client, pid, **body):
    return client.post(f"/api/publications/{pid}/metrics", json=body)


def test_manual_metrics_saved(client):
    approved_cut(client)
    pid = post_id(client)
    assert metrics(client, pid, views=100, likes=10, saves=3, followers=50).status_code == 200
    with server.db() as conn:
        row = conn.execute("SELECT views, likes, saves, followers, source FROM publication_metrics").fetchone()
    assert row == (100, 10, 3, 50, "manual")


@pytest.mark.parametrize("body", [{"views": -1}, {"views": 1.5}, {"views": "10"}, {"likes": -5, "views": 1},
                                  {"views": True}, {}, {"views": 1, "source": "api"}])
def test_manual_metrics_validation(client, body):
    approved_cut(client)
    pid = post_id(client)
    assert metrics(client, pid, **body).status_code == 422


def test_metrics_unknown_post_404(client):
    assert metrics(client, "nope", views=1).status_code == 404


def test_fetch_metrics_from_publisher_marks_api(client):
    approved_cut(client)
    pid = post_id(client)
    r = client.post(f"/api/publications/{pid}/metrics/fetch")
    assert r.status_code == 200
    with server.db() as conn:
        assert conn.execute("SELECT source, views IS NOT NULL FROM publication_metrics").fetchone() == ("api", 1)


def test_summary_per_idea_and_topic(client):
    approved_cut(client, "i1", hashtags=["Cooking", "tofu"])
    approved_cut(client, "i2", hashtags=["cooking"])
    approved_cut(client, "i3", hashtags=["cooking"])  # never measured
    p1 = publish(client, "i1", platforms=["tiktok"]).json()["posts"][0]["id"]
    p2 = publish(client, "i2", platforms=["tiktok"]).json()["posts"][0]["id"]
    publish(client, "i3", platforms=["tiktok"])
    metrics(client, p1, views=50, likes=1)
    metrics(client, p1, views=1000, likes=80, comments=10, shares=5, saves=5, followers=500)
    metrics(client, p2, views=3000, likes=100)
    body = client.get("/api/publishing/summary").json()
    ideas = {i["ideaId"]: i for i in body["ideas"]}
    assert ideas["i1"]["views"] == 1000 and ideas["i1"]["engagementRate"] == 0.1
    assert ideas["i1"]["viewsPerFollower"] == 2.0 and ideas["i2"]["viewsPerFollower"] is None
    assert ideas["i3"]["views"] is None and ideas["i3"]["engagementRate"] is None
    topics = {t["topic"]: t for t in body["topics"]}
    assert topics["cooking"]["ideas"] == 3 and topics["cooking"]["measuredIdeas"] == 2
    assert topics["cooking"]["avgViews"] == 2000 and topics["cooking"]["totalViews"] == 4000
    assert topics["tofu"]["ideaIds"] == ["i1"]


def test_summary_empty(client):
    assert client.get("/api/publishing/summary").json() == {"ideas": [], "topics": []}


def test_review_link_does_not_leak_posts(client):
    approved_cut(client)
    pid = post_id(client)
    token = client.post("/api/share", json={"clientId": "a"}).json()["token"]
    text = client.get(f"/api/review/{token}").text
    assert pid not in text and "fake.example" not in text and "publications" not in text
    add_user()
    client.cookies.clear()
    for path in ("/api/ideas/ok/publications", "/api/publishing/summary"):
        assert client.get(path).status_code == 401
    assert client.post("/api/ideas/ok/publish", json={"caption": "", "platforms": ["tiktok"]}).status_code == 401
    assert client.post(f"/api/publications/{pid}/metrics", json={"views": 1}).status_code == 401
    assert client.get(f"/api/review/{token}/publications").status_code == 404
