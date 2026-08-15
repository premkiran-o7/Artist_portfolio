"""Tests for POST /api/py/uploads/sign (Task 13).

boto3 presigning is pure local HMAC signing — it never makes a network call and never
validates the account, access key, or bucket. So these tests use dummy R2_* credentials
(set below via setdefault, mirroring the throwaway-credential pattern in conftest.py) and
never touch Cloudflare or the network. Creating the actual bucket and its CORS rules is
deferred until Manish has a Cloudflare account (see task-13-report.md).
"""

import os

os.environ.setdefault("R2_ACCOUNT_ID", "test-account-id")
os.environ.setdefault("R2_ACCESS_KEY_ID", "test-access-key")
os.environ.setdefault("R2_SECRET_ACCESS_KEY", "test-secret-key")
os.environ.setdefault("R2_BUCKET", "test-bucket")
os.environ.setdefault("R2_PUBLIC_BASE", "https://assets.test.example.com")


def test_sign_requires_auth(client_no_cookie):
    assert client_no_cookie.post("/api/py/uploads/sign", json={
        "filename": "a.jpg", "contentType": "image/jpeg",
        "category": "color-grade", "sizeBytes": 1000}).status_code == 401


def test_rejects_disallowed_mime(admin_client):
    r = admin_client.post("/api/py/uploads/sign", json={
        "filename": "x.svg", "contentType": "image/svg+xml",
        "category": "color-grade", "sizeBytes": 1000})
    assert r.status_code == 422


def test_rejects_oversize(admin_client):
    r = admin_client.post("/api/py/uploads/sign", json={
        "filename": "big.mp4", "contentType": "video/mp4",
        "category": "showreel", "sizeBytes": 21_000_000})
    assert r.status_code == 422


def test_key_is_derived_from_category_not_client_input(admin_client):
    r = admin_client.post("/api/py/uploads/sign", json={
        "filename": "../../evil.jpg", "contentType": "image/jpeg",
        "category": "color-grade", "sizeBytes": 1000})
    assert r.status_code == 200
    assert r.json()["key"].startswith("color-grade/thumbs/")
    assert ".." not in r.json()["key"]


def test_rejects_unknown_category(admin_client):
    r = admin_client.post("/api/py/uploads/sign", json={
        "filename": "a.jpg", "contentType": "image/jpeg",
        "category": "not-a-real-category", "sizeBytes": 1000})
    assert r.status_code == 422


def test_accepts_showreel_category_not_in_video_category_enum(admin_client):
    """category=showreel is not a member of the Category enum (only used for videos'
    color-grade/short-form/text-tracking/3d-modeling). It must still be accepted here —
    that's the whole point of validating against FOLDERS instead of Category."""
    r = admin_client.post("/api/py/uploads/sign", json={
        "filename": "reel.mp4", "contentType": "video/mp4",
        "category": "showreel", "sizeBytes": 5_000_000})
    assert r.status_code == 200
    assert r.json()["key"].startswith("showreel/")


def test_accepts_profile_category_for_portrait(admin_client):
    r = admin_client.post("/api/py/uploads/sign", json={
        "filename": "portrait.png", "contentType": "image/png",
        "category": "profile", "sizeBytes": 2_000_000})
    assert r.status_code == 200
    assert r.json()["key"].startswith("profile/")


def test_response_shape(admin_client):
    r = admin_client.post("/api/py/uploads/sign", json={
        "filename": "a.jpg", "contentType": "image/jpeg",
        "category": "color-grade", "sizeBytes": 1000})
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"uploadUrl", "publicUrl", "key"}
    assert body["uploadUrl"].startswith("https://")
    assert "X-Amz-Signature" in body["uploadUrl"]
    assert body["publicUrl"] == f"https://assets.test.example.com/{body['key']}"


def test_requires_csrf_header(admin_client_no_csrf):
    r = admin_client_no_csrf.post("/api/py/uploads/sign", json={
        "filename": "a.jpg", "contentType": "image/jpeg",
        "category": "color-grade", "sizeBytes": 1000})
    assert r.status_code == 403
