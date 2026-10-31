"""Pure helpers for cutting silences and filler words: no ffmpeg or whisper needed."""

import json
import random
import shutil
from pathlib import Path

import pytest

import analyze
import cutting

FIXTURES = Path(__file__).parent / "fixtures"
W = [(0.0, 1.0, "hello"), (1.0, 1.6, "um"), (2.9, 3.5, "world")]  # "um" really ends at 1.3
SIL = [(1.3, 2.9)]


def test_parse_words_drops_markers():
    data = json.loads((FIXTURES / "whisper_words.json").read_text())
    assert cutting.parse_words(data) == [
        (0.12, 0.64, "hello"), (0.65, 1.0, "everyone"), (0.7, 0.9, "out"),
        (1.0, 1.6, "um"), (2.9, 3.5, "world")]


def test_filler_removed_and_gap_trimmed():
    keeps = cutting.keep_intervals(W, SIL, 3.5)
    # um 1.0-1.3 and the gap up to 2.9 are one cut; keep 0.12 only on the world side
    assert keeps == [pytest.approx((0.0, 1.0)), pytest.approx((2.78, 3.5))]


def test_short_gap_is_kept():
    assert cutting.keep_intervals([(0, 1, "a"), (1.2, 2, "b")], [(1.0, 1.2)], 2) == [(0, 2)]


def test_no_words_keeps_everything():
    assert cutting.keep_intervals([], [], 5.0) == [(0.0, 5.0)]


def test_filler_list_only_cuts_listed_words():
    assert not cutting.is_filler("like") and not cutting.is_filler("ah") and cutting.is_filler(" Um, ")


@pytest.mark.parametrize("seed", range(20))
def test_never_cuts_inside_a_real_word(seed):
    rng = random.Random(seed)
    words, silences, truth, t = [], [], [], 0.0
    for _ in range(rng.randint(3, 12)):
        t += rng.choice([0.0, 0.05, 0.3, 0.6, 1.5])
        start = t
        true_end = start + rng.uniform(0.15, 0.6)
        gap = rng.choice([0.0, 0.05, 0.3, 0.6, 1.5])
        text = rng.choice(["um", "hello", "word", "uh", "again"])
        # whisper overstates the end into the gap, but never past the next word
        end = true_end + rng.uniform(0, gap)
        words.append((start, end, text))
        truth.append((start, true_end, text))
        if gap >= 0.15:
            silences.append((true_end, true_end + gap))
        t = true_end + gap
    total = t + rng.choice([0.0, 0.5, 2.0])
    keeps = cutting.keep_intervals(words, silences, total)
    for a, b in zip(keeps, keeps[1:]):
        assert a[1] < b[0]
    for k in keeps:
        assert 0 <= k[0] < k[1] <= total
    for start, true_end, text in truth:
        if cutting.is_filler(text):
            continue
        assert any(k[0] <= start + 1e-9 and true_end <= k[1] + 1e-9 for k in keeps), (text, start, true_end, keeps)


def test_atempo_chain():
    assert cutting.atempo_chain(1.1) == "atempo=1.1"
    assert cutting.atempo_chain(2.5) == "atempo=2.0,atempo=1.25"
    assert cutting.atempo_chain(1.0) == ""


def test_output_duration():
    assert cutting.output_duration([(0, 1), (2, 3.5)], 1.25) == pytest.approx(2.0)


GOLDEN = (
    "[0:v]trim=start=0:end=1,setpts=PTS-STARTPTS[v0];"
    "[0:a]atrim=start=0:end=1,asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=0.988:d=0.012[a0];"
    "[0:v]trim=start=2.78:end=3.5,setpts=PTS-STARTPTS[v1];"
    "[0:a]atrim=start=2.78:end=3.5,asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=0.708:d=0.012[a1];"
    "[v0][a0][v1][a1]concat=n=2:v=1:a=1[vc][ac];"
    "[vc]setpts=PTS/1.25[v];"
    "[ac]atempo=1.25[as];"
    "[as]loudnorm=I=-13:TP=-1.5:LRA=11:print_format=json,aresample=48000[a]"
)


def test_cut_graph_golden_string():
    graph = cutting.build_cut_graph([(0.0, 1.0), (2.78, 3.5)], 1.25, music=False, audio_only=False, loudnorm=None)
    assert graph == GOLDEN


def test_cut_graph_audio_only_has_no_video():
    graph = cutting.build_cut_graph([(0.0, 1.0)], 1.0, music=False, audio_only=True, loudnorm=None)
    assert "trim=" not in graph.replace("atrim", "") and "[v]" not in graph and graph.endswith("[a]")


def test_cut_graph_music_and_second_pass():
    ln = {"input_i": -20.5, "input_tp": -3.1, "input_lra": 7.0, "input_thresh": -31.0, "target_offset": 0.4}
    graph = cutting.build_cut_graph([(0.0, 1.0), (2.0, 4.0)], 1.1, music=True, audio_only=False, loudnorm=ln)
    assert "amix=inputs=2:duration=first:normalize=0" in graph
    assert "linear=true" in graph and "measured_I=-20.5" in graph and "offset=0.4" in graph
    first = cutting.build_cut_graph([(0.0, 1.0)], 1.0, music=False, audio_only=False, loudnorm=None)
    assert "print_format=json" in first and "linear=true" not in first and "amix" not in first
    assert "[1:a]atrim=0:2.727" in graph


def test_join_graph_crops_and_fills_silence():
    graph = cutting.build_join_graph([{"hasAudio": True, "duration": 3.0}, {"hasAudio": False, "duration": 2.5}])
    assert graph.count("anullsrc=r=48000:cl=stereo") == 1 and "atrim=0:2.5" in graph
    assert "[1:a]" not in graph and "[0:a]aresample=48000,aformat=channel_layouts=stereo" in graph
    chains = [c for c in graph.split(";") if c.startswith(("[0:v]", "[1:v]"))]
    assert len(chains) == 2 and all(c.endswith("format=yuv420p[v%d]" % i) for i, c in enumerate(chains))
    assert "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30" in graph
    assert graph.endswith("concat=n=2:v=1:a=1[v][a]")


LOUDNORM_ERR = """[Parsed_loudnorm_0 @ 0x1] 
{
\t"input_i" : "-20.53",
\t"input_tp" : "-3.10",
\t"input_lra" : "7.00",
\t"input_thresh" : "-31.04",
\t"output_i" : "-13.2",
\t"target_offset" : "0.40"
}
"""
SILENCE_ERR = """[silencedetect @ 0x1] silence_start: 1.3
[silencedetect @ 0x1] silence_end: 2.9 | silence_duration: 1.6
[silencedetect @ 0x1] silence_start: 4.25
"""


def test_parse_loudnorm_and_silences_and_progress():
    assert cutting.parse_loudnorm("noise {\"a\": 1}\n" + LOUDNORM_ERR) == {
        "input_i": -20.53, "input_tp": -3.10, "input_lra": 7.0, "input_thresh": -31.04, "target_offset": 0.4}
    assert cutting.parse_silences(SILENCE_ERR, 6.0) == [(1.3, 2.9), (4.25, 6.0)]
    assert cutting.parse_progress("out_time_us=2500000", 10.0) == pytest.approx(0.25)
    assert cutting.parse_progress("out_time_us=99000000", 10.0) == 1.0
    assert cutting.parse_progress("out_time_us=N/A", 10.0) is None
    assert cutting.parse_progress("progress=continue", 10.0) is None


def test_missing_tools(monkeypatch, tmp_path):
    whisper, model = tmp_path / "whisper-cli", tmp_path / "model.bin"
    whisper.write_text("")
    model.write_text("")
    monkeypatch.setattr(analyze, "WHISPER", str(whisper))
    monkeypatch.setattr(analyze, "MODEL", model)
    monkeypatch.setattr(shutil, "which", lambda name: f"/usr/bin/{name}")
    assert cutting.missing_tools() is None
    ffmpeg_msg = ("ffmpeg isn't installed on this computer, so the cut can't be made. "
                  "Install it (brew install ffmpeg) and try again.")
    monkeypatch.setattr(shutil, "which", lambda name: None if name == "ffprobe" else f"/usr/bin/{name}")
    assert cutting.missing_tools() == ffmpeg_msg
    monkeypatch.setattr(shutil, "which", lambda name: None if name == "ffmpeg" else f"/usr/bin/{name}")
    assert cutting.missing_tools() == ffmpeg_msg
    monkeypatch.setattr(shutil, "which", lambda name: f"/usr/bin/{name}")
    monkeypatch.setattr(analyze, "MODEL", tmp_path / "missing.bin")
    assert cutting.missing_tools() == ("whisper.cpp or its model wasn't found (looked for /opt/homebrew/bin/whisper-cli "
                                       "and ~/models/ggml-large-v3-turbo-q5_0.bin), so the cut can't be made.")


# E3: takes without speech are kept whole. Spans are (start, end) of each take in the joined timeline.
def test_wordless_middle_take_is_kept_whole():
    words = [(0.0, 1.0, "hello"), (6.0, 7.0, "world")]  # take 1: 0-2, take 2 (silent): 2-5, take 3: 5-8
    keeps = cutting.keep_intervals(words, [], 8.0, protected=[(2.0, 5.0)])
    assert _covers(keeps, 2.0, 5.0)
    assert not _covers(keeps, 1.2, 1.9)  # silence inside the speaking take is still trimmed


def _covers(keeps, a, b):
    return any(k0 <= a + 1e-9 and k1 >= b - 1e-9 for k0, k1 in keeps)


def test_wordless_first_take_is_kept_whole():
    words = [(3.0, 4.0, "hello")]
    keeps = cutting.keep_intervals(words, [], 5.0, protected=[(0.0, 2.0)])
    assert _covers(keeps, 0.0, 2.0)
    assert not _covers(keeps, 2.2, 2.8)


def test_wordless_last_take_is_kept_whole():
    words = [(0.0, 1.0, "hello")]
    keeps = cutting.keep_intervals(words, [], 5.0, protected=[(3.0, 5.0)])
    assert _covers(keeps, 3.0, 5.0)
    assert not _covers(keeps, 1.2, 2.8)


def test_take_with_words_is_still_trimmed():
    keeps = cutting.keep_intervals(W, SIL, 3.5, protected=[])
    assert keeps == [pytest.approx((0.0, 1.0)), pytest.approx((2.78, 3.5))]


def test_protected_boundary_does_not_cut_into_protected_take():
    # speaking take 0-3 (word 0-1, long silence after), protected take 3-5, speaking take 5-8 (word 7-8)
    words = [(0.0, 1.0, "a"), (7.0, 8.0, "b")]
    keeps = cutting.keep_intervals(words, [], 8.0, protected=[(3.0, 5.0)])
    assert keeps == [pytest.approx((0.0, 1.12)), pytest.approx((3.0, 5.0)), pytest.approx((6.88, 8.0))]


def test_no_words_with_protected_keeps_everything():
    assert cutting.keep_intervals([], [], 5.0, protected=[(0.0, 5.0)]) == [(0.0, 5.0)]


def test_wordless_spans_picks_takes_without_words():
    words = [(0.5, 1.0, "a"), (5.5, 6.0, "b")]
    spans = cutting.wordless_spans([2.0, 3.0, 3.0], words)
    assert spans == [(2.0, 5.0)]
