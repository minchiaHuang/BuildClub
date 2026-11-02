"""Subtitles: cue timing remap, grouping, .srt, cue pictures, saved cues and their routes."""

import json

import pytest

import renders
import server
import subtitles
from subtitles import BurnStyle
from test_renders import setup, fake_render, wait_for, start, with_take, cut_dir  # noqa: F401
from test_auth import add_user  # noqa: F401


def test_remap_speed_and_removed_gap():
    words = [(0.0, 1.0, "hello"), (1.0, 1.3, "um"), (2.9, 3.5, "world")]
    keeps = [(0.0, 1.0), (2.78, 3.5)]  # the "um" and the gap were cut
    out = subtitles.remap_words(words, keeps, 1.0)
    assert out == [(0.0, 1.0, "hello"), (pytest.approx(1.12), pytest.approx(1.72), "world")]
    fast = subtitles.remap_words(words, keeps, 1.25)
    assert fast[1][0] == pytest.approx(1.12 / 1.25) and fast[1][1] == pytest.approx(1.72 / 1.25)


def test_remap_drops_word_inside_removed_gap():
    assert subtitles.remap_words([(1.0, 1.5, "ghost")], [(0.0, 0.8), (2.0, 3.0)], 1.0) == []


def test_group_breaks_on_width_duration_gap_and_sentence():
    many = [(i * 0.3, i * 0.3 + 0.25, "word") for i in range(12)]  # 12 words, 3.55 s, 59 wide
    cues = subtitles.group_cues(many)
    assert len(cues) >= 2 and all(subtitles.width_units(c["text"]) <= subtitles.MAX_UNITS for c in cues)
    slow = [(i * 1.0, i * 1.0 + 0.5, "a") for i in range(6)]  # 0.5 s pauses: under the gap, over max duration
    assert all(c["end"] - c["start"] <= subtitles.MAX_CUE_SEC for c in subtitles.group_cues(slow))
    gap = subtitles.group_cues([(0, 0.4, "one"), (2.0, 2.4, "two")])
    assert [c["text"] for c in gap] == ["one", "two"]
    sent = subtitles.group_cues([(0, 0.3, "This"), (0.3, 0.6, "is"), (0.6, 0.9, "a"), (0.9, 1.2, "test."),
                                 (1.2, 1.5, "Next")])
    assert [c["text"] for c in sent] == ["This is a test.", "Next"]


def test_group_cjk_no_spaces_and_ids_and_no_overlap():
    words = [(i * 0.2, i * 0.2 + 0.3, ch) for i, ch in enumerate("今天我們來做一支短影片很有趣")]
    cues = subtitles.group_cues(words)
    assert "".join(c["text"] for c in cues) == "今天我們來做一支短影片很有趣" and " " not in cues[0]["text"]
    assert [c["id"] for c in cues] == list(range(len(cues)))
    assert all(a["end"] <= b["start"] for a, b in zip(cues, cues[1:]))
    assert subtitles.width_units(cues[0]["text"]) <= subtitles.MAX_UNITS


def test_srt_format():
    cues = [{"id": 0, "start": 0.0, "end": 1.5, "text": "Hello"}, {"id": 1, "start": 3725.25, "end": 3726.0, "text": "世界"}]
    assert subtitles.to_srt(cues) == ("1\n00:00:00,000 --> 00:00:01,500\nHello\n\n"
                                      "2\n01:02:05,250 --> 01:02:06,000\n世界\n")


def test_font_missing_is_a_clear_error(monkeypatch):
    monkeypatch.setenv("SUBTITLE_FONT", "/nope.ttf")
    monkeypatch.setattr(subtitles, "FONT_CANDIDATES", ("/nope/a.ttc",))
    with pytest.raises(subtitles.SubtitleError, match="SUBTITLE_FONT"):
        subtitles.find_font()


def test_font_env_wins(monkeypatch, tmp_path):
    f = tmp_path / "f.ttf"
    f.write_bytes(b"x")
    monkeypatch.setenv("SUBTITLE_FONT", str(f))
    assert subtitles.find_font() == str(f)


@pytest.mark.parametrize("position", ["bottom", "middle"])
@pytest.mark.parametrize("box", [True, False])
def test_cjk_cue_png_is_not_empty(tmp_path, position, box):
    from PIL import Image
    path = subtitles.render_cue_png("今天我們來做一支短影片 hello world", BurnStyle(size="L", position=position, box=box),
                                    tmp_path / "c.png")
    img = Image.open(path)
    assert img.size == (1080, 1920) and img.mode == "RGBA"
    box_ = img.getchannel("A").getbbox()
    assert box_ is not None
    mid = (box_[1] + box_[3]) / 2
    assert (mid > 1100) if position == "bottom" else (800 < mid < 1120)


def test_long_cue_wraps_inside_frame(tmp_path):
    from PIL import Image
    path = subtitles.render_cue_png("這是一段很長的字幕" * 6, BurnStyle(size="L", box=False), tmp_path / "c.png")
    b = Image.open(path).getchannel("A").getbbox()
    assert b[0] >= 0 and b[2] <= 1080


def test_overlay_list_covers_timeline(tmp_path):
    cues = [{"id": 0, "start": 1.0, "end": 2.0, "text": "a"}, {"id": 1, "start": 2.0, "end": 3.0, "text": "b"}]
    listing = subtitles.write_overlay(cues, BurnStyle(), tmp_path, 5.0)
    lines = listing.read_text().splitlines()
    durations = [float(x.split()[1]) for x in lines if x.startswith("duration")]
    assert sum(durations) == pytest.approx(6.0)  # total + 1 s tail
    assert lines[-1].startswith("file")
    assert subtitles.overlay_graph("vg", 1) == ";[vg][1:v]overlay=0:0:format=auto:eof_action=pass[vo]"


# ---- saved cues and routes ----------------------------------------------------------------------------

CUES = [{"id": 0, "start": 0.0, "end": 1.0, "text": "hello"}, {"id": 1, "start": 1.2, "end": 2.0, "text": "world"}]


def cut_with_cues(client, calls, cues=CUES):
    def run(takes, music, speed, work, out, step, **kw):
        calls.append(kw)
        r = fake_render(takes, music, speed, work, out, step)
        r["cues"] = kw.get("cues", cues)
        return r
    return run


def test_cues_saved_served_edited_and_validated(client, setup, monkeypatch):
    calls = []
    monkeypatch.setattr(renders, "run_pipeline", cut_with_cues(client, calls))
    with_take(client)
    assert client.get("/api/ideas/ia/cut/subtitles").status_code == 404
    assert start(client).status_code == 202 and wait_for(client)["status"] == "done"
    got = client.get("/api/ideas/ia/cut/subtitles").json()
    assert got == {"cues": CUES, "edited": False}
    srt = client.get("/api/ideas/ia/cut/subtitles.srt")
    assert srt.text.startswith("1\n00:00:00,000 --> 00:00:01,000\nhello") and "attachment" in srt.headers["content-disposition"]
    bad = client.put("/api/ideas/ia/cut/subtitles", json={"cues": [{"id": 0, "text": "x"}]})
    assert bad.status_code == 422
    blank = client.put("/api/ideas/ia/cut/subtitles", json={"cues": [{"id": 0, "text": " "}, {"id": 1, "text": "y"}]})
    assert blank.status_code == 422
    ok = client.put("/api/ideas/ia/cut/subtitles", json={"cues": [{"id": 0, "text": "Hi there"}, {"id": 1, "text": "世界"}]})
    assert ok.status_code == 200 and ok.json()["edited"] is True
    again = client.get("/api/ideas/ia/cut/subtitles").json()
    assert [c["text"] for c in again["cues"]] == ["Hi there", "世界"] and again["cues"][0]["start"] == 0.0
    assert client.get("/api/ideas/nope/cut/subtitles").status_code == 404


def test_edited_cues_are_used_on_the_next_cut_when_takes_and_speed_match(client, setup, monkeypatch):
    calls = []
    monkeypatch.setattr(renders, "run_pipeline", cut_with_cues(client, calls))
    with_take(client)
    start(client); wait_for(client)
    assert "cues" not in calls[0]
    client.put("/api/ideas/ia/cut/subtitles", json={"cues": [{"id": 0, "text": "Edited"}, {"id": 1, "text": "world"}]})
    client.post("/api/ideas/ia/cut", json={"shotCount": 1, "speed": 1.1, "burnSubtitles": True})
    wait_for(client)
    assert calls[1]["cues"][0]["text"] == "Edited" and calls[1]["burn"] == BurnStyle()
    assert json.loads((cut_dir() / "cues.json").read_text())["edited"] is True
    # another speed: the timings no longer fit, so the edits are not reused
    start(client, speed=1.25); wait_for(client)
    assert "cues" not in calls[2]
    assert json.loads((cut_dir() / "cues.json").read_text())["edited"] is False


def test_plain_request_calls_pipeline_unchanged(client, setup, monkeypatch):
    calls = []
    monkeypatch.setattr(renders, "run_pipeline", cut_with_cues(client, calls))
    with_take(client)
    start(client); wait_for(client)
    assert calls == [{}]  # no grade, no burn, no cues


def test_options_validated_and_passed_on(client, setup, monkeypatch):
    calls = []
    monkeypatch.setattr(renders, "run_pipeline", cut_with_cues(client, calls))
    with_take(client)
    bad = client.post("/api/ideas/ia/cut", json={"shotCount": 1, "speed": 1.1, "grade": "sepia"})
    assert bad.status_code == 422
    bad = client.post("/api/ideas/ia/cut", json={"shotCount": 1, "speed": 1.1, "subtitleStyle": {"size": "XL"}})
    assert bad.status_code == 422
    r = client.post("/api/ideas/ia/cut", json={"shotCount": 1, "speed": 1.1, "grade": "warm", "burnSubtitles": True,
                                               "subtitleStyle": {"size": "L", "position": "middle", "box": False}})
    assert r.status_code == 202
    state = wait_for(client)
    assert calls[0]["grade"] == "warm" and calls[0]["burn"] == BurnStyle(size="L", position="middle", box=False)
    assert state["options"]["grade"] == "warm"
