"""The production board: when an idea last changed (updatedAt) and what the board cannot see in the ideas list."""

import time

import server
from publish_helpers import approved_cut

IDEA = {"id": "i1", "videoId": "v1", "clientId": "c1", "status": "saved", "dueDate": "2026-11-02", "notes": ""}


def now_ms():
    return int(time.time() * 1000)


def test_old_idea_without_updated_at_loads(client):
    with server.db() as conn:
        import json
        conn.execute("INSERT OR REPLACE INTO store (key, value) VALUES ('ideas', ?)", (json.dumps([IDEA]),))
    got = client.get("/api/ideas").json()[0]
    assert got["id"] == "i1" and "updatedAt" not in got


def test_save_stamps_a_new_idea(client):
    before = now_ms()
    saved = client.put("/api/ideas", json=[IDEA]).json()[0]
    assert before <= saved["updatedAt"] <= now_ms()
    assert client.get("/api/ideas").json()[0]["updatedAt"] == saved["updatedAt"]


def test_unchanged_idea_keeps_its_stamp(client):
    first = client.put("/api/ideas", json=[IDEA]).json()[0]["updatedAt"]
    time.sleep(0.01)
    again = client.put("/api/ideas", json=[IDEA]).json()[0]["updatedAt"]
    assert again == first


def test_client_cannot_set_updated_at(client):
    saved = client.put("/api/ideas", json=[{**IDEA, "updatedAt": 5}]).json()[0]
    assert saved["updatedAt"] > 5
    time.sleep(0.01)
    same = client.put("/api/ideas", json=[{**IDEA, "updatedAt": 5}]).json()[0]
    assert same["updatedAt"] == saved["updatedAt"]


def test_changed_idea_gets_a_new_stamp(client):
    first = client.put("/api/ideas", json=[IDEA]).json()[0]["updatedAt"]
    time.sleep(0.01)
    changed = client.put("/api/ideas", json=[{**IDEA, "notes": "hello"}]).json()[0]["updatedAt"]
    assert changed > first


def test_only_the_changed_idea_is_restamped(client):
    other = {**IDEA, "id": "i2"}
    a, b = [i["updatedAt"] for i in client.put("/api/ideas", json=[IDEA, other]).json()]
    time.sleep(0.01)
    got = client.put("/api/ideas", json=[{**IDEA, "notes": "x"}, other]).json()
    assert got[0]["updatedAt"] > a and got[1]["updatedAt"] == b


def test_review_decision_stamps_and_review_page_hides_it(client):
    client.put("/api/clients", json=[{"id": "c1", "name": "Tofu", "niche": "f", "audience": "a", "monthlyTarget": 1, "examples": [], "cannot": []}])
    client.put("/api/ideas", json=[{**IDEA, "status": "waiting", "sentAt": 1000, "stage": "filming"}])
    token = client.post("/api/share", json={"clientId": "c1"}).json()["token"]
    page = client.get(f"/api/review/{token}").json()
    assert "updatedAt" not in page["ideas"][0]["idea"] and "stage" not in page["ideas"][0]["idea"]
    stamped = client.get("/api/ideas").json()[0]["updatedAt"]
    time.sleep(0.01)
    client.post(f"/api/review/{token}/decide", json={"ideaId": "i1", "decision": "approved"})
    assert client.get("/api/ideas").json()[0]["updatedAt"] > stamped


def test_production_lists_nothing_for_a_fresh_database(client):
    assert client.get("/api/production").json() == {"ideas": {}}


def test_production_sees_cut_and_activity(client):
    approved_cut(client, "ok")
    with server.db() as conn:
        conn.execute("INSERT INTO renders (idea_id, status, progress, step, speed, signature, started_at, finished_at, out_size) "
                     "VALUES ('ok', 'done', 1, 'done', 1, 's', 7000, 8000, 99)")
    row = client.get("/api/production").json()["ideas"]["ok"]
    assert row["cut"] is True and row["published"] is False and row["activityAt"] >= 1


def test_production_sees_a_published_post(client):
    approved_cut(client, "ok")
    with server.db() as conn:
        conn.execute("INSERT INTO publications (id, idea_id, variant, platform, status, created_at, published_at) "
                     "VALUES ('p1', 'ok', 'A', 'tiktok', 'published', 10, 5000)")
        conn.execute("INSERT INTO publications (id, idea_id, variant, platform, status, created_at) "
                     "VALUES ('p2', 'two', 'A', 'tiktok', 'draft', 20)")
    got = client.get("/api/production").json()["ideas"]
    assert got["ok"]["published"] is True and got["ok"]["activityAt"] == 5_000_000
    assert got["two"] == {"cut": False, "published": False, "activityAt": 20_000}
