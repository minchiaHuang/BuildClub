import pytest

import server
from conftest import median_search


def test_refetch_fills_baselines_and_pins(monkeypatch, capsys):
    monkeypatch.setattr(server, "in_background", lambda fill: None)  # a deferred fill must still finish
    monkeypatch.setattr(server, "run_actor", median_search([], ["a", "b"]))
    server.refetch("tofu")
    pinned = server.json.loads((server.PINNED_DIR / server.cache_name("tofu")).read_text())
    assert pinned["mediansPending"] is False
    assert pinned["videos"][0]["medianN"] == 5
    assert "scored 2 of 2 videos; baseline details on 2" in capsys.readouterr().out


def test_refetch_restores_in_background(monkeypatch):
    marker = lambda fill: None  # noqa: E731
    monkeypatch.setattr(server, "in_background", marker)
    monkeypatch.setattr(server, "run_actor", median_search([], ["a"]))
    server.refetch("tofu")
    assert server.in_background is marker


def test_refetch_over_budget_exits_without_pin(monkeypatch):
    monkeypatch.setattr(server, "DAILY_APIFY_USD", 0)
    with pytest.raises(SystemExit):
        server.refetch("tofu")
    assert not (server.PINNED_DIR / server.cache_name("tofu")).exists()


def test_refetch_search_failure_exits_without_pin():
    with pytest.raises(SystemExit):  # the offline fixture makes Apify fail: a 502
        server.refetch("tofu")
    assert not (server.PINNED_DIR / server.cache_name("tofu")).exists()


def test_refetch_rejects_other_platforms():
    with pytest.raises(SystemExit):
        server.refetch("tofu", "youtube")


def test_refetch_keeps_old_pin_when_medians_fail(monkeypatch):
    # The budget covers the search but not the account medians.
    monkeypatch.setattr(server, "DAILY_APIFY_USD", server.SEARCH_USD["tiktok"])
    monkeypatch.setattr(server, "run_actor", median_search([], ["a"]))
    server.PINNED_DIR.mkdir()
    old = server.PINNED_DIR / server.cache_name("tofu")
    old.write_bytes(b'{"old": true}')
    with pytest.raises(SystemExit, match="not pinned"):
        server.refetch("tofu")
    assert old.read_bytes() == b'{"old": true}'
