# --- photos ---
#
# Mirrors tests/test_clients.py's clients section. Unlike clients, GET here isn't a plain
# "no auth required" smoke test in isolation — CSRF (403) and 404-on-missing get their own
# tests per the task brief, since routes_clients.py's own test file only covers those for
# coming-soon's delete route.


def test_create_photo_requires_auth(client_no_cookie):
    r = client_no_cookie.post("/api/py/photos", json={
        "title": "Sushi Board", "category": "3d-modeling",
        "image_url": "https://example.com/sushi.jpg",
    })
    assert r.status_code == 401


def test_create_photo_requires_csrf_header(admin_client_no_csrf):
    r = admin_client_no_csrf.post("/api/py/photos", json={
        "title": "Sushi Board", "category": "3d-modeling",
        "image_url": "https://example.com/sushi.jpg",
    })
    assert r.status_code == 403


def test_create_and_list_photos(admin_client):
    r = admin_client.post("/api/py/photos", json={
        "title": "Sushi Board", "category": "3d-modeling",
        "image_url": "https://example.com/sushi.jpg", "sort_order": 1,
    })
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "Sushi Board"
    assert body["category"] == "3d-modeling"
    assert body["image_url"] == "https://example.com/sushi.jpg"
    assert body["sort_order"] == 1

    listed = admin_client.get("/api/py/photos").json()
    assert [p["title"] for p in listed] == ["Sushi Board"]


def test_create_photo_rejects_unknown_category(admin_client):
    r = admin_client.post("/api/py/photos", json={
        "title": "Sushi Board", "category": "not-a-category",
        "image_url": "https://example.com/sushi.jpg",
    })
    assert r.status_code == 422


def test_create_photo_rejects_missing_image_url(admin_client):
    r = admin_client.post("/api/py/photos", json={
        "title": "Sushi Board", "category": "3d-modeling",
    })
    assert r.status_code == 422


def test_list_photos_does_not_require_auth(client_no_cookie):
    assert client_no_cookie.get("/api/py/photos").status_code == 200


def test_list_photos_orders_by_sort_order(admin_client):
    admin_client.post("/api/py/photos", json={
        "title": "Second", "category": "3d-modeling",
        "image_url": "https://example.com/b.jpg", "sort_order": 1,
    })
    admin_client.post("/api/py/photos", json={
        "title": "First", "category": "3d-modeling",
        "image_url": "https://example.com/a.jpg", "sort_order": 0,
    })
    listed = admin_client.get("/api/py/photos").json()
    assert [p["title"] for p in listed] == ["First", "Second"]


def test_patch_photo_updates_fields(admin_client):
    created = admin_client.post("/api/py/photos", json={
        "title": "Sushi Board", "category": "3d-modeling",
        "image_url": "https://example.com/sushi.jpg",
    }).json()
    r = admin_client.patch(f"/api/py/photos/{created['id']}", json={"title": "Sushi Board v2"})
    assert r.status_code == 200
    assert r.json()["title"] == "Sushi Board v2"


def test_patch_photo_ignores_explicit_null(admin_client):
    created = admin_client.post("/api/py/photos", json={
        "title": "Sushi Board", "category": "3d-modeling",
        "image_url": "https://example.com/sushi.jpg",
    }).json()
    r = admin_client.patch(f"/api/py/photos/{created['id']}", json={"title": None})
    assert r.status_code == 200
    assert r.json()["title"] == "Sushi Board"


def test_patch_photo_requires_auth(client_no_cookie):
    r = client_no_cookie.patch("/api/py/photos/00000000-0000-0000-0000-000000000000", json={
        "title": "nope",
    })
    assert r.status_code == 401


def test_patch_photo_requires_csrf_header(admin_client_no_csrf):
    r = admin_client_no_csrf.patch("/api/py/photos/00000000-0000-0000-0000-000000000000", json={
        "title": "nope",
    })
    assert r.status_code == 403


def test_patch_missing_photo_returns_404(admin_client):
    r = admin_client.patch("/api/py/photos/00000000-0000-0000-0000-000000000000", json={
        "title": "nope",
    })
    assert r.status_code == 404


def test_delete_photo_requires_auth(client_no_cookie):
    r = client_no_cookie.delete("/api/py/photos/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 401


def test_delete_photo_requires_csrf_header(admin_client_no_csrf):
    r = admin_client_no_csrf.delete("/api/py/photos/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 403


def test_delete_photo_removes_it(admin_client):
    created = admin_client.post("/api/py/photos", json={
        "title": "Sushi Board", "category": "3d-modeling",
        "image_url": "https://example.com/sushi.jpg",
    }).json()
    r = admin_client.delete(f"/api/py/photos/{created['id']}")
    assert r.status_code == 204
    listed = admin_client.get("/api/py/photos").json()
    assert created["id"] not in [p["id"] for p in listed]


def test_delete_missing_photo_returns_404(admin_client):
    r = admin_client.delete("/api/py/photos/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_create_photo_defaults_sort_order_to_zero(admin_client):
    r = admin_client.post("/api/py/photos", json={
        "title": "Sushi Board", "category": "3d-modeling",
        "image_url": "https://example.com/sushi.jpg",
    })
    assert r.status_code == 201
    assert r.json()["sort_order"] == 0
