"""Offline test setup: every test gets its own cache, pin, jobs and database folders, and live
search is replaced by a function that fails, so no test can reach Apify or Claude."""

import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import analyze  # noqa: E402
import channels  # noqa: E402
import server  # noqa: E402


def fake_subprocess(run):
    """channels' view of the subprocess module with run replaced; the real module is left alone,
    so analyze's tests keep theirs."""
    return SimpleNamespace(**{**vars(subprocess), "run": run})


@pytest.fixture(autouse=True)
def offline(tmp_path, monkeypatch):
    def no_network(payload, max_items, actor=None):
        raise AssertionError(f"Apify called with {payload!r}")

    monkeypatch.setattr(server, "run_actor", no_network)
    monkeypatch.setattr(server, "TOKEN", "test-token")
    monkeypatch.setattr(server, "APP_PASSWORD", "")
    monkeypatch.setattr(server, "CACHE_DIR", tmp_path / "cache")
    monkeypatch.setattr(server, "PINNED_DIR", tmp_path / "pinned")
    monkeypatch.setattr(server, "DB_PATH", tmp_path / "data.db")
    monkeypatch.setattr(analyze, "JOBS_DIR", tmp_path / "jobs")
    monkeypatch.setattr(channels, "CHANNELS_DIR", tmp_path / "channels")
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-jev-key")
    monkeypatch.setenv("SCRAPECREATORS_API_KEY", "test-sc-key")

    # Channel summaries: no test may run channel-decoder, yt-dlp or Claude for real. A test that
    # wants them swaps in its own fake.
    def no_subprocess(cmd, **kwargs):
        raise AssertionError(f"subprocess run: {cmd!r}")

    def no_claude(content):
        raise AssertionError("Claude called for channel naming")

    monkeypatch.setattr(channels, "subprocess", fake_subprocess(no_subprocess))
    monkeypatch.setattr(channels, "ask_claude", no_claude)
    # Account medians are filled after the search returns; run that inline so tests are deterministic.
    monkeypatch.setattr(server, "in_background", lambda fill: fill())
    return tmp_path


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(server.app)
