import json
from pathlib import Path

import server
import instagram

# synthetic: built from the field names documented for apify~instagram-reel-scraper
# (ownerUsername, videoPlayCount, videoViewCount, timestamp); not a real scrape.
# followersCount is optional and not documented by the actor, so it is only read when present.
REELS = json.loads((Path(__file__).parent / "fixtures" / "instagram_reels_synthetic.json").read_text())


def search_item(n, author, plays=1000):
    return {"id": str(n), "url": f"https://www.instagram.com/reel/S{n}/", "ownerUsername": author,
            "videoPlayCount": plays, "timestamp": "2026-10-25T00:00:00.000Z"}


def reel_item(n, author, plays=100):
    return {"id": f"r{n}", "url": f"https://www.instagram.com/reel/R{n}/", "ownerUsername": author,
            "videoPlayCount": plays, "timestamp": f"2026-10-{10 + n:02d}T00:00:00.000Z"}


def fake_ig(calls, authors):
    def fake_actor(payload, max_items, actor=None, max_usd=None):
        calls.append((payload, actor, max_items, max_usd))
        if actor == server.IG_ACTOR:
            return [search_item(n, a) for n, a in enumerate(authors)]
        if actor == instagram.PROFILE_ACTOR:
            return [{"username": a, "followersCount": 50} for a in payload["usernames"]]
        return [reel_item(n, a) for a in payload["username"] for n in range(6)]
    return fake_actor


def test_ig_baseline_records_count_dates_and_followers():
    found = instagram.baselines(REELS)
    assert found["alice"] == {"median": 350, "n": 6, "from": "2026-09-30", "to": "2026-10-20", "followers": 12000}


def test_ig_baseline_needs_five_reels():
    assert "bob" not in instagram.baselines(REELS)  # 3 reels
    assert instagram.baselines([{**r, "videoPlayCount": None, "videoViewCount": 7} for r in REELS[:5]])["alice"]["median"] == 7


def test_ig_search_fills_baselines_in_background(client, monkeypatch):
    calls = []
    monkeypatch.setattr(server, "run_actor", fake_ig(calls, ["a", "b"]))
    r = client.get("/api/search", params={"q": "tofu", "platform": "instagram"}).json()
    assert [c[1] for c in calls] == [server.IG_ACTOR, instagram.PROFILE_ACTOR, instagram.REEL_ACTOR]
    assert calls[2][0]["username"] == ["a", "b"] and calls[2][0]["resultsLimit"] == instagram.REELS_PER_ACCOUNT
    assert calls[2][3] == server.MAX_USD_PER_MEDIANS
    assert r["mediansPending"] is True
    cached = client.get("/api/search", params={"q": "tofu", "platform": "instagram"}).json()
    assert cached["mediansPending"] is False
    video = cached["videos"][0]
    assert video["denominator"] == "median" and video["medianN"] == 6 and video["medianViews"] == 100
    assert video["outlier"] == 10 and video["baselineFrom"] == "2026-10-10" and video["baselineTo"] == "2026-10-15"
    assert video["medianFetchedAt"]


def test_ig_search_fetches_at_most_a_batch_of_accounts(client, monkeypatch):
    calls = []
    authors = [f"u{n}" for n in range(instagram.ACCOUNTS_PER_FILL + 5)]
    monkeypatch.setattr(server, "run_actor", fake_ig(calls, authors))
    client.get("/api/search", params={"q": "tofu", "platform": "instagram"})
    assert len(calls[1][0]["usernames"]) == instagram.ACCOUNTS_PER_FILL
    assert len(calls[2][0]["username"]) == instagram.ACCOUNTS_PER_FILL


def test_ig_baselines_skip_over_budget(client, monkeypatch):
    calls = []
    monkeypatch.setattr(server, "run_actor", fake_ig(calls, ["a"]))
    monkeypatch.setattr(server, "DAILY_APIFY_USD", server.SEARCH_USD["instagram"])  # the search used it all
    client.get("/api/search", params={"q": "tofu", "platform": "instagram"})
    assert [c[1] for c in calls] == [server.IG_ACTOR]
    video = client.get("/api/search", params={"q": "tofu", "platform": "instagram"}).json()["videos"][0]
    assert video["denominator"] is None


def test_ig_and_tiktok_medians_do_not_collide():
    server.save_medians({"a": {"median": 5, "n": 5, "from": None, "to": None}})
    instagram.save(server.db, {"a": {"median": 900, "n": 6, "from": "2026-10-01", "to": "2026-10-02", "followers": 10}})
    assert server.saved_medians(["a"])["a"]["median"] == 5
    assert instagram.saved(server.db, ["a"], 30)["a"]["median"] == 900


def test_parse_followers_keeps_only_positive_counts():
    items = [{"username": "a", "followersCount": 1200}, {"username": "b", "followersCount": 0},
             {"username": "c"}, {"username": "d", "followersCount": 5, "error": "x"}, None]
    assert instagram.parse_followers(items) == {"a": 1200}


def test_ig_search_fills_followers_and_ratio(client, monkeypatch):
    calls = []
    monkeypatch.setattr(server, "run_actor", fake_ig(calls, ["a", "b"]))
    client.get("/api/search", params={"q": "tofu", "platform": "instagram"})
    video = client.get("/api/search", params={"q": "tofu", "platform": "instagram"}).json()["videos"][0]
    assert video["followers"] == 50 and video["ratio"] == 20.0  # 1000 plays / 50 followers
    profile_call = next(c for c in calls if c[1] == instagram.PROFILE_ACTOR)
    assert profile_call[0] == {"usernames": ["a", "b"]} and profile_call[3] == instagram.MAX_USD_PER_PROFILES


def test_ig_followers_are_cached_between_searches(client, monkeypatch):
    calls = []
    monkeypatch.setattr(server, "run_actor", fake_ig(calls, ["a", "b"]))
    client.get("/api/search", params={"q": "tofu", "platform": "instagram"})
    client.get("/api/search", params={"q": "tofu again", "platform": "instagram"})
    assert sum(1 for c in calls if c[1] == instagram.PROFILE_ACTOR) == 1
    video = client.get("/api/search", params={"q": "tofu again", "platform": "instagram", "cachedOnly": "1"}).json()["videos"][0]
    assert video["followers"] == 50


def test_ig_followers_failure_leaves_videos_unscored(client, monkeypatch):
    calls = []
    inner = fake_ig(calls, ["a"])

    def flaky(payload, max_items, actor=None, max_usd=None):
        if actor == instagram.PROFILE_ACTOR:
            raise RuntimeError("Apify returned 500")
        return inner(payload, max_items, actor, max_usd)

    monkeypatch.setattr(server, "run_actor", flaky)
    client.get("/api/search", params={"q": "tofu", "platform": "instagram"})
    video = client.get("/api/search", params={"q": "tofu", "platform": "instagram"}).json()["videos"][0]
    assert video["followers"] is None and video["ratio"] is None
    assert instagram.saved_followers(server.db, ["a"], 30) == {}
