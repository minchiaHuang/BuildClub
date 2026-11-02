"""Shared setup for publishing tests: an approved plan whose finished video the manager approved."""

import json

import server
import renders


def approved_cut(client, idea_id="ok", hashtags=None, status="approved", client_id="a"):
    others = [i for i in client.get("/api/ideas").json() or [] if i["id"] != idea_id]
    client.put("/api/ideas", json=others + [{"id": idea_id, "videoId": f"v-{idea_id}", "clientId": client_id, "status": "approved",
                                     "dueDate": "2026-11-02", "notes": "", "sentAt": 1000}])
    if not client.get("/api/clients").json():
        client.put("/api/clients", json=[{"id": "a", "name": "Tofu Bar", "niche": "food", "audience": "students", "monthlyTarget": 8, "examples": [], "cannot": []}])
    if hashtags is not None:
        with server.db() as conn:
            row = conn.execute("SELECT value FROM store WHERE key = 'library'").fetchone()
            videos = json.loads(row[0])["videos"] if row else []
            videos.append({"id": f"v-{idea_id}", "hashtags": hashtags})
            conn.execute("INSERT OR REPLACE INTO store (key, value) VALUES ('library', ?)",
                         (json.dumps({"videos": videos, "formats": []}),))
    folder = renders.cut_folder(server.MEDIA_DIR.resolve() if server.MEDIA_DIR.exists() else _mk(), idea_id)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "final.mp4").write_bytes(b"video")
    with server.db() as conn:
        conn.execute("INSERT OR REPLACE INTO cut_reviews (idea_id, version, status, sent_at, decided_at) VALUES (?, ?, ?, 1, 2)",
                     (idea_id, renders.final_version(folder), status))
    return folder


def _mk():
    server.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    return server.MEDIA_DIR.resolve()
