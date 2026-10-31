import sqlite3
import urllib.parse

import pytest

import auth
import google_auth
import server


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    auth.failures.clear()
    for name in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"):
        monkeypatch.delenv(name, raising=False)


def add_user(email="daphne@agency.test"):
    with server.db() as conn:
        auth.create_user(conn, email, "Daphne", "Sample Social Co.", "correct horse")


def enable(monkeypatch, who):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-123")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "shh")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "http://testserver/api/auth/google/callback")
    monkeypatch.setattr(google_auth, "exchange_code", lambda code: who)


def start_state(client):
    r = client.get("/api/auth/google/start", follow_redirects=False)
    assert r.status_code == 302
    return urllib.parse.parse_qs(urllib.parse.urlparse(r.headers["location"]).query)["state"][0]


def test_config_false_without_env(client):
    add_user()  # accounts exist, so this also proves the endpoint needs no session
    assert client.get("/api/auth/config").json() == {"google": False}


def test_config_true_with_env(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-123")
    assert client.get("/api/auth/config").json() == {"google": True}


def test_start_404_when_disabled(client):
    add_user()
    r = client.get("/api/auth/google/start", follow_redirects=False)
    assert r.status_code == 404
    assert r.json() == {"error": "Google sign-in is not enabled."}


def test_callback_links_existing_user(client, monkeypatch):
    add_user()
    enable(monkeypatch, {"sub": "g-1", "email": "Daphne@Agency.test", "email_verified": True})
    state = start_state(client)
    r = client.get("/api/auth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert r.status_code == 302
    assert "tf_session=" in r.headers["set-cookie"]
    with server.db() as conn:
        assert conn.execute("SELECT google_sub FROM users").fetchone()[0] == "g-1"
    assert client.get("/api/auth/me").json()["email"] == "daphne@agency.test"


def test_callback_unknown_email_403(client, monkeypatch):
    add_user()
    enable(monkeypatch, {"sub": "g-2", "email": "stranger@elsewhere.test", "email_verified": True})
    state = start_state(client)
    r = client.get("/api/auth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert r.status_code == 403
    assert "tf_session" not in r.headers.get("set-cookie", "")
    with server.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1


def test_callback_unverified_email_403(client, monkeypatch):
    add_user()
    enable(monkeypatch, {"sub": "g-3", "email": "daphne@agency.test", "email_verified": False})
    state = start_state(client)
    assert client.get("/api/auth/google/callback", params={"code": "c", "state": state}).status_code == 403


def test_callback_bad_state_400(client, monkeypatch):
    add_user()
    enable(monkeypatch, {"sub": "g-1", "email": "daphne@agency.test", "email_verified": True})
    start_state(client)
    assert client.get("/api/auth/google/callback", params={"code": "c", "state": "forged.value"}).status_code == 400
    client.cookies.clear()  # no state cookie at all
    assert client.get("/api/auth/google/callback", params={"code": "c", "state": "x.y"}).status_code == 400


def test_existing_db_without_column_migrates(tmp_path, monkeypatch):
    path = tmp_path / "old.db"
    old = sqlite3.connect(path)
    old.execute("CREATE TABLE users (email TEXT PRIMARY KEY, name TEXT, agency TEXT, salt BLOB, hash BLOB, created INTEGER)")
    old.execute("INSERT INTO users VALUES ('a@b.co', 'Ann', 'Agency', x'00', x'01', 5)")
    old.commit()
    old.close()
    monkeypatch.setattr(server, "DB_PATH", path)
    with server.db() as conn:
        cols = [c[1] for c in conn.execute("PRAGMA table_info(users)")]
        row = conn.execute("SELECT email, name, agency, salt, hash, created, google_sub FROM users").fetchone()
    assert "google_sub" in cols
    assert row == ("a@b.co", "Ann", "Agency", b"\x00", b"\x01", 5, None)
    with server.db():  # a second start finds the column and does nothing
        pass
