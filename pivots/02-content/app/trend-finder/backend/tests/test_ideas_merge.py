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


def test_ideas_revision_rejects_stale_put(client):
    assert client.get("/api/ideas").headers["etag"] == '"0"'
    first = client.put("/api/ideas", json=[IDEA], headers={"If-Match": '"0"'})
    assert first.status_code == 200 and first.headers["etag"] == '"1"'
    # Another tab saves; the first tab still holds revision 1.
    other = [IDEA, {**IDEA, "id": "i2"}]
    assert client.put("/api/ideas", json=other, headers={"If-Match": '"1"'}).headers["etag"] == '"2"'
    stale = client.put("/api/ideas", json=[{**IDEA, "notes": "stale"}], headers={"If-Match": '"1"'})
    assert stale.status_code == 409
    assert stale.headers["etag"] == '"2"'
    assert [i["id"] for i in stale.json()["ideas"]] == ["i1", "i2"]
    assert [i["id"] for i in client.get("/api/ideas").json()] == ["i1", "i2"]
    assert client.get("/api/ideas").json()[0]["notes"] == ""


def test_put_ideas_without_if_match_still_works(client):
    client.put("/api/ideas", json=[IDEA], headers={"If-Match": '"0"'})
    assert client.put("/api/ideas", json=[]).status_code == 200
    assert client.get("/api/ideas").headers["etag"] == '"2"'


def test_merge_keeps_newer_reviewer_decision(client):
    old = {"decision": "rejected", "reason": "no", "decidedAt": 2000}
    client.put("/api/ideas", json=[{**IDEA, "status": "approved", "decidedAt": 2000, "history": [old]}])
    # A stale tab sends the idea as waiting and without the history it never saw.
    saved = client.put("/api/ideas", json=[{**IDEA, "status": "waiting", "sentAt": 1000, "decidedAt": 1000}]).json()[0]
    assert saved["status"] == "approved"
    assert saved["decidedAt"] == 2000
    assert saved["history"] == [old]


def test_merge_allows_resend_after_decision_and_keeps_history(client):
    old = {"decision": "rejected", "decidedAt": 2000}
    client.put("/api/ideas", json=[{**IDEA, "status": "rejected", "decidedAt": 2000, "history": [old]}])
    saved = client.put("/api/ideas", json=[{**IDEA, "status": "waiting", "sentAt": 3000}]).json()[0]
    assert saved["status"] == "waiting"
    assert saved["history"] == [old]


def test_merge_history_never_shrinks(client):
    h = [{"decision": "rejected", "decidedAt": 2000}, {"decision": "approved", "decidedAt": 4000}]
    client.put("/api/ideas", json=[{**IDEA, "status": "approved", "decidedAt": 4000, "sentAt": 3000, "history": h}])
    saved = client.put("/api/ideas", json=[{**IDEA, "status": "approved", "decidedAt": 4000, "sentAt": 3000, "history": h[:1]}]).json()[0]
    assert saved["history"] == h


def test_frontend_fields_round_trip(client):
    sent = {**IDEA, "approvedAt": 4000, "managerNote": "tighter hook", "shotComments": {"0": "closer"}}
    client.put("/api/ideas", json=[sent])
    saved = client.get("/api/ideas").json()[0]
    assert saved["approvedAt"] == 4000
    assert saved["managerNote"] == "tighter hook"
    assert saved["shotComments"] == {"0": "closer"}


def test_stage_dropped_when_not_approved(client):
    saved = client.put("/api/ideas", json=[{**IDEA, "stage": "filming", "postedAt": 5000}]).json()[0]
    assert "stage" not in saved and "postedAt" not in saved


def test_reopened_plan_loses_stage(client):
    client.put("/api/ideas", json=[{**IDEA, "status": "approved", "decidedAt": 2000, "stage": "posted", "postedAt": 5000}])
    saved = client.put("/api/ideas", json=[{**IDEA, "sentAt": 3000, "stage": "posted", "postedAt": 5000}]).json()[0]
    assert saved["status"] == "waiting"
    assert "stage" not in saved and "postedAt" not in saved


def test_posted_at_only_when_posted(client):
    moved = {**IDEA, "status": "approved", "decidedAt": 2000, "stage": "editing", "postedAt": 5000}
    saved = client.put("/api/ideas", json=[moved]).json()[0]
    assert saved["stage"] == "editing" and "postedAt" not in saved
