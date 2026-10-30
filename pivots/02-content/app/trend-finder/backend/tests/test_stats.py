"""/api/stats counts the real videos behind the searches saved on this server."""

import json

import server


def put(folder, query, ids, platform="tiktok"):
    folder.mkdir(exist_ok=True)
    payload = {"query": query, "platform": platform, "fetchedAt": 1, "videos": [{"id": i} for i in ids]}
    (folder / server.cache_name(query, platform)).write_text(json.dumps(payload))


def test_counts_cached_and_pinned_videos(offline, client):
    cache, pinned = offline / "cache", offline / "pinned"
    put(cache, "tofu", [f"a{i}" for i in range(30)])
    put(cache, "kimchi", [f"a{i}" for i in range(25, 30)] + [f"b{i}" for i in range(15)])  # 5 repeats
    put(pinned, "ramen", [f"c{i}" for i in range(10)])
    put(pinned, "tofu", [f"a{i}" for i in range(30)])  # same search also in cache: counts once

    server.stats_cache.clear()
    r = client.get("/api/stats")
    assert r.status_code == 200
    assert r.json() == {"videosScanned": 55, "searches": 3}


def test_empty_when_nothing_saved(offline, client):
    server.stats_cache.clear()
    assert client.get("/api/stats").json() == {"videosScanned": 0, "searches": 0}


def test_suggest_matches_past_and_client_topics(offline, client):
    put(offline / "cache", "Crispy Tofu", ["a1"])
    put(offline / "pinned", "tofu ramen", ["a2"])
    put(offline / "pinned", "crispy tofu", ["a3"], platform="instagram")  # same words as the cached one: once
    put(offline / "cache", "kimchi", ["a4"])
    server.save("clients", [server.Client(id="c1", name="N", niche="n", audience="a", monthlyTarget=1,
                                          examples=["silken tofu bowls"], topics=["tofu skincare"], cannot=[])])

    queries = client.get("/api/suggest", params={"q": "TOFU"}).json()["queries"]
    assert queries[0] == "tofu ramen"  # pinned first
    assert sorted(q.lower() for q in queries) == sorted(["tofu ramen", "crispy tofu", "tofu skincare", "silken tofu bowls"])
    assert client.get("/api/suggest", params={"q": ""}).json() == {"queries": []}


def test_suggest_limit_8(offline, client):
    for i in range(12):
        put(offline / "cache", f"tofu {i}", [f"v{i}"])
    assert len(client.get("/api/suggest", params={"q": "tofu"}).json()["queries"]) == 8
