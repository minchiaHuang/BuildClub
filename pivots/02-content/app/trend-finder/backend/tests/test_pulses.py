PULSES = {"c1": {"topic": "tofu", "fetchedAt": 1790000000000,
                 "patterns": [{"kind": "sound", "label": "original sound", "accounts": 3, "avgScore": 2.5,
                               "videoIds": ["tt-1", "tt-2"]}],
                 "breakouts": [{"hook": "Wait for it", "score": 6.2}]}}


def test_pulses_are_null_until_saved(client):
    assert client.get("/api/pulses").json() is None


def test_pulses_round_trip(client):
    assert client.put("/api/pulses", json=PULSES).status_code == 200
    assert client.get("/api/pulses").json() == PULSES


def test_pulses_reject_bad_shape(client):
    bad = {"c1": {k: v for k, v in PULSES["c1"].items() if k != "topic"}}
    assert client.put("/api/pulses", json=bad).status_code == 422
