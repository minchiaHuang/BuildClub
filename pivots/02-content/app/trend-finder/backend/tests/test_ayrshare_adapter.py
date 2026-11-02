"""AyrsharePublisher with a mocked HTTP layer: request shape and response mapping. Nothing here touches the network."""

import pytest

import publishers
from publishers import AyrsharePublisher, PublisherError


class Http:
    def __init__(self, status=200, data=None):
        self.calls, self.status, self.data = [], status, data or {}

    def __call__(self, method, url, headers, body):
        self.calls.append((method, url, headers, body))
        return self.status, self.data


URL = "https://cdn.example/final.mp4"


def test_post_request_shape():
    http = Http(data={"status": "success", "id": "top1", "postIds": [
        {"status": "success", "platform": "tiktok", "id": "t1"},
        {"status": "success", "platform": "youtube", "id": "y1", "postUrl": "https://youtu.be/y1"}]})
    recs = AyrsharePublisher("KEY", http).publish(URL, "cap", ["tiktok", "youtube"])
    method, url, headers, body = http.calls[0]
    assert (method, url) == ("POST", "https://api.ayrshare.com/api/post")
    assert headers["Authorization"] == "Bearer KEY"
    assert body == {"post": "cap", "platforms": ["tiktok", "youtube"], "mediaUrls": [URL], "isVideo": True}
    assert [(r["platform"], r["status"], r["externalId"], r["url"]) for r in recs] == [
        ("tiktok", "published", "top1", None), ("youtube", "published", "top1", "https://youtu.be/y1")]


def test_schedule_date_format_and_status():
    http = Http(data={"status": "scheduled", "id": "top2", "scheduleDate": "x"})
    recs = AyrsharePublisher("K", http).publish(URL, "", ["tiktok"], schedule_at=1_800_000_000)
    assert http.calls[0][3]["scheduleDate"] == "2027-01-15T08:00:00Z"
    assert recs[0]["status"] == "scheduled" and recs[0]["publishedAt"] is None


def test_local_file_refused_without_call():
    http = Http()
    with pytest.raises(PublisherError, match="https"):
        AyrsharePublisher("K", http).publish("/tmp/final.mp4", "", ["tiktok"])
    assert http.calls == []


def test_api_error_raises():
    with pytest.raises(PublisherError, match="401"):
        AyrsharePublisher("K", Http(401, {"status": "error", "message": "bad key"})).publish(URL, "", ["tiktok"])


def test_metrics_request_and_mapping():
    http = Http(data={"tiktok": {"analytics": {"videoViews": 90, "likeCount": 9, "commentsCount": 2, "shareCount": 1}}})
    got = AyrsharePublisher("K", http).fetch_metrics("top1", "tiktok")
    assert http.calls[0][:2] == ("POST", "https://api.ayrshare.com/api/analytics/post")
    assert http.calls[0][3] == {"id": "top1", "platforms": ["tiktok"]}
    assert got == {"views": 90, "likes": 9, "comments": 2, "shares": 1, "saves": None}


def test_instagram_metric_names():
    http = Http(data={"instagram": {"analytics": {"viewsCount": 5, "likeCount": 1, "commentsCount": 0, "sharesCount": 2, "savedCount": 3}}})
    got = AyrsharePublisher("K", http).fetch_metrics("t", "instagram")
    assert got == {"views": 5, "likes": 1, "comments": 0, "shares": 2, "saves": 3}


def test_selection_by_env(monkeypatch):
    monkeypatch.setenv("PUBLISHER", "ayrshare")
    monkeypatch.setenv("AYRSHARE_API_KEY", "k")
    assert isinstance(publishers.get_publisher(), AyrsharePublisher)
    monkeypatch.setenv("PUBLISHER", "nonsense")
    with pytest.raises(PublisherError):
        publishers.get_publisher()
