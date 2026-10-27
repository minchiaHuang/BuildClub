import analyze
import server
from test_analyze import RESULT, fake_prepare, wait
from test_search import item, write_search

URL = "https://www.tiktok.com/@a/video/1"


def fake_search(calls):
    def fake_actor(payload, max_items, actor=None, max_usd=None):
        calls.append(payload)
        return [item(1, "a", 500)] if "searchQueries" in payload else []
    return fake_actor


def test_live_searches_stop_at_the_daily_cap(client, monkeypatch):
    calls = []
    monkeypatch.setattr(server, "run_actor", fake_search(calls))
    # The first search pays 0.12 + 0.02 for account a's videos; a is then cached, so the second pays 0.12.
    monkeypatch.setattr(server, "DAILY_APIFY_USD", 0.28)
    for _ in range(2):
        assert client.get("/api/search", params={"q": "tofu", "fresh": "1"}).status_code == 200
    calls.clear()
    r = client.get("/api/search", params={"q": "tofu", "fresh": "1"})
    assert r.status_code == 429
    assert "budget" in r.json()["error"]
    assert "DAILY_APIFY_USD" in r.json()["detail"]
    assert calls == []  # refused before Apify is called


def test_cached_searches_are_free_after_the_cap(client, monkeypatch):
    monkeypatch.setattr(server, "DAILY_APIFY_USD", 0)
    write_search(server.CACHE_DIR, "tofu", int(server.time.time() * 1000), [server.trim(item(1, "a", 500))])
    assert client.get("/api/search", params={"q": "tofu"}).status_code == 200


def test_instagram_costs_less_than_tiktok(client, monkeypatch):
    monkeypatch.setattr(server, "run_actor", lambda payload, max_items, actor=None: [])
    monkeypatch.setattr(server, "DAILY_APIFY_USD", 0.14)  # Instagram 0.03, then TikTok 0.12 goes over
    assert client.get("/api/search", params={"q": "tofu", "platform": "instagram"}).status_code == 200
    assert client.get("/api/search", params={"q": "tofu"}).status_code == 429


def test_the_cap_resets_the_next_day(client, monkeypatch):
    monkeypatch.setattr(server, "run_actor", fake_search([]))
    monkeypatch.setattr(server, "DAILY_APIFY_USD", 0.16)  # one search with one new account
    monkeypatch.setattr(server, "today", lambda: "2026-10-27")
    assert client.get("/api/search", params={"q": "tofu", "fresh": "1"}).status_code == 200
    assert client.get("/api/search", params={"q": "tofu", "fresh": "1"}).status_code == 429
    monkeypatch.setattr(server, "today", lambda: "2026-10-28")
    assert client.get("/api/search", params={"q": "tofu", "fresh": "1"}).status_code == 200


def test_breakdowns_stop_at_the_cap_but_finished_ones_stay_free(client, monkeypatch):
    monkeypatch.setattr(analyze, "prepare", fake_prepare)
    monkeypatch.setattr(analyze, "breakdown", lambda prepared, work: RESULT)
    monkeypatch.setattr(server, "jobs", analyze.Jobs())
    monkeypatch.setattr(server, "DAILY_CLAUDE_USD", 0.08)  # one breakdown
    r = client.post("/api/analyze", json={"url": URL})
    assert r.status_code == 200
    wait(server.jobs, r.json()["job"])
    assert client.post("/api/analyze", json={"url": URL}).status_code == 200  # same link: already done
    r = client.post("/api/analyze", json={"url": "https://www.tiktok.com/@a/video/2"})
    assert r.status_code == 429
    assert "DAILY_CLAUDE_USD" in r.json()["detail"]


def test_account_medians_are_skipped_when_they_would_go_over_the_cap(client, monkeypatch):
    calls = []
    monkeypatch.setattr(server, "run_actor", fake_search(calls))
    monkeypatch.setattr(server, "DAILY_APIFY_USD", server.SEARCH_USD["tiktok"])  # the search fits, its account medians don't
    r = client.get("/api/search", params={"q": "tofu", "fresh": "1"})
    assert r.status_code == 200
    assert r.json()["videos"][0]["medianViews"] is None
    assert [c for c in calls if "profiles" in c] == []


def test_only_accounts_actually_fetched_are_paid_for(client, monkeypatch):
    monkeypatch.setattr(server, "run_actor", fake_search([]))
    server.save_medians({"a": 400})
    assert client.get("/api/search", params={"q": "tofu", "fresh": "1"}).status_code == 200
    assert server.load(f"spend:{server.today()}") == {"apify": server.SEARCH_USD["tiktok"]}
