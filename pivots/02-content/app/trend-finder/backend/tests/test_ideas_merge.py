IDEA = {"id": "i1", "videoId": "v1", "clientId": "c1", "status": "waiting", "dueDate": "2026-11-02", "notes": "",
        "sentAt": 1000}


def test_put_ideas_keeps_newer_decision(client):
    client.put("/api/ideas", json=[{**IDEA, "status": "approved", "decidedAt": 2000}])
    stale = {k: v for k, v in IDEA.items()} | {"dueDate": "2026-12-01"}
    saved = client.put("/api/ideas", json=[stale]).json()[0]
    assert saved["status"] == "approved"
    assert saved["decidedAt"] == 2000
    assert saved["dueDate"] == "2026-12-01"
    assert client.get("/api/ideas").json()[0]["status"] == "approved"


def test_put_ideas_allows_resend_after_decision(client):
    client.put("/api/ideas", json=[{**IDEA, "status": "rejected", "rejectReason": "no", "decidedAt": 2000}])
    saved = client.put("/api/ideas", json=[{**IDEA, "sentAt": 3000}]).json()[0]
    assert saved["status"] == "waiting"
    assert "rejectReason" not in saved


def test_stage_round_trips(client):
    client.put("/api/ideas", json=[{**IDEA, "status": "approved", "decidedAt": 2000}])
    moved = {**IDEA, "status": "approved", "decidedAt": 2000, "stage": "posted", "postedAt": 5000}
    saved = client.put("/api/ideas", json=[moved]).json()[0]
    assert saved["stage"] == "posted"
    assert saved["postedAt"] == 5000
    assert client.get("/api/ideas").json()[0]["stage"] == "posted"


def test_old_idea_without_stage_loads(client):
    saved = client.put("/api/ideas", json=[{**IDEA, "status": "approved", "decidedAt": 2000}]).json()[0]
    assert saved.get("stage") is None
    assert saved.get("postedAt") is None
    assert client.get("/api/ideas").json()[0]["id"] == "i1"
