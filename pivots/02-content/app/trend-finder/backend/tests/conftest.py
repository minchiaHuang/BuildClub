"""Offline test setup: every test gets its own cache, pin, jobs and database folders, and live
search is replaced by a function that fails, so no test can reach Apify or Claude."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import analyze  # noqa: E402
import server  # noqa: E402


@pytest.fixture(autouse=True)
def offline(tmp_path, monkeypatch):
    def no_network(payload, max_items, actor=None):
        raise AssertionError(f"Apify called with {payload!r}")

    monkeypatch.setattr(server, "run_actor", no_network)
    monkeypatch.setattr(server, "TOKEN", "test-token")
    monkeypatch.setattr(server, "CACHE_DIR", tmp_path / "cache")
    monkeypatch.setattr(server, "PINNED_DIR", tmp_path / "pinned")
    monkeypatch.setattr(server, "DB_PATH", tmp_path / "data.db")
    monkeypatch.setattr(analyze, "JOBS_DIR", tmp_path / "jobs")
    return tmp_path


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(server.app)
