"""Reddit search with a fake Apify actor: no network, no spend."""

import pytest

import reddit
import server
from models import SearchResult


def post(pid, sub="tofu", ups=100, comments=7, **extra):
    """One post as clearpath/reddit-search-scraper returns it (trimmed to the fields used)."""
    return {"_type": "post", "_status": "found", "id": f"t3_{pid}", "title": f"Tofu {pid}", "author": "u1",
            "subreddit": sub, "score": ups, "commentCount": comments, "createdAt": "2026-10-01T00:00:00+0000",
            "threadUrl": f"https://www.reddit.com/r/{sub}/comments/{pid}/x/", "url": f"https://v.redd.it/{pid}",
            "postHint": "HOSTED_VIDEO", "isNsfw": False, "thumbnail": f"https://external-preview.redd.it/{pid}_t.png",
            "media": {"still": {"source": {"url": f"https://external-preview.redd.it/{pid}.png"}},
                      "streaming": {"duration": 19}, "typeHint": "VIDEO"}, **extra}


@pytest.fixture
def actor(monkeypatch):
    """A fake run_actor. Set .search (posts) and .subs ({subreddit: [upvotes] or Exception})."""
    class Fake:
        def __init__(self):
            self.search, self.subs, self.calls = [], {}, []

        def __call__(self, payload, max_items, actor=None):
            self.calls.append((payload, max_items, actor))
            if "query" in payload:
                return self.search
            rows = []
            for sub in payload["subreddits"]:
                ups = self.subs.get(sub, [])
                if isinstance(ups, Exception):
                    raise ups
                rows += [post(f"{sub}{n}", sub, u, postHint="HOSTED_VIDEO" if n % 2 == 0 else "") for n, u in enumerate(ups)]
            return rows

        def sub_calls(self):
            return [c for c in self.calls if "subreddits" in c[0]]

    fake = Fake()
    monkeypatch.setattr(server, "run_actor", fake)
    return fake


def rd(client, q="tofu", **extra):
    return client.get("/api/search", params={"q": q, "platform": "reddit", **extra})


def spent():
    return server.load(f"spend:{server.today()}")["apify"]


def test_posts_are_mapped_and_only_videos_kept(actor):
    actor.search = [post("a", ups=500, comments=12), post("b", postHint="IMAGE"), post("c", isNsfw=True),
                    post("d", ups=None), post("e", ups=900)]
    [v, w] = reddit.search_posts(server.run_actor, "tofu", server.REDDIT_ACTOR)
    assert w["id"] == "a" and v["id"] == "e"  # most upvoted first, "t3_" dropped
    assert w["url"].endswith("/comments/a/x/") and w["text"] == "Tofu a" and w["duration"] == 19
    assert (w["plays"], w["upvotes"], w["comments"], w["community"], w["author"]) == (None, 500, 12, "tofu", "u1")
    assert w["cover"] == "https://external-preview.redd.it/a.png" and w["createTime"] == "2026-10-01T00:00:00+0000"
    assert w["followers"] is None and "outlier" not in w
    payload, max_items, name = actor.calls[0]
    assert payload["query"] == "tofu site:v.redd.it" and payload["sort"] == "top" and payload["timeFilter"] == "year"
    assert max_items == reddit.RESULTS and name == server.REDDIT_ACTOR


def test_subreddit_medians_come_from_one_run_and_need_enough_posts(actor):
    actor.subs = {"tofu": [10, 20, 30, 40, 50], "few": [1, 2], "gone": []}
    found = reddit.fetch_subreddits(server.run_actor, ["tofu", "few", "gone"], server.REDDIT_SUB_ACTOR)
    assert found == {"tofu": 30}  # videos and plain posts both count; short or missing subreddits are left out
    [(payload, max_items, name)] = actor.sub_calls()
    assert payload["subreddits"] == ["tofu", "few", "gone"] and payload["timeFilter"] == "month"
    assert max_items == 3 * reddit.POSTS_PER_SUB and name == server.REDDIT_SUB_ACTOR
    assert reddit.fetch_subreddits(server.run_actor, [], server.REDDIT_SUB_ACTOR) == {} and len(actor.sub_calls()) == 1


def test_live_search_returns_first_then_fills_scores(client, actor):
    actor.search = [post("a", "tofu", ups=900), post("b", "newsub", ups=40)]
    actor.subs = {"tofu": [100, 200, 300, 400, 500], "newsub": [1, 2]}
    r = rd(client)
    assert r.status_code == 200 and r.json()["platform"] == "reddit"
    assert r.json()["mediansPending"] is True and r.json()["videos"][0]["outlier"] is None
    body = rd(client).json()  # the fill ran inline; the cache now has the scores
    assert body["cached"] is True and body["mediansPending"] is False
    a, b = body["videos"]
    assert (a["medianUpvotes"], a["outlier"]) == (300, 3.0)
    assert (b["medianUpvotes"], b["outlier"]) == (None, None)
    assert SearchResult.model_validate(body)
    assert len(actor.sub_calls()) == 1  # both subreddits in one run
    assert spent() == pytest.approx(server.SEARCH_USD["reddit"] + 2 * server.REDDIT_USD_PER_SUB)


def test_subreddit_medians_are_cached_for_a_week_and_capped(client, actor):
    actor.search = [post(f"p{n}", f"s{n}", ups=100 - n) for n in range(12)]
    actor.subs = {f"s{n}": [10] * 5 for n in range(12)}
    rd(client)
    [(payload, _, _)] = actor.sub_calls()
    assert payload["subreddits"] == [f"s{n}" for n in range(8)] and reddit.SUBS_PER_SEARCH == 8
    actor.calls.clear()
    actor.search = [post("x", "s0", ups=50)]
    r = rd(client, "miso").json()
    assert r["videos"][0]["outlier"] == 5 and r["mediansPending"] is False and actor.sub_calls() == []
    with server.db() as conn:
        conn.execute("UPDATE reddit_subs SET fetched_at = fetched_at - ?", (server.MEDIAN_DAYS * 86400 + 1,))
    rd(client, "miso", fresh="1")
    assert [c[0]["subreddits"] for c in actor.sub_calls()] == [["s0"]]


def test_a_failed_subreddit_is_not_saved_and_keeps_the_search(client, actor):
    actor.search = [post("a", "tofu")]
    actor.subs = {"tofu": RuntimeError("Apify returned 500")}
    assert rd(client).status_code == 200
    assert rd(client).json()["videos"][0]["outlier"] is None
    assert reddit.saved(server.db, ["tofu"], server.MEDIAN_DAYS) == {}


def test_over_the_daily_cap_is_a_429_with_no_actor_call(client, actor, monkeypatch):
    monkeypatch.setattr(server, "DAILY_APIFY_USD", 0.02)
    r = rd(client)
    assert r.status_code == 429 and actor.calls == []
    monkeypatch.setattr(server, "DAILY_APIFY_USD", 0.035)  # the search fits, the subreddit medians do not
    actor.search = [post("a")]
    assert rd(client, "other").status_code == 200
    assert actor.sub_calls() == [] and rd(client, "other").json()["videos"][0]["outlier"] is None


def test_cached_only_never_calls_the_actor(client, actor):
    r = rd(client, cachedOnly="1")
    assert r.status_code == 404 and actor.calls == []


def test_a_failed_search_is_a_502(client, monkeypatch):
    def boom(payload, max_items, actor=None):
        raise RuntimeError("Apify returned 500")

    monkeypatch.setattr(server, "run_actor", boom)
    assert rd(client).status_code == 502


def test_reddit_needs_the_token_and_has_its_own_cache(client, monkeypatch):
    assert len({server.cache_name("tofu", p) for p in ("tiktok", "instagram", "youtube", "reddit")}) == 4
    monkeypatch.setattr(server, "TOKEN", "")
    assert rd(client).status_code == 503


def test_health_lists_reddit(client):
    assert "reddit" in client.get("/api/health").json()["platforms"]


@pytest.mark.parametrize("url", ["https://www.reddit.com/r/tofu/comments/abc/x/", "https://v.redd.it/abc"])
def test_analyze_takes_a_reddit_link(client, monkeypatch, url):
    queued = []
    monkeypatch.setattr(server.jobs, "submit", lambda u: queued.append(u) or "job1")
    assert client.post("/api/analyze", json={"url": url}).status_code == 200 and queued == [url]


def test_real_actor_output_is_mapped(actor):
    """Posts and subreddit rows from real runs (2026-10-27), trimmed: every search row is a hosted video."""
    import json
    from pathlib import Path
    fx = Path(__file__).parent / "fixtures"
    real = json.loads((fx / "reddit_search_real.json").read_text())
    actor.search = real
    videos = reddit.search_posts(server.run_actor, "tofu", server.REDDIT_ACTOR)
    assert len(videos) == len(real) == 5 and all(v["cover"].startswith("https://") and v["duration"] for v in videos)
    assert videos[0]["upvotes"] == real[0]["score"] and videos[0]["community"] == real[0]["subreddit"]
    rows = json.loads((fx / "reddit_subs_real.json").read_text())
    server.run_actor.subs = {}
    monkey = lambda payload, max_items, actor=None: rows
    assert reddit.fetch_subreddits(monkey, ["RATS", "SteamDeck"], "x") == {"RATS": pytest.approx(
        sorted(r["score"] for r in rows if r["subreddit"] == "RATS")[4] / 2 + sorted(r["score"] for r in rows if r["subreddit"] == "RATS")[5] / 2)}
