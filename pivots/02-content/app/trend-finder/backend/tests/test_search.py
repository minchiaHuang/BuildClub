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
