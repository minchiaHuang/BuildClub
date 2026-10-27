import json
import subprocess
import time

import pytest

import channels
import server
from conftest import fake_subprocess

IDS = ["aaa111", "bbb222", "ccc333"]


def put(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(obj, bytes):
        path.write_bytes(obj)
    else:
        path.write_text(json.dumps(obj))


class FakeDecoder:
    """Stands in for subprocess.run: writes the files each channel-decoder step would write."""

    def __init__(self, jobs=None, videos=IDS, fail_on=None, yt_dlp_id="MS4wLjABAAAAfake"):
        self.calls, self.jobs, self.videos, self.fail_on, self.yt_dlp_id = [], jobs, videos, fail_on, yt_dlp_id
        self.seen_status = []

    def __call__(self, cmd, **kwargs):
        self.calls.append(cmd)
        if self.jobs:  # what the API would show while this step runs
            self.seen_status.append((cmd[3] if "channel_decoder" in cmd else "yt-dlp",
                                     self.jobs.get(channels.job_id_for(*self.key)).status))
        if "-J" in cmd:  # yt-dlp on a TikTok profile
            out = json.dumps({"id": self.yt_dlp_id, "entries": [{"channel_id": self.yt_dlp_id}]})
            return subprocess.CompletedProcess(cmd, 0, out, "")
        step, work = cmd[3], channels.Path(cmd[cmd.index("--data") + 1])
        assert kwargs["cwd"] == channels.DECODER_DIR
        assert set(kwargs["env"]) <= {"PATH", "HOME", "SCRAPECREATORS_API_KEY", "TYPESAFE_API_KEY", "LANG",
                                      "LC_ALL", "TMPDIR"}
        if step == self.fail_on:
            return subprocess.CompletedProcess(cmd, 1, "", "boom: network down")
        if step == "fetch":
            put(work / "videos.json", [{"id": i, "url": f"https://x/{i}", "handle": "chan", "platform": "youtube",
                                        "plays": 1000 * n, "posted": "2026-10-01", "caption": "c", "duration": 30}
                                       for n, i in enumerate(self.videos, 1)])
        elif step == "details":
            for i in self.videos:
                put(work / "details" / f"{i}.json", {"likes": 5})
                put(work / "thumbs" / f"{i}.jpg", b"jpg")
        elif step == "transcribe":
            for i in self.videos:
                put(work / "transcripts" / f"{i}.json", {"sentences": [{"text": "hello there", "start": 0, "end": 1}]})
        elif step == "label" and "--dry-run" in cmd:
            n = sum(1 for i in self.videos if not (work / "labels" / f"{i}.json").exists())
            return subprocess.CompletedProcess(cmd, 0, f"videos: {n}  calls: {2 * n}  est. tokens: 900  est. USD: $0.0100\n", "")
        elif step == "label":
            assert float(cmd[cmd.index("--max-usd") + 1]) == 0.02
            for i in self.videos:
                put(work / "labels" / f"{i}.json", {"format": "Taste test"})
        elif step == "aggregate":
            put(work / "analysis.json", {
                "summary": {"handle": "chan", "platform": "youtube", "videos_decoded": len(self.videos)},
                "videos": [{"id": i, "plays": 1, "thumbnail": f"/api/script-analysis/thumb/{i}.jpg",
                            "why_it_works": "w", "steal_this": "s"} for i in self.videos],
                "formats": [{"format": "Taste test", "count": len(self.videos), "top_video_ids": self.videos}]})
        return subprocess.CompletedProcess(cmd, 0, "", "")


def fake_naming(content):
    ids = [w.rstrip(",") for w in content.split("Write notes for these ids: ")[1].split("\n")[0].split()]
    return channels.ChannelNaming(
        formats=[channels.FormatName(name="Taste test", description="Someone tries a food on camera")],
        notes=[channels.VideoNote(id=i, why_it_works="because", steal_this="borrow it") for i in ids]
              + [channels.VideoNote(id="../evil", why_it_works="x", steal_this="y")])


@pytest.fixture
def money():
    """A wallet that remembers what was spent. Plenty in every wallet unless a test lowers it."""
    class Money:
        spent, left_in = [], {"claude": 1.0, "jev": 1.0, "scrapecreators": 20.0}

        def spend(self, wallet, amount):
            if amount > self.left_in[wallet]:
                return False
            self.left_in[wallet] -= amount
            self.spent.append((wallet, amount))
            return True

        def left(self, wallet):
            return self.left_in[wallet]
    m = Money()
    m.spent, m.left_in = [], {"claude": 1.0, "jev": 1.0, "scrapecreators": 20.0}
    return m


@pytest.fixture
def decoder(monkeypatch):
    fake = FakeDecoder()
    fake.key = ("youtube", "chan")
    monkeypatch.setattr(channels, "subprocess", fake_subprocess(fake))
    monkeypatch.setattr(channels, "ask_claude", fake_naming)
    return fake


def make_jobs(money):
    return channels.ChannelJobs(money.spend, money.left)


def wait(jobs, job_id, timeout=5):
    end = time.time() + timeout
    while time.time() < end:
        job = jobs.get(job_id)
        if job.status in ("done", "failed"):
            return job
        time.sleep(0.02)
    raise AssertionError("job did not finish")


def steps(fake):
    return [c[3] + (" --dry-run" if "--dry-run" in c else "") for c in fake.calls if "channel_decoder" in c]


# -- handles and links

@pytest.mark.parametrize("platform,raw,handle", [
    ("youtube", "@MrBeast", "MrBeast"),
    ("youtube", "mrbeast", "mrbeast"),
    ("youtube", "https://www.youtube.com/@MrBeast/shorts", "MrBeast"),
    ("youtube", "youtube.com/@mr.beast", "mr.beast"),
    ("tiktok", "  @some_one.1 ", "some_one.1"),
    ("tiktok", "https://www.tiktok.com/@some_one.1/video/123?lang=en", "some_one.1"),
    ("tiktok", "tiktok.com/@a", "a"),
    ("instagram", "https://www.instagram.com/ollysung/", "ollysung"),
    ("instagram", "@ollysung", "ollysung"),
])
def test_handles_and_links_are_normalised(platform, raw, handle):
    assert channels.normalise(platform, raw) == handle


@pytest.mark.parametrize("platform,raw", [
    ("youtube", ""), ("youtube", "   "), ("youtube", "two words"), ("youtube", "@a/b"),
    ("youtube", "https://www.tiktok.com/@a"), ("youtube", "https://youtube.com/channel/UCabc"),
    ("youtube", "https://evilyoutube.com/@a"), ("tiktok", "https://www.instagram.com/a"),
    ("instagram", "https://www.instagram.com/reel/abc/"), ("youtube", "a" * 61), ("vimeo", "@a"),
    ("youtube", "../../etc"), ("tiktok", "name; rm -rf"),
])
def test_bad_handles_are_refused(platform, raw):
    with pytest.raises(ValueError):
        channels.normalise(platform, raw)


def test_the_job_id_is_the_same_for_the_same_channel():
    assert channels.job_id_for("youtube", "MrBeast") == channels.job_id_for("youtube", "mrbeast")
    assert channels.job_id_for("youtube", "a") != channels.job_id_for("tiktok", "a")
    assert len(channels.job_id_for("youtube", "a")) == 12


# -- the daily caps

def test_over_the_cap_is_429_before_any_subprocess(client, decoder, monkeypatch):
    monkeypatch.setattr(server, "channel_jobs", channels.ChannelJobs(
        lambda w, n: server.spend(w, n, server.CHANNEL_CAPS[w]), lambda w: server.budget_left(w, server.CHANNEL_CAPS[w])))
    monkeypatch.setitem(server.CHANNEL_CAPS, "claude", 0)
    r = client.post("/api/channel", json={"platform": "youtube", "handle": "@chan"})
    assert r.status_code == 429
    assert "DAILY_CLAUDE_USD" in r.json()["detail"]
    assert decoder.calls == []


def test_jev_and_scrapecreators_have_their_own_caps(client, decoder, monkeypatch):
    monkeypatch.setattr(server, "channel_jobs", channels.ChannelJobs(
        lambda w, n: server.spend(w, n, server.CHANNEL_CAPS[w]), lambda w: server.budget_left(w, server.CHANNEL_CAPS[w])))
    monkeypatch.setitem(server.CHANNEL_CAPS, "jev", 0)
    r = client.post("/api/channel", json={"platform": "youtube", "handle": "chan"})
    assert r.status_code == 429 and "DAILY_JEV_USD" in r.json()["detail"]
    monkeypatch.setitem(server.CHANNEL_CAPS, "jev", 1)
    monkeypatch.setitem(server.CHANNEL_CAPS, "scrapecreators", 0)
    r = client.post("/api/channel", json={"platform": "instagram", "handle": "chan"})
    assert r.status_code == 429 and "DAILY_SCRAPECREATORS_CREDITS" in r.json()["detail"]
    assert decoder.calls == []


def test_small_spends_are_counted_to_four_places(client):
    assert server.spend("jev", 0.0075, 0.5) and server.spend("jev", 0.0075, 0.5)
    assert server.load(f"spend:{server.today()}") == {"jev": 0.015}


def test_a_job_stops_when_jev_runs_out_after_the_free_steps(money, decoder):
    jobs = make_jobs(money)
    decoder.jobs, decoder.key = jobs, ("youtube", "chan")
    money.left_in["jev"] = 0.015  # passes the up-front check, but the label estimate (0.02) does not fit
    job = wait(jobs, jobs.submit("youtube", "chan"))
    assert job.status == "failed" and "DAILY_JEV_USD" in job.error
    assert "label" not in steps(decoder) and money.spent == []  # nothing paid, Claude never called


@pytest.mark.parametrize("raw,bad", [({"platform": "youtube", "handle": "chan", "maxVideos": 0}, True),
                                    ({"platform": "youtube", "handle": "chan", "maxVideos": 101}, True),
                                    ({"platform": "youtube", "handle": "@@@", "maxVideos": 50}, True),
                                    ({"platform": "vimeo", "handle": "chan"}, True)])
def test_bad_requests_are_400_or_422(client, raw, bad):
    assert client.post("/api/channel", json=raw).status_code in (400, 422)


# -- the lifecycle

def test_a_job_goes_queued_running_done(money, decoder):
    jobs = make_jobs(money)
    decoder.jobs = jobs
    job_id = jobs.submit("youtube", "chan")
    assert job_id == channels.job_id_for("youtube", "chan")
    assert jobs.get(job_id).status in ("queued", "running")
    job = wait(jobs, job_id)
    assert job.status == "done" and job.result["summary"]["videos_decoded"] == 3
    assert steps(decoder) == ["fetch", "details", "transcribe", "label --dry-run", "label", "aggregate"]
    assert {s for _, s in decoder.seen_status} == {"running"}
    fetch = next(c for c in decoder.calls if "fetch" in c)
    assert fetch[fetch.index("--max-videos") + 1] == "50" and fetch[fetch.index("--platform") + 1] == "youtube"
    assert job.steps[0] == "Listing videos" and job.stepIndex == len(job.steps) - 1


def test_the_spend_is_counted_before_each_paid_step(money, decoder):
    jobs = make_jobs(money)
    wait(jobs, jobs.submit("youtube", "chan"))
    assert money.spent == [("jev", 0.02), ("claude", channels.NAMING_USD)]


def test_naming_writes_the_files_label_and_aggregate_read(money, decoder):
    jobs = make_jobs(money)
    job_id = jobs.submit("youtube", "chan")
    wait(jobs, job_id)
    work = channels.CHANNELS_DIR / job_id
    assert json.loads((work / "format-names.json").read_text()) == [
        {"name": "Taste test", "description": "Someone tries a food on camera"}]
    assert json.loads((work / "notes" / "aaa111.json").read_text()) == {"why_it_works": "because", "steal_this": "borrow it"}
    assert sorted(p.name for p in (work / "notes").iterdir()) == [f"{i}.json" for i in IDS]  # "../evil" was ignored
    assert not (channels.CHANNELS_DIR / "evil.json").exists() and not (work / "evil.json").exists()


def test_thumbnails_point_at_this_api(money, decoder):
    jobs = make_jobs(money)
    job_id = jobs.submit("youtube", "chan")
    video = wait(jobs, job_id).result["videos"][0]
    assert video["thumbnail"] == f"/api/channel/{job_id}/thumb/aaa111.jpg"
    (channels.CHANNELS_DIR / job_id / "thumbs" / "aaa111.jpg").unlink()
    assert jobs.get(job_id).result["videos"][0]["thumbnail"] is None


def test_tiktok_finds_the_channel_id_by_itself(money, decoder):
    decoder.key = ("tiktok", "chan")
    jobs = make_jobs(money)
    job_id = jobs.submit("tiktok", "chan")
    job = wait(jobs, job_id)
    assert job.status == "done" and job.steps[0] == "Finding the channel"
    assert (channels.CHANNELS_DIR / job_id / "accounts.txt").read_text() == "chan MS4wLjABAAAAfake\n"
    assert "-J" in decoder.calls[0] and "https://www.tiktok.com/@chan" in decoder.calls[0]


def test_a_tiktok_profile_that_does_not_exist_fails_politely(money, decoder):
    decoder.key, decoder.yt_dlp_id = ("tiktok", "nobody"), ""
    jobs = make_jobs(money)
    job = wait(jobs, jobs.submit("tiktok", "nobody"))
    assert job.status == "failed" and "@nobody" in job.error
    assert steps(decoder) == []


def test_instagram_pays_one_credit_per_12_reels(money, decoder):
    decoder.key = ("instagram", "chan")
    jobs = make_jobs(money)
    wait(jobs, jobs.submit("instagram", "chan", 50))
    assert money.spent[0] == ("scrapecreators", 5)


def test_a_failed_step_fails_the_job_with_the_reason(money, decoder):
    decoder.fail_on = "details"
    jobs = make_jobs(money)
    job = wait(jobs, jobs.submit("youtube", "chan"))
    assert job.status == "failed" and "details failed" in job.error and "network down" in job.error
    assert money.spent == []


def test_no_videos_fails_the_job(money, decoder):
    decoder.videos = []
    jobs = make_jobs(money)
    job = wait(jobs, jobs.submit("youtube", "chan"))
    assert job.status == "failed" and "No videos found" in job.error


# -- resume, restart and the cache

def test_a_failed_job_resumes_without_redoing_or_repaying(money, decoder):
    jobs = make_jobs(money)
    decoder.fail_on = "aggregate"
    job_id = jobs.submit("youtube", "chan")
    assert wait(jobs, job_id).status == "failed"
    paid, before = list(money.spent), len(decoder.calls)
    decoder.fail_on = None
    assert jobs.submit("youtube", "chan") == job_id  # the same click again picks it up
    deadline = time.time() + 5
    while jobs.get(job_id).status != "done" and time.time() < deadline:
        time.sleep(0.02)
    assert jobs.get(job_id).status == "done"
    again = steps(decoder)[before - len([c for c in decoder.calls if "-J" in c]):]
    assert "fetch" not in again and "transcribe" in again  # the free steps run again but skip finished videos
    assert [p for p in money.spent if p[0] == "claude"] == [p for p in paid if p[0] == "claude"]  # naming not paid twice


def test_a_new_api_process_reads_a_finished_job_from_disk(money, decoder):
    jobs = make_jobs(money)
    job_id = jobs.submit("youtube", "chan")
    wait(jobs, job_id)
    n = len(decoder.calls)
    restarted = make_jobs(money)
    assert restarted.get(job_id).status == "done" and restarted.get(job_id).result["summary"]["handle"] == "chan"
    assert restarted.submit("youtube", "chan") == job_id and len(decoder.calls) == n  # fresh: nothing runs


def test_a_job_cut_off_by_a_restart_says_so_and_can_be_resumed(money, decoder):
    work = channels.CHANNELS_DIR / channels.job_id_for("youtube", "chan")
    put(work / "meta.json", {"platform": "youtube", "handle": "chan", "maxVideos": 50, "status": "running",
                             "fetched": True})
    put(work / "videos.json", [{"id": i, "url": "u", "handle": "chan", "plays": 1} for i in IDS])
    for i in IDS:
        put(work / "details" / f"{i}.json", {})
        put(work / "thumbs" / f"{i}.jpg", b"x")
    jobs = make_jobs(money)
    job_id = channels.job_id_for("youtube", "chan")
    assert jobs.get(job_id).status == "failed" and "restarted" in jobs.get(job_id).error
    jobs.submit("youtube", "chan")
    assert wait(jobs, job_id).status == "done"
    assert "fetch" not in steps(decoder)  # the listing was already on disk
    assert "details" in steps(decoder)  # which decoder skips video by video


def test_a_channel_is_cached_for_seven_days(money, decoder):
    jobs = make_jobs(money)
    job_id = jobs.submit("youtube", "chan")
    wait(jobs, job_id)
    n, spent = len(decoder.calls), len(money.spent)
    assert jobs.submit("youtube", "chan") == job_id
    assert len(decoder.calls) == n and len(money.spent) == spent

    meta_path = channels.CHANNELS_DIR / job_id / "meta.json"
    meta = json.loads(meta_path.read_text())
    meta_path.write_text(json.dumps({**meta, "finishedAt": time.time() - 8 * 86400}))
    jobs2 = make_jobs(money)
    assert jobs2.submit("youtube", "chan") == job_id
    wait_for = time.time() + 5
    while len(decoder.calls) == n and time.time() < wait_for:
        time.sleep(0.02)
    assert len(decoder.calls) > n  # stale: decoded again


def test_asking_for_more_videos_than_the_cached_run_decodes_again(money, decoder):
    jobs = make_jobs(money)
    job_id = jobs.submit("youtube", "chan", 5)
    wait(jobs, job_id)
    n = len(decoder.calls)
    assert jobs.submit("youtube", "chan", 5) == job_id and len(decoder.calls) == n
    jobs.submit("youtube", "chan", 100)
    end = time.time() + 5
    while len(decoder.calls) == n and time.time() < end:
        time.sleep(0.02)
    fetch = [c for c in decoder.calls if "fetch" in c][-1]
    assert fetch[fetch.index("--max-videos") + 1] == "100"


# -- the HTTP API

def test_the_api_starts_polls_and_serves_thumbnails(client, money, decoder, monkeypatch):
    monkeypatch.setattr(server, "channel_jobs", make_jobs(money))
    r = client.post("/api/channel", json={"platform": "youtube", "handle": "https://www.youtube.com/@chan"})
    assert r.status_code == 200
    job_id = r.json()["job"]
    end = time.time() + 5
    body = {}
    while time.time() < end:
        body = client.get(f"/api/channel/{job_id}").json()
        if body["status"] in ("done", "failed"):
            break
        time.sleep(0.02)
    assert body["status"] == "done" and body["result"]["formats"][0]["format"] == "Taste test"
    thumb = client.get(body["result"]["videos"][0]["thumbnail"])
    assert thumb.status_code == 200 and thumb.content == b"jpg" and thumb.headers["content-type"] == "image/jpeg"


def test_unknown_job_is_404(client):
    assert client.get("/api/channel/nope").status_code == 404
    assert client.get("/api/channel/0123456789ab").status_code == 404


@pytest.mark.parametrize("name", ["..%2F..%2Fmeta.json", "..%2Fmeta.jpg", "aaa111", "aaa111.png", "aaa111.JPG",
                                  "a.b.jpg", "%2e%2e.jpg", "aaa111.jpg%00", "aaa 111.jpg", "nothere.jpg", ".jpg"])
def test_a_bad_thumbnail_name_is_404(client, money, decoder, monkeypatch, name):
    jobs = make_jobs(money)
    monkeypatch.setattr(server, "channel_jobs", jobs)
    job_id = jobs.submit("youtube", "chan")
    wait(jobs, job_id)
    put(channels.CHANNELS_DIR / job_id / "meta.jpg", b"secret")
    assert client.get(f"/api/channel/{job_id}/thumb/{name}").status_code == 404
    assert client.get(f"/api/channel/{job_id}/thumb/aaa111.jpg").status_code == 200
    assert client.get(f"/api/channel/..%2Fx/thumb/aaa111.jpg").status_code == 404
