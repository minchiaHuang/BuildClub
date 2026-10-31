import publishing
import server


def setup_variants(client, variants=("A", "B")):
    client.put("/api/ideas", json=[{"id": "ok", "videoId": "v", "clientId": "a", "status": "approved",
                                     "dueDate": "2026-11-02", "notes": "", "sentAt": 1}])
    ids = {}
    for v in variants:
        ids[v] = client.post("/api/publications", json={"ideaId": "ok", "platform": "tiktok", "variant": v}).json()["id"]
    return ids


def metrics(client, pid, views, fetched_at, **extra):
    r = client.post(f"/api/publications/{pid}/metrics", json={"views": views, "fetchedAt": fetched_at, "source": "test", **extra})
    assert r.status_code == 200


def by_variant(client):
    return {v["variant"]: v for v in client.get("/api/ideas/ok/compare").json()["variants"]}


def test_compare_two_variants_latest_snapshot_wins(client):
    ids = setup_variants(client)
    metrics(client, ids["A"], 100, 1000)
    metrics(client, ids["A"], 900, 2000, likes=5)
    metrics(client, ids["B"], 300, 1500)
    got = by_variant(client)
    assert got["A"]["latest"]["views"] == 900 and got["A"]["latest"]["likes"] == 5
    assert got["A"]["publicationId"] == ids["A"] and got["A"]["platform"] == "tiktok"
    assert got["B"]["latest"]["views"] == 300


def test_views_vs_best(client):
    ids = setup_variants(client)
    metrics(client, ids["A"], 1000, 1000)
    metrics(client, ids["B"], 500, 1000)
    got = by_variant(client)
    assert got["A"]["viewsVsBest"] == 1.0 and got["B"]["viewsVsBest"] == 0.5


def test_single_variant_vs_best_null(client):
    ids = setup_variants(client, ("A",))
    metrics(client, ids["A"], 1000, 1000)
    assert by_variant(client)["A"]["viewsVsBest"] is None


def test_missing_metrics_latest_null(client):
    ids = setup_variants(client)
    metrics(client, ids["A"], 1000, 1000)
    got = by_variant(client)
    assert got["B"]["latest"] is None and got["B"]["viewsVsBest"] is None
    assert got["A"]["viewsVsBest"] is None  # nothing to compare against


def test_no_demo_metrics_in_real_mode(client, monkeypatch):
    monkeypatch.delenv("REMAKE_DEMO", raising=False)
    publishing.seed_demo(server.db)
    with server.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM publications").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM publication_metrics").fetchone()[0] == 0


def test_demo_seeds_once(client, monkeypatch):
    monkeypatch.setenv("REMAKE_DEMO", "1")
    publishing.seed_demo(server.db)
    publishing.seed_demo(server.db)
    with server.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM publications").fetchone()[0] == 2
    assert len(client.get("/api/ideas/demo-ab/compare").json()["variants"]) == 2


def test_demo_source_metrics_ignored_outside_demo(client, monkeypatch):
    monkeypatch.delenv("REMAKE_DEMO", raising=False)
    ids = setup_variants(client, ("A",))
    metrics(client, ids["A"], 100, 1000)
    client.post(f"/api/publications/{ids['A']}/metrics", json={"views": 999, "fetchedAt": 2000, "source": "demo"})
    assert by_variant(client)["A"]["latest"]["views"] == 100
