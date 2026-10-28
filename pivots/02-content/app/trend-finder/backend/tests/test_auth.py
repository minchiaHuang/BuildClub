import base64
import sqlite3
import time

import pytest

import auth
import server


@pytest.fixture
def site(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>app</html>")
    monkeypatch.setattr(server, "DIST_DIR", dist)
    return dist


@pytest.fixture(autouse=True)
def fresh_limits():
    auth.failures.clear()


def add_user(email="daphne@agency.test", password="correct horse", name="Daphne", agency="Sample Social Co."):
    with server.db() as conn:
        auth.create_user(conn, email, name, agency, password)


def login(client, email="daphne@agency.test", password="correct horse"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_no_users_keeps_basic_auth(client, site, monkeypatch):
    assert client.get("/api/auth/me").json() == {"users": False}
    monkeypatch.setattr(server, "APP_PASSWORD", "tofu")
    assert client.get("/api/health").status_code == 401
    assert client.get("/").headers["WWW-Authenticate"].startswith("Basic")
    ok = {"Authorization": "Basic " + base64.b64encode(b"x:tofu").decode()}
    assert client.get("/api/health", headers=ok).status_code == 200
    assert client.get("/api/auth/me", headers=ok).json() == {"users": False}


def test_login_sets_http_only_cookie(client, site):
    add_user()
    r = login(client, "  Daphne@Agency.test ")  # the address is trimmed and lower-cased
    assert r.status_code == 200
    assert r.json() == {"email": "daphne@agency.test", "name": "Daphne", "agency": "Sample Social Co."}
    cookie = r.headers["set-cookie"].lower()
    assert "tf_session=" in cookie and "httponly" in cookie and "samesite=lax" in cookie
    assert "path=/" in cookie and "max-age=2592000" in cookie and "secure" not in cookie
    me = client.get("/api/auth/me").json()
    assert me == {"users": True, "email": "daphne@agency.test", "name": "Daphne", "agency": "Sample Social Co."}
    https = client.post(
        "/api/auth/login", json={"email": "daphne@agency.test", "password": "correct horse"},
        headers={"x-forwarded-proto": "https"})
    assert "secure" in https.headers["set-cookie"].lower()


def test_wrong_password_401_same_message_for_unknown_email(client, site):
    add_user()
    wrong = login(client, password="nope")
    unknown = login(client, email="nobody@agency.test")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"error": "Wrong email or password."}
    assert "set-cookie" not in wrong.headers


def test_api_needs_session_once_users_exist(client, site, monkeypatch):
    monkeypatch.setattr(server, "APP_PASSWORD", "tofu")  # Basic is no longer asked once users exist
    add_user()
    for method, path in [("get", "/api/clients"), ("get", "/api/ideas"), ("post", "/api/share"),
                         ("delete", "/api/share?clientId=c1"), ("delete", "/api/share/tok"),
                         ("get", "/api/auth/me"), ("get", "/api/reviewX"), ("get", "/api/review"),
                         ("get", "/api/stats/x"), ("post", "/api/auth/login/x"), ("post", "/api/auth/logout")]:
        r = getattr(client, method)(path)
        assert r.status_code == 401, path
        assert r.json().get("error") and "WWW-Authenticate" not in r.headers, path
    assert login(client).status_code == 200
    assert client.get("/api/clients").status_code == 200
    assert client.get("/api/health").status_code == 200


def test_share_routes_skip_login(client, site):
    add_user()
    assert client.get("/api/review/sometoken").status_code == 404  # reaches the route: "This link isn't active."
    assert client.post("/api/review/sometoken/decide", json={"ideaId": "i", "approved": True}).status_code in (404, 422)
    assert client.get("/api/stats").status_code == 200
    assert client.get("/api/health").status_code == 200
    assert client.get("/").text == "<html>app</html>"
    assert client.get("/review/sometoken").text == "<html>app</html>"
    assert client.get("/api/clients").status_code == 401


def test_logout_kills_session(client, site):
    add_user()
    login(client)
    token = client.cookies["tf_session"]
    assert client.post("/api/auth/logout").status_code == 204
    client.cookies.set("tf_session", token)  # replaying the old cookie gets nowhere
    assert client.get("/api/clients").status_code == 401
    with server.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0


def test_expired_session_401(client, site):
    add_user()
    login(client)
    with server.db() as conn:
        conn.execute("UPDATE sessions SET expires = ?", (int(time.time()) - 1,))
    assert client.get("/api/clients").status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    with server.db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0


def test_login_rate_limited(client, site):
    add_user()
    for _ in range(10):
        assert login(client, password="nope").status_code == 401
    assert login(client, password="nope").status_code == 429
    assert login(client).status_code == 429  # even the right password waits
    assert login(client, email="DAPHNE@agency.test").status_code == 429  # same address, any spelling
    assert login(client, email="other@agency.test", password="x").status_code == 401  # other addresses are separate
    auth.failures["daphne@agency.test"] = [time.time() - auth.WINDOW_SECONDS - 1] * 10
    assert login(client).status_code == 200


def test_password_stored_hashed(client, site):
    add_user(password="s3cret-pass-phrase")
    conn = sqlite3.connect(server.DB_PATH)
    row = conn.execute("SELECT salt, hash FROM users").fetchone()
    assert isinstance(row[0], bytes) and isinstance(row[1], bytes) and len(row[1]) == 32
    dump = b"".join(str(r).encode() for t in ("users", "sessions", "store") for r in conn.execute(f"SELECT * FROM {t}"))
    assert b"s3cret-pass-phrase" not in dump
    assert b"s3cret-pass-phrase" not in server.DB_PATH.read_bytes()
    assert auth.verify_password("s3cret-pass-phrase", row[0], row[1])
    assert not auth.verify_password("other", row[0], row[1])
