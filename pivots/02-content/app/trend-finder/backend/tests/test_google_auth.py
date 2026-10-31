import json
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
    enable(monkeypatch, {})
    assert client.get("/api/auth/config").json() == {"google": True}


@pytest.mark.parametrize("missing", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"])
def test_not_enabled_when_any_setting_missing(client, monkeypatch, missing):
    enable(monkeypatch, {})
    monkeypatch.delenv(missing)
    assert client.get("/api/auth/config").json() == {"google": False}
    assert client.get("/api/auth/google/start", follow_redirects=False).status_code == 404


def error_of(r):
    assert r.status_code == 302
    loc = urllib.parse.urlparse(r.headers["location"])
    assert loc.path == "/"
    return urllib.parse.parse_qs(loc.query)["google_error"][0]


def state_cleared(r):
    return any(h.startswith("tf_google_state=") and "Max-Age=0" in h for h in r.headers.get_list("set-cookie"))


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
    assert error_of(r) == "no_account"
    assert state_cleared(r)
    assert "tf_session" not in "".join(r.headers.get_list("set-cookie"))
    with server.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1


def test_callback_unverified_email_403(client, monkeypatch):
    add_user()
    enable(monkeypatch, {"sub": "g-3", "email": "daphne@agency.test", "email_verified": False})
    state = start_state(client)
    r = client.get("/api/auth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert error_of(r) == "unverified"
    assert state_cleared(r)


def test_callback_bad_state_400(client, monkeypatch):
    add_user()
    enable(monkeypatch, {"sub": "g-1", "email": "daphne@agency.test", "email_verified": True})
    start_state(client)
    r = client.get("/api/auth/google/callback", params={"code": "c", "state": "forged.value"}, follow_redirects=False)
    assert error_of(r) == "expired"
    assert state_cleared(r)
    client.cookies.clear()  # no state cookie at all
    r = client.get("/api/auth/google/callback", params={"code": "c", "state": "x.y"}, follow_redirects=False)
    assert error_of(r) == "expired"


def test_state_cleared_on_success(client, monkeypatch):
    add_user()
    enable(monkeypatch, {"sub": "g-1", "email": "daphne@agency.test", "email_verified": True})
    state = start_state(client)
    r = client.get("/api/auth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert r.status_code == 302 and state_cleared(r)


def test_state_older_than_ten_minutes_rejected(client, monkeypatch):
    add_user()
    enable(monkeypatch, {"sub": "g-1", "email": "daphne@agency.test", "email_verified": True})
    state = start_state(client)
    real = google_auth.time.time()
    monkeypatch.setattr(google_auth.time, "time", lambda: real + 11 * 60)
    r = client.get("/api/auth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert error_of(r) == "expired"
    assert state_cleared(r)


def test_exchange_failure_redirects_and_clears_state(client, monkeypatch):
    add_user()
    enable(monkeypatch, {})
    def boom(code):
        raise ValueError("nope")
    monkeypatch.setattr(google_auth, "exchange_code", boom)
    state = start_state(client)
    r = client.get("/api/auth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert error_of(r) == "rejected"
    assert state_cleared(r)


def test_other_google_sub_is_rejected(client, monkeypatch):
    add_user()
    with server.db() as conn:
        conn.execute("UPDATE users SET google_sub = 'g-old'")
    enable(monkeypatch, {"sub": "g-new", "email": "daphne@agency.test", "email_verified": True})
    state = start_state(client)
    r = client.get("/api/auth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert error_of(r) == "no_account"
    with server.db() as conn:
        assert conn.execute("SELECT google_sub FROM users").fetchone()[0] == "g-old"


def test_public_allow_list_is_specific():
    assert not server.needs_session("/api/auth/google/start")
    assert not server.needs_session("/api/auth/google/callback")
    assert server.needs_session("/api/auth/google/other")


def test_exchange_code_posts_fields_and_reads_claims(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-123")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "shh")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "http://testserver/cb")
    calls = []

    class Reply:
        def __init__(self, body):
            self.body = body
        def __enter__(self):
            return self
        def __exit__(self, *a):
            return False
        def read(self, *a):
            return json.dumps(self.body).encode()

    def fake_urlopen(req, timeout=None):
        calls.append((req.full_url, urllib.parse.parse_qs(req.data.decode()), req.get_method()))
        if req.full_url == google_auth.TOKEN_URL:
            return Reply({"id_token": "tok"})
        return Reply({"aud": "client-123", "sub": "g-9", "email": "x@y.test", "email_verified": "true"})

    monkeypatch.setattr(google_auth.urllib.request, "urlopen", fake_urlopen)
    assert google_auth.exchange_code("the-code") == {"sub": "g-9", "email": "x@y.test", "email_verified": True}
    assert calls[0] == (google_auth.TOKEN_URL, {"code": ["the-code"], "client_id": ["client-123"],
                                                "redirect_uri": ["http://testserver/cb"], "client_secret": ["shh"],
                                                "grant_type": ["authorization_code"]}, "POST")
    assert calls[1][0] == google_auth.TOKENINFO_URL and calls[1][1] == {"id_token": ["tok"]}


def test_exchange_code_rejects_token_for_other_app(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-123")
    answers = iter([{"id_token": "tok"}, {"aud": "someone-else", "sub": "g", "email": "a@b.co", "email_verified": "true"}])
    monkeypatch.setattr(google_auth, "_post_form", lambda url, fields: next(answers))
    with pytest.raises(ValueError):
        google_auth.exchange_code("c")


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


def test_migrate_runs_once_per_db_path(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "DB_PATH", tmp_path / "once.db")
    calls = []
    real = auth._migrate
    monkeypatch.setattr(auth, "_migrate", lambda conn: (calls.append(1), real(conn)))
    for _ in range(3):
        with server.db():
            pass
    assert len(calls) == 1
