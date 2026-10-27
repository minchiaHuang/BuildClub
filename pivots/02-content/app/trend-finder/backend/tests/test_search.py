import json
from pathlib import Path

import server
from models import SearchResult


def item(vid, author, plays, fans=100):
    """A raw Apify item, as the TikTok actor returns it."""
    return {"id": vid, "playCount": plays, "authorMeta": {"name": author, "fans": fans},
            "webVideoUrl": f"https://www.tiktok.com/@{author}/video/{vid}", "createTime": 1761523200}


def write_search(folder, query, fetched_at, videos):
    folder.mkdir(parents=True, exist_ok=True)
    payload = {"query": query, "platform": "tiktok", "fetchedAt": fetched_at, "videos": videos}
    (folder / server.cache_name(query)).write_text(json.dumps(payload))


def test_pinned_search_loads_without_network(client):
    video = server.trim(item(1, "a", 500))
    write_search(server.PINNED_DIR, "tofu", 0, [video])  # fetchedAt 0: pins never expire
    r = client.get("/api/search", params={"q": " tofu "})
    assert r.status_code == 200
    assert r.json()["cached"] is True
    assert r.json()["videos"][0]["ratio"] == 5
    assert r.json()["videos"][0]["medianViews"] is None  # saved before medians existed


def test_expired_cache_goes_live(client):
    write_search(server.CACHE_DIR, "tofu", 0, [])
    r = client.get("/api/search", params={"q": "tofu"})
    assert r.status_code == 502  # the offline fixture makes every Apify call fail


def test_empty_search_is_rejected(client):
    assert client.get("/api/search", params={"q": "   "}).status_code == 400


def test_search_without_token_is_off(client, monkeypatch):
    monkeypatch.setattr(server, "TOKEN", "")
    assert client.get("/api/search", params={"q": "tofu"}).status_code == 503


def test_live_search_adds_account_medians(client, monkeypatch):
    calls = []

    def fake_actor(payload, max_items, actor=None):
        calls.append((payload, max_items))
        if "searchQueries" in payload:
            return [item(1, "small", 9000, fans=10), item(2, "big", 1000, fans=1000), {"id": 3}]
        # small posts five videos with a median of 300; big posts only two
        return [item(10 + n, "small", v) for n, v in enumerate([100, 200, 300, 400, 500])] + \
               [item(20, "big", 10), item(21, "big", 20)]

    monkeypatch.setattr(server, "run_actor", fake_actor)
    r = client.get("/api/search", params={"q": "tofu", "fresh": "1"})
    assert r.status_code == 200
    assert r.json()["mediansPending"] is True
    r = client.get("/api/search", params={"q": "tofu"})  # the cache now holds the medians
    assert r.json()["mediansPending"] is False
    small, big = r.json()["videos"]  # sorted by views ÷ followers; the item without a URL is dropped
    assert (small["medianViews"], small["outlier"]) == (300, 30)
    assert (big["medianViews"], big["outlier"]) == (None, None)
    profiles, max_items = calls[1]
    assert profiles["profiles"] == ["small", "big"] and max_items == 2 * server.VIDEOS_PER_AUTHOR
    assert SearchResult.model_validate(json.loads((server.CACHE_DIR / server.cache_name("tofu")).read_text())
                                       | {"cached": False})


def test_failed_medians_keep_the_search(client, monkeypatch):
    def fake_actor(payload, max_items, actor=None):
        if "profiles" in payload:
            raise RuntimeError("Apify returned 402")
        return [item(1, "a", 500)]

    monkeypatch.setattr(server, "run_actor", fake_actor)
    r = client.get("/api/search", params={"q": "tofu", "fresh": "1"})
    assert r.status_code == 200
    assert r.json()["videos"][0]["outlier"] is None


def test_median_needs_five_videos():
    assert server.median_views([item(n, "a", n) for n in range(4)]) == {}
    assert server.median_views([item(n, "a", n) for n in range(5)]) == {"a": 2}


def test_saved_pins_still_match_the_contract():
    for pin in (Path(server.__file__).parent / "pinned").glob("*.json"):
        SearchResult.model_validate(json.loads(pin.read_text()) | {"cached": True})


def test_trim_keeps_the_ratio():
    video = server.trim(item(7, "a", 1000, fans=10))
    assert video["id"] == "7"
    assert video["ratio"] == 100
    assert video["createTime"] == "2025-10-27T00:00:00.000Z"


FIXTURE = Path(__file__).parent / "fixtures" / "instagram_tofu.json"  # a real search, 2026-10-27


def test_instagram_search_from_a_real_result(client, monkeypatch):
    calls = []

    def fake_actor(payload, max_items, actor=None):
        calls.append((payload, actor))
        return json.loads(FIXTURE.read_text())

    monkeypatch.setattr(server, "run_actor", fake_actor)
    r = client.get("/api/search", params={"q": "tofu", "platform": "instagram"})
    assert r.status_code == 200
    body = r.json()
    assert body["platform"] == "instagram" and len(body["videos"]) == 12
    plays = [v["plays"] for v in body["videos"]]
    assert plays == sorted(plays, reverse=True) and plays[0] == 6492169
    top = body["videos"][0]
    assert top["author"] == "thaotamto" and top["url"].startswith("https://www.instagram.com/")
    assert top["followers"] is None and top["ratio"] is None and top["medianViews"] is None
    assert [actor for _, actor in calls] == [server.IG_ACTOR]  # no TikTok account lookups
    assert calls[0][0]["keywordSearch"] is True

    # the second search comes from the cache, kept apart from TikTok's
    assert client.get("/api/search", params={"q": "tofu", "platform": "instagram"}).json()["cached"] is True
    client.get("/api/search", params={"q": "tofu"})
    assert "searchQueries" in calls[-1][0]  # TikTok went to its own actor, not the Instagram cache


def test_unknown_platform_is_rejected(client):
    assert client.get("/api/search", params={"q": "tofu", "platform": "youtube"}).status_code == 400


def test_tiktok_cache_names_did_not_change():
    assert server.cache_name("tofu") == server.cache_name("tofu", "tiktok") != server.cache_name("tofu", "instagram")


def median_search(calls, authors):
    """Search returns one video per author; each account's latest videos all have 100 views."""
    def fake_actor(payload, max_items, actor=None):
        calls.append(payload)
        if "searchQueries" in payload:
            return [item(n, a, 1000) for n, a in enumerate(authors)]
        return [item(100 + n, a, 100) for a in payload["profiles"] for n in range(5)]
    return fake_actor


def fetched(calls):
    return [c["profiles"] for c in calls if "profiles" in c]


def test_account_medians_are_reused_for_a_week(client, monkeypatch):
    calls = []
    monkeypatch.setattr(server, "run_actor", median_search(calls, ["a", "b"]))
    client.get("/api/search", params={"q": "tofu"})
    monkeypatch.setattr(server, "run_actor", median_search(calls, ["b", "c"]))
    r = client.get("/api/search", params={"q": "miso"})
    assert fetched(calls) == [["a", "b"], ["c"]]  # b came from the saved medians
    assert [v["outlier"] for v in r.json()["videos"]] == [10, None]  # b scored at once, c later
    assert [v["outlier"] for v in client.get("/api/search", params={"q": "miso"}).json()["videos"]] == [10, 10]

    with server.db() as conn:  # a week later every account is fetched again
        conn.execute("UPDATE medians SET fetched_at = fetched_at - ?", (server.MEDIAN_DAYS * 86400 + 1,))
    client.get("/api/search", params={"q": "miso", "fresh": "1"})
    assert fetched(calls)[-1] == ["b", "c"]


def test_accounts_with_few_videos_are_not_fetched_again(client, monkeypatch):
    calls = []

    def fake_actor(payload, max_items, actor=None):
        calls.append(payload)
        return [item(1, "new", 1000)] if "searchQueries" in payload else [item(2, "new", 10)]

    monkeypatch.setattr(server, "run_actor", fake_actor)
    for q in ("tofu", "miso"):
        assert client.get("/api/search", params={"q": q}).json()["videos"][0]["medianViews"] is None
    assert fetched(calls) == [["new"]]


def test_failed_medians_are_not_saved(client, monkeypatch):
    calls = []

    def failing(payload, max_items, actor=None):
        calls.append(payload)
        if "profiles" in payload:
            raise RuntimeError("Apify returned 402")
        return [item(1, "a", 500)]

    monkeypatch.setattr(server, "run_actor", failing)
    client.get("/api/search", params={"q": "tofu"})
    client.get("/api/search", params={"q": "miso"})
    assert fetched(calls) == [["a"], ["a"]]


def test_results_come_back_before_account_medians(client, monkeypatch):
    import threading
    release, filled = threading.Event(), threading.Event()

    def slow_actor(payload, max_items, actor=None):
        if "searchQueries" in payload:
            return [item(1, "a", 1000)]
        release.wait(5)
        return [item(10 + n, "a", 100) for n in range(5)]

    def real_thread(fill):
        threading.Thread(target=lambda: (fill(), filled.set()), daemon=True).start()

    monkeypatch.setattr(server, "run_actor", slow_actor)
    monkeypatch.setattr(server, "in_background", real_thread)
    r = client.get("/api/search", params={"q": "tofu"})
    assert r.json()["mediansPending"] is True
    assert r.json()["videos"][0]["medianViews"] is None
    assert client.get("/api/search", params={"q": "tofu"}).json()["mediansPending"] is True  # still filling
    release.set()
    assert filled.wait(5)
    r = client.get("/api/search", params={"q": "tofu"})
    assert r.json()["mediansPending"] is False
    assert r.json()["videos"][0]["outlier"] == 10


def test_saved_medians_need_no_waiting(client, monkeypatch):
    calls = []
    monkeypatch.setattr(server, "run_actor", median_search(calls, ["a"]))
    server.save_medians({"a": 100})
    r = client.get("/api/search", params={"q": "tofu"})
    assert r.json()["mediansPending"] is False
    assert r.json()["videos"][0]["outlier"] == 10
    assert fetched(calls) == []


def test_a_fill_lost_to_a_restart_is_not_waited_on(client):
    payload = {"query": "tofu", "platform": "tiktok", "fetchedAt": int(server.time.time() * 1000),
               "videos": [server.trim(item(1, "a", 500))], "mediansPending": True}
    server.CACHE_DIR.mkdir(parents=True)
    (server.CACHE_DIR / server.cache_name("tofu")).write_text(json.dumps(payload))
    assert client.get("/api/search", params={"q": "tofu"}).json()["mediansPending"] is False


def test_instagram_has_no_medians_to_wait_for(client, monkeypatch):
    monkeypatch.setattr(server, "run_actor", lambda payload, max_items, actor=None: [])
    r = client.get("/api/search", params={"q": "tofu", "platform": "instagram"})
    assert r.json()["mediansPending"] is False


def test_a_poll_for_scores_never_searches_live(client):
    r = client.get("/api/search", params={"q": "tofu", "cachedOnly": "1"})
    assert r.status_code == 404  # the offline fixture would fail the test if Apify were called
