"""Grade presets: filter strings, the list route and the before/after preview."""

import shutil
import subprocess

import pytest

import grading
import server
from test_cutting_media import make_clip, need_ffmpeg
from test_renders import setup  # noqa: F401
from test_takes import up


def test_presets_and_filters():
    assert [p["id"] for p in grading.list_presets()] == ["none", "warm", "cool", "vivid", "muted", "bw"]
    assert grading.grade_filter("none") == ""
    assert "colorbalance" in grading.grade_filter("warm") and "hue=s=0" in grading.grade_filter("bw")
    with pytest.raises(ValueError):
        grading.grade_filter("sepia")


def test_preview_graph_none_is_identity_pair():
    g = grading.preview_graph("none")
    assert "[b]null[g]" in g and g.endswith("hstack[o]")


def test_list_route(client, setup):
    r = client.get("/api/cut/grades").json()
    assert {"id": "warm", "label": "Warm"} in r["presets"]


def test_preview_refusals(client, setup):
    assert client.get("/api/ideas/ia/cut/grade-preview?preset=sepia").status_code == 422
    assert client.get("/api/ideas/ia/cut/grade-preview?preset=warm").status_code == 404  # no take yet


@need_ffmpeg
@pytest.mark.parametrize("name", list(grading.PRESETS))
def test_every_preset_runs_in_ffmpeg(name):
    cmd = ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=320x568:d=0.5:r=10", "-filter_complex",
           grading.preview_graph(name), "-map", "[o]", "-frames:v", "1", "-f", "null", "-"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr


@need_ffmpeg
def test_preview_route_returns_png(client, setup, tmp_path):
    t = up(client).json()
    path = server.MEDIA_DIR / "ia" / f"{t['id']}.mp4"
    make_clip(tmp_path / "c.mp4", [("tone", 440, 1.0)])
    shutil.copy(tmp_path / "c.mp4", path)
    r = client.get("/api/ideas/ia/cut/grade-preview?preset=bw&t=0.3")
    assert r.status_code == 200 and r.content[:8] == b"\x89PNG\r\n\x1a\n"
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(r.content))
    assert img.size == (720, 640)
    right = img.crop((360, 0, 720, 640)).convert("RGB")
    assert all(abs(p[0] - p[1]) < 6 and abs(p[1] - p[2]) < 6 for p in right.resize((20, 20)).getdata())  # grey
