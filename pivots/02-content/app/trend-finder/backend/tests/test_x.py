"""X search with a fake Apify actor: no network, no spend."""

import json
from pathlib import Path

import pytest

import server
import x
from models import SearchResult


def tweet(tid, user="alice", views=10_000, followers=1000, video=True, **extra):
    """One item as the actor returns it."""
    media = [{"type": "video", "media_url_https": f"https://pbs.twimg.com/{tid}.jpg",
              "video_info": {"duration_millis": 12500}}] if video else [{"type": "photo"}]
    return {"id": str(tid), "text": f"Tofu #{tid} #cooking", "viewCount": views, "likeCount": 50, "replyCount": 3,
            "retweetCount": 7, "bookmarkCount": 2, "createdAt": "Thu Oct 17 09:30:41 +0000 2024",
            "author": {"userName": user, "followers": followers}, "extendedEntities": {"media": media},
            "entities": {"hashtags": [{"text": "cooking"}]}, "isRetweet": False, **extra}


class FakeActor:
    """Records every call. .search answers the keyword search, .history the one batched median run."""
    def __init__(self):
        self.search, self.history, self.calls = [], [], []

    def __call__(self, payload, max_items, actor=None):
        self.calls.append((payload, max_items, actor))
        return self.history if " OR " in payload["searchTerms"][0] else self.search

    def median_calls(self):
        return [c for c in self.calls if " OR " in c[0]["searchTerms"][0]]


@pytest.fixture
def actor(monkeypatch):
    fake = FakeActor()
    monkeypatch.setattr(server, "run_actor", fake)
    return fake


def x_search(client, q="tofu", **extra):
    return client.get("/api/search", params={"q": q, "platform": "x", **extra})


def test_tweets_are_mapped_to_the_search_shape():
    [v] = x.search_videos("tofu", lambda payload, n: [tweet(111, "Alice", views=5000, followers=100)])
    assert v["id"] == "111" and v["url"] == "https://x.com/Alice/status/111"
    assert v["cover"] == "https://pbs.twimg.com/111.jpg" and v["duration"] == 12.5
    assert (v["plays"], v["likes"], v["comments"], v["shares"], v["saves"]) == (5000, 50, 3, 7, 2)
    assert (v["author"], v["followers"], v["ratio"]) == ("Alice", 100, 50.0)
    assert v["createTime"] == "2024-10-17T09:30:41.000Z" and v["hashtags"] == ["cooking"]
    SearchResult.model_validate({"query": "t", "platform": "x", "fetchedAt": 1, "videos": [v], "cached": False})


def test_search_asks_for_native_video_sorted_by_top(actor):
    actor.search = [tweet(1)]
    x.search_videos("tofu", actor)
    payload, max_items, _ = actor.calls[0]
    assert payload["searchTerms"] == ["tofu filter:native_video"] and payload["queryType"] == "Top"
    assert max_items == x.RESULTS


def test_only_video_tweets_with_views_are_kept():
    items = [tweet(1), tweet(2, video=False), tweet(3, isRetweet=True), tweet(4, views=None), tweet(1),
             tweet(5, user=""), {"id": "6"}, None, tweet(7, views=200, followers=100)]
    got = x.search_videos("tofu", lambda payload, n: items)
    assert [v["id"] for v in got] == ["1", "7"]  # most views per follower first


def test_media_detail_missing_trusts_the_video_filter():
    item = tweet(1)
    del item["extendedEntities"]
    assert [v["id"] for v in x.search_videos("tofu", lambda p, n: [item])] == ["1"]


def test_outlier_is_views_over_the_authors_median(client, actor):
    actor.search = [tweet(1, "alice", views=90_000), tweet(2, "bob", views=500, followers=50), tweet(3, "alice", views=4000)]
    actor.history = [tweet(10 + n, "alice", views=v) for n, v in enumerate([1000, 2000, 3000])] + \
                    [tweet(20, "bob", views=900), tweet(21, "BOB", views=800)]  # bob: 2 videos, too few
    first = x_search(client).json()
    assert first["mediansPending"] is True and first["videos"][0]["outlier"] is None  # scores arrive in the cache
    body = x_search(client, cachedOnly="1").json()
    by_id = {v["id"]: v for v in body["videos"]}
    assert by_id["1"]["medianViews"] == 2000 and by_id["1"]["outlier"] == 45.0
    assert by_id["2"]["medianViews"] is None and by_id["2"]["outlier"] is None  # falls back to followers
    assert by_id["2"]["ratio"] == 10.0
    assert len(actor.median_calls()) == 1  # one batched run for both authors
    payload, max_items, _ = actor.median_calls()[0]
    assert payload["searchTerms"] == ["from:alice OR from:bob filter:native_video"] and max_items == 20
    cached = x_search(client, cachedOnly="1").json()  # the poll sees the scores
    assert cached["mediansPending"] is False
    assert {v["id"]: v["outlier"] for v in cached["videos"]}["1"] == 45.0


def test_medians_are_capped_and_reused(client, actor, monkeypatch):
    names = [f"user{n}" for n in range(15)]
    actor.search = [tweet(n, name) for n, name in enumerate(names)]
    actor.history = [tweet(100 + n * 10 + k, name, views=1000) for n, name in enumerate(names) for k in range(3)]
    x_search(client)
    [(payload, max_items, _)] = actor.median_calls()
    assert payload["searchTerms"][0].count("from:") == x.AUTHORS_PER_FILL and max_items == 100
    first_batch = {m.lower() for m in names[:x.AUTHORS_PER_FILL]}
    assert set(x.saved(server.db, names, server.MEDIAN_DAYS)) == first_batch
    # A different search over the same authors only fetches the 5 not yet known.
    actor.calls.clear()
    x_search(client, q="soy")
    [(payload, _, _)] = actor.median_calls()
    assert payload["searchTerms"][0].count("from:") == 5


def test_saved_medians_expire(client, actor, monkeypatch):
    x.save(server.db, {"alice": 5.0})
    assert x.saved(server.db, ["Alice"], 7) == {"alice": 5.0}
    assert x.saved(server.db, ["Alice"], -1) == {}


def test_failed_median_run_still_keeps_the_search(client, actor, monkeypatch):
    actor.search = [tweet(1)]

    def boom(payload, max_items, actor=None):
        if " OR " in payload["searchTerms"][0]:
            raise RuntimeError("Apify returned 500")
        return [tweet(1)]
    monkeypatch.setattr(server, "run_actor", boom)
    body = x_search(client).json()
    assert len(body["videos"]) == 1
    assert x_search(client, cachedOnly="1").json()["mediansPending"] is False


def test_repeat_search_comes_from_the_cache(client, actor):
    actor.search = [tweet(1)]
    assert x_search(client).json()["cached"] is False
    n = len(actor.calls)
    assert x_search(client).json()["cached"] is True
    assert len(actor.calls) == n


def test_cached_only_never_searches(client, actor):
    r = x_search(client, cachedOnly="1")
    assert r.status_code == 404 and actor.calls == []


def test_over_the_cap_is_429_before_any_call(client, actor, monkeypatch):
    monkeypatch.setattr(server, "DAILY_APIFY_USD", server.SEARCH_USD["x"] - 0.001)
    r = x_search(client)
    assert r.status_code == 429 and "DAILY_APIFY_USD" in r.json()["detail"]
    assert actor.calls == []


def test_search_and_medians_are_counted_on_the_apify_wallet(client, actor):
    actor.search = [tweet(1, "alice")]
    actor.history = []
    x_search(client)
    spent = server.load(f"spend:{server.today()}")["apify"]
    assert spent == pytest.approx(server.SEARCH_USD["x"] + 1 * x.ITEMS_PER_AUTHOR * server.X_USD_PER_TWEET)


def test_median_run_is_skipped_when_the_budget_is_gone(client, actor, monkeypatch):
    actor.search = [tweet(1, "alice")]
    monkeypatch.setattr(server, "DAILY_APIFY_USD", server.SEARCH_USD["x"])
    body = x_search(client).json()
    assert len(body["videos"]) == 1 and actor.median_calls() == []


def test_x_search_is_off_without_a_token(client, monkeypatch):
    monkeypatch.setattr(server, "TOKEN", "")
    assert x_search(client).status_code == 503


@pytest.mark.parametrize("url", ["https://x.com/alice/status/123", "https://twitter.com/alice/status/123",
                                 "https://www.x.com/alice/status/123", "https://mobile.twitter.com/alice/status/123"])
def test_analyze_takes_an_x_status_link(client, monkeypatch, url):
    queued = []
    monkeypatch.setattr(server.jobs, "submit", lambda u: queued.append(u) or "job1")  # no real download
    r = client.post("/api/analyze", json={"url": url})
    assert (r.status_code, queued) == (200, [url])


@pytest.mark.parametrize("url", ["https://x.com/alice", "https://evilx.com/a/status/1", "http://x.com/a/status/1"])
def test_analyze_rejects_other_x_links(client, url):
    assert client.post("/api/analyze", json={"url": url}).status_code == 400


def test_trim_reads_real_actor_items():
    """Two items trimmed from a real run: one with video media, one old tweet whose media list is empty."""
    items = json.loads((Path(__file__).parent / "fixtures" / "x_real_items.json").read_text())
    videos = x.search_videos("tofu", lambda payload, n: items)
    assert len(videos) == 2  # an empty media list is trusted: the query asked for native video
    full = next(v for v in videos if v["cover"])
    assert full["plays"] > 0 and full["followers"] > 0 and full["duration"] > 0
    assert full["cover"].startswith("https://pbs.twimg.com/") and full["createTime"]
    assert next(v for v in videos if not v["cover"])["plays"] > 0
