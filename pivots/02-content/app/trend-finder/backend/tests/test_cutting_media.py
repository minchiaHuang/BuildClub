"""Golden-file tests for the ffmpeg pipeline. Media is generated with lavfi into tmp_path."""

import os
import re
import shutil
import subprocess

import pytest

import cutting

need_ffmpeg = pytest.mark.skipif(not (shutil.which("ffmpeg") and shutil.which("ffprobe")), reason="needs ffmpeg")

GAP_CLIP = [("tone", 440, 1.0), ("quiet", None, 1.5), ("tone", 440, 1.0)]  # 3.5 s, silence at 1.0-2.5
FAKE_WORDS = [(0.0, 1.3, "hello"), (2.5, 3.5, "world")]  # "hello" ends 0.3 s late, like whisper


def fake_words(wav, work):
    return FAKE_WORDS


def make_clip(path, parts, size="640x360", with_audio=True):
    """parts: [("tone", 440, 1.0), ("quiet", None, 1.5), ...]. Video is testsrc at 24 fps for the total length."""
    total = sum(p[2] for p in parts)
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"testsrc=s={size}:r=24:d={total}"]
    if with_audio:
        for kind, freq, dur in parts:
            src = f"sine=f={freq}:d={dur}:r=48000" if kind == "tone" else "anullsrc=r=48000:cl=mono"
            cmd += ["-f", "lavfi", "-t", str(dur), "-i", src]
        n = len(parts)
        cmd += ["-filter_complex", "".join(f"[{i + 1}:a]" for i in range(n)) + f"concat=n={n}:v=0:a=1[a]",
                "-map", "0:v", "-map", "[a]", "-c:a", "aac"]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-t", str(total), str(path)]
    r = subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    assert r.returncode == 0, r.stderr
    return path


def cut(tmp_path, takes, *, speed=1.0, words_fn=fake_words, music=None, steps=None):
    out = tmp_path / "out.mp4"
    steps = steps if steps is not None else []
    info = cutting.render_cut(takes, music, speed, tmp_path / "w", out, lambda p, t: steps.append((p, t)),
                              words_fn=words_fn)
    return info, cutting.probe(out), out


def assert_spec(p):
    assert (p["width"], p["height"], p["fps"]) == (1080, 1920, 30)
    assert (p["vcodec"], p["acodec"], p["pix_fmt"], p["sample_rate"]) == ("h264", "aac", "yuv420p", 48000)


@need_ffmpeg
def test_silence_removed_and_spec_met(tmp_path):
    clip = make_clip(tmp_path / "a.mp4", GAP_CLIP)
    steps = []
    info, p, out = cut(tmp_path, [{"path": clip}], steps=steps)
    assert p["duration"] == pytest.approx(2.24, abs=0.15)  # 3.5 s minus the 1.26 s gap
    assert_spec(p)
    assert info["size"] == out.stat().st_size and info["durationSec"] == pytest.approx(p["duration"], abs=0.05)
    loud = cutting.measure_loudness(out)
    print("loudness", loud)
    assert loud["I"] == pytest.approx(-13, abs=1.0) and loud["peak"] <= -1.0
    assert not out.with_suffix(".part").exists()
    progress = [s[0] for s in steps]
    assert progress == sorted(progress) and progress[0] == pytest.approx(0.02)
    assert {t for _, t in steps} >= {"Checking the takes", "Joining the takes", "Listening for words",
                                     "Finding silences", "Measuring the sound", "Rendering", "Checking the result"}


@need_ffmpeg
def test_speed_shortens(tmp_path):
    clip = make_clip(tmp_path / "a.mp4", GAP_CLIP)
    _, p, _ = cut(tmp_path, [{"path": clip}], speed=1.25)
    assert p["duration"] == pytest.approx(2.24 / 1.25, abs=0.15)
    assert_spec(p)


@need_ffmpeg
def test_filler_cut(tmp_path):
    parts = [("tone", 440, 0.8), ("tone", 880, 0.5), ("quiet", None, 0.6), ("tone", 440, 0.8)]
    clip = make_clip(tmp_path / "a.mp4", parts)
    words = [(0.0, 0.8, "hello"), (0.8, 1.3, "um"), (1.9, 2.7, "world")]
    _, p, _ = cut(tmp_path, [{"path": clip}], words_fn=lambda w, d: words)
    assert p["duration"] == pytest.approx(1.6 + 0.12, abs=0.2)


@need_ffmpeg
def test_no_words_keeps_everything(tmp_path):
    clip = make_clip(tmp_path / "a.mp4", GAP_CLIP)
    steps = []
    _, p, _ = cut(tmp_path, [{"path": clip}], words_fn=lambda w, d: [], steps=steps)
    assert p["duration"] == pytest.approx(3.5, abs=0.15)
    assert any(t == "No speech found, so nothing was cut." for _, t in steps)


def mean_volume(path, start, dur):
    """Mean volume (dB) of a slice of the audio; -91 for digital silence."""
    r = subprocess.run(["ffmpeg", "-nostdin", "-ss", str(start), "-t", str(dur), "-i", str(path), "-vn",
                        "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"mean_volume: (-?[\d.]+|-inf) dB", r.stderr)
    return float(m.group(1)) if m else -91.0


@need_ffmpeg
@pytest.mark.parametrize("first,second", [("tone", "quiet"), ("quiet", "tone")])
def test_two_takes_are_joined_in_order(tmp_path, first, second):
    def part(kind, dur):
        return [("tone", 440, dur)] if kind == "tone" else [("quiet", None, dur)]
    a = make_clip(tmp_path / "a.mp4", part(first, 1.5))
    b = make_clip(tmp_path / "b.mp4", part(second, 2.0))
    _, p, out = cut(tmp_path, [{"path": a}, {"path": b}], words_fn=lambda w, d: [])
    assert p["duration"] == pytest.approx(3.5, abs=0.15)
    assert_spec(p)
    head, tail = mean_volume(out, 0.2, 1.0), mean_volume(out, 1.9, 1.0)
    loud, quiet = (head, tail) if first == "tone" else (tail, head)
    assert loud > -35 and quiet < -60


@need_ffmpeg
def test_take_without_audio_and_silent_output(tmp_path):
    clip = make_clip(tmp_path / "a.mp4", [("tone", 440, 2.0)], with_audio=False)
    _, p, _ = cut(tmp_path, [{"path": clip}], words_fn=lambda w, d: [])
    assert p["duration"] == pytest.approx(2.0, abs=0.15)
    assert_spec(p)


@need_ffmpeg
def test_silent_take_joined_with_normal_take(tmp_path):
    silent = make_clip(tmp_path / "a.mp4", [("tone", 440, 1.5)], with_audio=False)
    normal = make_clip(tmp_path / "b.mp4", [("tone", 440, 2.0)])
    _, p, out = cut(tmp_path, [{"path": silent}, {"path": normal}], words_fn=lambda w, d: [])
    assert p["duration"] == pytest.approx(3.5, abs=0.15)
    assert_spec(p)
    streams = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_name",
                              "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout.split()
    assert streams == ["aac"]
    assert mean_volume(out, 0.2, 1.0) < -60 and mean_volume(out, 2.0, 1.0) > -35  # silence first, then the tone


def make_wav(path, seconds, freq=220):
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"sine=f={freq}:d={seconds}:r=44100",
                        str(path)], capture_output=True, text=True, stdin=subprocess.DEVNULL)
    assert r.returncode == 0, r.stderr
    return path


@need_ffmpeg
def test_music_is_mixed_low_and_loudness_holds(tmp_path):
    clip = make_clip(tmp_path / "a.mp4", GAP_CLIP)
    music = make_wav(tmp_path / "m.wav", 3)
    _, p, out = cut(tmp_path, [{"path": clip}], music=music)
    assert p["duration"] == pytest.approx(2.24, abs=0.15)
    assert_spec(p)
    assert cutting.measure_loudness(out)["I"] == pytest.approx(-13, abs=1.0)


@need_ffmpeg
def test_music_longer_than_video_is_trimmed(tmp_path):
    clip = make_clip(tmp_path / "a.mp4", GAP_CLIP)
    music = make_wav(tmp_path / "m.wav", 20)
    _, p, _ = cut(tmp_path, [{"path": clip}], music=music)
    assert p["duration"] == pytest.approx(2.24, abs=0.15)
    assert_spec(p)


@need_ffmpeg
def test_all_silent_take_renders(tmp_path):
    clip = make_clip(tmp_path / "a.mp4", [("quiet", None, 2.0)])
    _, p, out = cut(tmp_path, [{"path": clip}], words_fn=lambda w, d: [])
    assert p["duration"] == pytest.approx(2.0, abs=0.15)
    assert_spec(p)
    assert mean_volume(out, 0.2, 1.5) < -60


@need_ffmpeg
def test_landscape_is_center_cropped(tmp_path):
    clip = make_clip(tmp_path / "a.mp4", [("tone", 440, 1.5)], size="640x360")
    _, p, _ = cut(tmp_path, [{"path": clip}], words_fn=lambda w, d: [])
    assert_spec(p)
    graph = cutting.build_join_graph([{"hasAudio": True, "duration": 1.5}])
    assert "crop=1080:1920" in graph and "pad=" not in graph


@need_ffmpeg
def test_portrait_input_passes_through(tmp_path):
    clip = make_clip(tmp_path / "a.mp4", [("tone", 440, 1.5)], size="360x640")
    _, p, _ = cut(tmp_path, [{"path": clip}], words_fn=lambda w, d: [])
    assert_spec(p)
    assert p["duration"] == pytest.approx(1.5, abs=0.15)


def test_render_pass_timeout_is_a_human_sentence(tmp_path, monkeypatch):
    monkeypatch.setattr(cutting, "FFMPEG_TIMEOUT", 0.3)
    with pytest.raises(cutting.CutError, match="took too long"):
        cutting._render_pass(["sleep", "5"], 1.0, lambda f: None, tmp_path / "err.txt")


@need_ffmpeg
def test_music_is_mixed_and_looped(tmp_path):
    # 0.8 s of speech-like tone then 1.2 s of silence; music is only 0.5 s long, so sound in the tail
    # proves both that it is mixed and that it loops.
    clip = make_clip(tmp_path / "a.mp4", [("tone", 440, 0.8), ("quiet", None, 1.2)])
    music = tmp_path / "m.wav"
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=220:d=0.5:r=44100", str(music)],
                       capture_output=True, text=True, stdin=subprocess.DEVNULL)
    assert r.returncode == 0, r.stderr
    _, p, with_music = cut(tmp_path, [{"path": clip}], words_fn=lambda w, d: [], music=music)
    assert p["duration"] == pytest.approx(2.0, abs=0.15)
    assert_spec(p)
    (tmp_path / "plain").mkdir()
    _, _, without = cut(tmp_path / "plain", [{"path": clip}], words_fn=lambda w, d: [])
    assert mean_volume(without, 1.0, 0.8) < -60          # no music: the tail is silent
    assert mean_volume(with_music, 1.0, 0.8) > -50       # music: still audible after its first 0.5 s


@need_ffmpeg
def test_input_over_limit_is_an_error(tmp_path, monkeypatch):
    clip = make_clip(tmp_path / "a.mp4", [("tone", 440, 1.5)])
    monkeypatch.setattr(cutting, "MAX_INPUT_SEC", 1.0)
    with pytest.raises(cutting.CutError, match="too long"):
        cut(tmp_path, [{"path": clip}])


@need_ffmpeg
def test_missing_whisper_is_an_error(tmp_path, monkeypatch):
    monkeypatch.setattr(cutting.analyze, "WHISPER", "/nonexistent/whisper-cli")
    with pytest.raises(cutting.CutError, match="whisper.cpp"):
        cutting.transcribe_words(tmp_path / "x.wav", tmp_path)


@pytest.mark.skipif(not os.environ.get("REMAKE_WHISPER_TESTS") or cutting.missing_tools(),
                    reason="slow: set REMAKE_WHISPER_TESTS=1")
def test_real_whisper_on_say_audio(tmp_path):
    aiff = tmp_path / "s.aiff"
    subprocess.run(["say", "-o", str(aiff), "hello there, this is a test"], check=True)
    wav = tmp_path / "s.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(aiff), "-ac", "1", "-ar", "16000", str(wav)], check=True)
    words = cutting.transcribe_words(wav, tmp_path)
    assert words and all(s < e for s, e, _ in words)


def test_run_times_out_with_a_human_sentence():
    with pytest.raises(cutting.CutError, match="took too long"):
        cutting.run(["sleep", "5"], timeout=0.2)
