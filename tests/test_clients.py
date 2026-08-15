# --- clients ---

def test_create_client_requires_auth(client_no_cookie):
    r = client_no_cookie.post("/api/py/clients", json={
        "name": "Acme", "instagram_url": "https://instagram.com/acme",
    })
    assert r.status_code == 401


def test_create_and_list_clients(admin_client):
    r = admin_client.post("/api/py/clients", json={
        "name": "Acme", "instagram_url": "https://instagram.com/acme", "sort_order": 1,
    })
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Acme"

    listed = admin_client.get("/api/py/clients").json()
    assert [c["name"] for c in listed] == ["Acme"]


def test_list_clients_does_not_require_auth(client_no_cookie):
    assert client_no_cookie.get("/api/py/clients").status_code == 200


def test_patch_client_updates_fields(admin_client):
    created = admin_client.post("/api/py/clients", json={
        "name": "Acme", "instagram_url": "https://instagram.com/acme",
    }).json()
    r = admin_client.patch(f"/api/py/clients/{created['id']}", json={"name": "Acme Corp"})
    assert r.status_code == 200
    assert r.json()["name"] == "Acme Corp"


def test_patch_missing_client_returns_404(admin_client):
    r = admin_client.patch("/api/py/clients/00000000-0000-0000-0000-000000000000", json={
        "name": "nope",
    })
    assert r.status_code == 404


def test_delete_client_requires_auth(client_no_cookie):
    r = client_no_cookie.delete("/api/py/clients/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 401


def test_delete_client_removes_it(admin_client):
    created = admin_client.post("/api/py/clients", json={
        "name": "Acme", "instagram_url": "https://instagram.com/acme",
    }).json()
    r = admin_client.delete(f"/api/py/clients/{created['id']}")
    assert r.status_code == 204
    listed = admin_client.get("/api/py/clients").json()
    assert created["id"] not in [c["id"] for c in listed]


# --- coming-soon ---

def test_create_coming_soon_requires_auth(client_no_cookie):
    r = client_no_cookie.post("/api/py/coming-soon", json={"title": "3D Modeling"})
    assert r.status_code == 401


def test_create_and_list_coming_soon(admin_client):
    r = admin_client.post("/api/py/coming-soon", json={"title": "3D Modeling", "blurb": "soon"})
    assert r.status_code == 201
    assert r.json()["is_live"] is False

    listed = admin_client.get("/api/py/coming-soon").json()
    assert [c["title"] for c in listed] == ["3D Modeling"]


def test_list_coming_soon_does_not_require_auth(client_no_cookie):
    assert client_no_cookie.get("/api/py/coming-soon").status_code == 200


def test_patch_coming_soon_can_flip_is_live(admin_client):
    created = admin_client.post("/api/py/coming-soon", json={"title": "3D Modeling"}).json()
    r = admin_client.patch(f"/api/py/coming-soon/{created['id']}", json={"is_live": True})
    assert r.status_code == 200
    assert r.json()["is_live"] is True


def test_patch_missing_coming_soon_returns_404(admin_client):
    r = admin_client.patch("/api/py/coming-soon/00000000-0000-0000-0000-000000000000", json={
        "is_live": True,
    })
    assert r.status_code == 404


# --- playlists ---

def test_upsert_playlist_requires_auth(client_no_cookie):
    r = client_no_cookie.put("/api/py/playlists/color-grade", json={
        "youtube_playlist_url": "https://youtube.com/playlist?list=PLabc",
    })
    assert r.status_code == 401


def test_upsert_playlist_creates_then_updates(admin_client):
    r = admin_client.put("/api/py/playlists/color-grade", json={
        "youtube_playlist_url": "https://youtube.com/playlist?list=PLabc",
    })
    assert r.status_code == 200
    assert r.json()["category"] == "color-grade"

    r2 = admin_client.put("/api/py/playlists/color-grade", json={
        "youtube_playlist_url": "https://youtube.com/playlist?list=PLxyz",
    })
    assert r2.status_code == 200
    assert r2.json()["youtube_playlist_url"] == "https://youtube.com/playlist?list=PLxyz"


def test_upsert_playlist_rejects_unknown_category(admin_client):
    r = admin_client.put("/api/py/playlists/not-a-category", json={
        "youtube_playlist_url": "https://youtube.com/playlist?list=PLabc",
    })
    assert r.status_code == 422
