"""YouTube search with a fake yt-dlp: no network, no Apify."""

import json
from types import SimpleNamespace

import pytest

import server
import youtube
from models import SearchResult


def entry(vid, channel="UC1", views=1000, duration=30, name="Chan"):
    """One flat-playlist search entry, as yt-dlp returns it."""
    return {"id": vid, "url": f"https://www.youtube.com/watch?v={vid}", "title": f"Tofu #{vid} #shorts",
            "duration": duration, "channel_id": channel, "channel": name, "view_count": views}


def channel_page(views, subs=5000):
    return {"channel_follower_count": subs, "entries": [{"id": f"s{n}", "view_count": v} for n, v in enumerate(views)]}


@pytest.fixture
def ytdlp(monkeypatch):
    """A fake yt-dlp. Set .search (list of entries) and .channels ({channel id: page or Exception})."""
    class Fake:
        def __init__(self):
            self.search, self.channels, self.calls = [], {}, []

        def __call__(self, args, timeout=60):
            self.calls.append(args)
            target = args[-1]
            if target.startswith("ytsearch"):
                return {"entries": self.search}
            page = self.channels[target.split("/channel/")[1].removesuffix("/shorts")]
            if isinstance(page, Exception):
                raise page
            return page

        def channel_calls(self):
            return [c[-1] for c in self.calls if c[-1].endswith("/shorts")]

    fake = Fake()
    monkeypatch.setattr(youtube, "run_json", fake)
    monkeypatch.setattr(server, "TOKEN", "")  # YouTube needs no Apify token
    return fake


def yt_search(client, q="tofu", **extra):
    return client.get("/api/search", params={"q": q, "platform": "youtube", **extra})


def test_shorts_are_mapped_to_the_search_shape(ytdlp):
    ytdlp.search = [entry("abc", views=5000, duration=42, name="Tofu Co")]
    [v] = youtube.search_shorts("tofu")
    assert v["id"] == "abc" and v["url"] == "https://www.youtube.com/shorts/abc"
    assert v["cover"] == "https://i.ytimg.com/vi/abc/hqdefault.jpg"
    assert (v["plays"], v["author"], v["channelId"], v["duration"]) == (5000, "Tofu Co", "UC1", 42)
    assert v["text"] == "Tofu #abc #shorts" and v["hashtags"] == ["abc", "shorts"]
    assert v["followers"] is None and v["ratio"] is None and v["createTime"] is None
    assert "ytsearch120:tofu #shorts" in ytdlp.calls[0]


def test_only_shorts_are_kept_and_capped(ytdlp):
    ytdlp.search = [entry("long", duration=286), entry("edge", duration=60), entry("nodur", duration=None),
                    entry("noviews", views=None), entry("edge", duration=60)] + \
                   [entry(f"s{n}", views=n) for n in range(100)]
    ids = [v["id"] for v in youtube.search_shorts("tofu")]
    assert "long" not in ids and "noviews" not in ids
    assert ids.count("edge") == 1
    ytdlp.search = [entry("long", duration=286), entry("edge", duration=60), entry("nodur", duration=None)]
    assert [v["id"] for v in youtube.search_shorts("tofu")] == ["edge", "nodur"]
    ytdlp.search = [entry(f"s{n}") for n in range(100)]
    assert len(youtube.search_shorts("tofu")) == youtube.RESULTS == 30


def test_channel_stats_use_the_median_of_recent_shorts(ytdlp):
    ytdlp.channels = {"UC1": channel_page([100, 200, 300, 400, 500], subs=77), "UC2": channel_page([1, 2], subs=9)}
    assert youtube.channel_stats("UC1") == (300, 77)
    assert youtube.channel_stats("UC2") == (None, 9)  # too few Shorts for a median
    ytdlp.channels["UC3"] = RuntimeError("yt-dlp failed: ERROR: UC3: This channel does not have a shorts tab")
    assert youtube.channel_stats("UC3") == (None, None)
    assert "--playlist-end" in ytdlp.calls[0] and ytdlp.channel_calls()[0].endswith("/channel/UC1/shorts")


def test_live_search_returns_first_then_fills_scores(client, ytdlp):
    ytdlp.search = [entry("a", "UC1", views=9000, name="small"), entry("b", "UC2", views=1000, name="big")]
    ytdlp.channels = {"UC1": channel_page([100, 200, 300, 400, 500], subs=10), "UC2": channel_page([10, 20], subs=9)}
    r = yt_search(client)
    assert r.status_code == 200 and r.json()["platform"] == "youtube"
    assert r.json()["mediansPending"] is True and r.json()["videos"][0]["outlier"] is None  # scores come after
    body = yt_search(client).json()  # the fill has run (inline in tests); the cache now holds the scores
    assert body["cached"] is True and body["mediansPending"] is False
    small, big = body["videos"]
    assert (small["medianViews"], small["outlier"], small["followers"]) == (300, 30, 10)
    assert (big["medianViews"], big["outlier"], big["followers"]) == (None, None, 9)
    assert SearchResult.model_validate(body)


def test_nothing_is_spent_on_youtube(client, ytdlp, monkeypatch):
    monkeypatch.setattr(server, "spend", lambda *a: pytest.fail("YouTube is free"))
    ytdlp.search = [entry("a")]
    ytdlp.channels = {"UC1": channel_page([1, 2, 3, 4, 5])}
    assert yt_search(client).status_code == 200


def test_channel_medians_are_reused_for_a_week(client, ytdlp):
    ytdlp.channels = {"UC1": channel_page([100] * 5), "UC2": channel_page([100] * 5)}
    ytdlp.search = [entry("a", "UC1"), entry("b", "UC2")]
    yt_search(client)
    ytdlp.search = [entry("c", "UC2", views=500)]
    ytdlp.calls.clear()
    r = yt_search(client, "miso")
    assert r.json()["videos"][0]["outlier"] == 5 and r.json()["mediansPending"] is False  # scored at once
    assert ytdlp.channel_calls() == []

    with server.db() as conn:  # a week later the channel is fetched again
        conn.execute("UPDATE youtube_channels SET fetched_at = fetched_at - ?", (server.MEDIAN_DAYS * 86400 + 1,))
    yt_search(client, "miso", fresh="1")
    assert ytdlp.channel_calls()[-1].endswith("/channel/UC2/shorts")


def test_a_failed_channel_is_not_saved_and_keeps_the_search(client, ytdlp):
    ytdlp.search = [entry("a", "UC1")]
    ytdlp.channels = {"UC1": RuntimeError("HTTP 429")}
    assert yt_search(client).status_code == 200
    assert yt_search(client).json()["videos"][0]["outlier"] is None
    assert youtube.saved(server.db, ["UC1"], server.MEDIAN_DAYS) == {}


def test_a_failed_search_is_a_502(client, ytdlp, monkeypatch):
    def boom(args, timeout=60):
        raise RuntimeError("yt-dlp failed")

    monkeypatch.setattr(youtube, "run_json", boom)
    assert yt_search(client).status_code == 502


def test_cached_only_never_runs_yt_dlp(client, ytdlp):
    r = yt_search(client, cachedOnly="1")
    assert r.status_code == 404 and ytdlp.calls == []


def test_youtube_cache_is_kept_apart():
    assert len({server.cache_name("tofu", p) for p in ("tiktok", "instagram", "youtube")}) == 3


def test_health_is_live_with_yt_dlp_alone(client, monkeypatch):
    monkeypatch.setattr(server, "TOKEN", "")
    monkeypatch.setattr(server.shutil, "which", lambda name: "/bin/yt-dlp")
    body = client.get("/api/health").json()
    assert body["live"] is True and "youtube" in body["platforms"]


def test_run_json_reads_yt_dlp_output(monkeypatch):
    monkeypatch.setattr(youtube.subprocess, "run", lambda cmd, **kw: SimpleNamespace(
        returncode=0, stdout=json.dumps({"entries": []}), stderr=""))
    assert youtube.run_json(["x"]) == {"entries": []}
    monkeypatch.setattr(youtube.subprocess, "run", lambda cmd, **kw: SimpleNamespace(
        returncode=1, stdout="", stderr="ERROR: boom"))
    with pytest.raises(RuntimeError, match="boom"):
        youtube.run_json(["x"])


def test_health_reports_demo_mode(client, monkeypatch):
    monkeypatch.delenv("REMAKE_DEMO", raising=False)
    assert client.get("/api/health").json()["demo"] is False
    monkeypatch.setenv("REMAKE_DEMO", "1")
    assert client.get("/api/health").json()["demo"] is True
