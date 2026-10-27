import json

import server


def write_search(folder, query, fetched_at, videos):
    folder.mkdir(parents=True, exist_ok=True)
    payload = {"query": query, "platform": "tiktok", "fetchedAt": fetched_at, "videos": videos}
    (folder / server.cache_name(query)).write_text(json.dumps(payload))


def test_pinned_search_loads_without_network(client):
    write_search(server.PINNED_DIR, "tofu", 0, [{"id": "1"}])  # fetchedAt 0: pins never expire
    r = client.get("/api/search", params={"q": " tofu "})
    assert r.status_code == 200
    assert r.json()["cached"] is True
    assert r.json()["videos"] == [{"id": "1"}]


def test_expired_cache_goes_live(client):
    write_search(server.CACHE_DIR, "tofu", 0, [{"id": "1"}])
    r = client.get("/api/search", params={"q": "tofu"})
    assert r.status_code == 502  # the offline fixture makes live search fail


def test_empty_search_is_rejected(client):
    assert client.get("/api/search", params={"q": "   "}).status_code == 400


def test_search_without_token_is_off(client, monkeypatch):
    monkeypatch.setattr(server, "TOKEN", "")
    assert client.get("/api/search", params={"q": "tofu"}).status_code == 503


def test_trim_keeps_the_ratio():
    item = {"id": 7, "playCount": 1000, "authorMeta": {"fans": 10, "name": "a"},
            "webVideoUrl": "https://www.tiktok.com/@a/video/7", "createTime": 1761523200}
    video = server.trim(item)
    assert video["id"] == "7"
    assert video["ratio"] == 100
    assert video["createTime"] == "2025-10-27T00:00:00.000Z"
