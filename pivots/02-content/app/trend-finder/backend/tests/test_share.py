import base64

import pytest

import server


def basic(password, user="daphne"):
    return {"Authorization": "Basic " + base64.b64encode(f"{user}:{password}".encode()).decode()}


@pytest.fixture
def site(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>app</html>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "secret.txt").write_text("nope")
    monkeypatch.setattr(server, "DIST_DIR", dist)
    return dist


def test_the_built_app_is_served(client, site):
    assert client.get("/").text == "<html>app</html>"
    assert client.get("/assets/app.js").text == "console.log(1)"
    assert client.get("/some/page").text == "<html>app</html>"  # unknown paths get the app
    assert client.get("/api/nope").status_code == 404


def test_files_outside_the_build_are_not_served(client, site):
    assert "nope" not in client.get("/..%2Fsecret.txt").text


def test_no_password_set_means_open(client, site):
    assert client.get("/").status_code == 200
    assert client.get("/api/health").status_code == 200


def test_password_guards_pages_and_api(client, site, monkeypatch):
    monkeypatch.setattr(server, "APP_PASSWORD", "tofu")
    r = client.get("/")
    assert r.status_code == 401
    assert r.headers["WWW-Authenticate"].startswith("Basic")  # the browser asks for it
    assert client.get("/api/health").status_code == 401
    assert client.get("/api/health", headers=basic("wrong")).status_code == 401
    assert client.get("/api/health", headers={"Authorization": "Basic !!!"}).status_code == 401
    assert client.get("/api/health", headers=basic("tofu")).status_code == 200
    assert client.get("/", headers=basic("tofu", user="")).text == "<html>app</html>"  # any name works
