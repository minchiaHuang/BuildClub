CLIENT = {"id": "c1", "name": "Tofu Bar", "niche": "food", "audience": "students",
          "monthlyTarget": 8, "examples": [], "cannot": ["alcohol"]}
IDEA = {"id": "i1", "videoId": "v1", "clientId": "c1", "status": "saved", "dueDate": "2026-11-02",
        "notes": "", "shots": [{"time": "0-2s", "shot": "close-up"}]}


def test_lists_are_null_until_saved(client):
    assert client.get("/api/clients").json() is None
    assert client.get("/api/ideas").json() is None


def test_clients_round_trip(client):
    assert client.put("/api/clients", json=[CLIENT]).status_code == 200
    assert client.get("/api/clients").json() == [CLIENT]


def test_ideas_round_trip(client):
    assert client.put("/api/ideas", json=[IDEA]).status_code == 200
    assert client.get("/api/ideas").json() == [IDEA]


def test_bad_idea_status_is_rejected(client):
    assert client.put("/api/ideas", json=[{**IDEA, "status": "maybe"}]).status_code == 422


LIBRARY = {"videos": [{"id": "tt-1", "live": True, "url": "https://www.tiktok.com/@a/video/1"}],
           "formats": [{"id": "live-1", "shotList": [{"time": "0-2s", "shot": "close-up"}]}]}


def test_library_is_null_until_saved(client):
    assert client.get("/api/library").json() is None


def test_library_round_trip(client):
    assert client.put("/api/library", json=LIBRARY).status_code == 200
    assert client.get("/api/library").json() == LIBRARY


def test_library_needs_both_lists(client):
    assert client.put("/api/library", json={"videos": []}).status_code == 422
