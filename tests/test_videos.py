def test_create_video_requires_auth(client_no_cookie):
    r = client_no_cookie.post("/api/py/videos", json={
        "title": "Test", "category": "color-grade",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
    })
    assert r.status_code == 401


def test_create_video_derives_youtube_id(admin_client):
    r = admin_client.post("/api/py/videos", json={
        "title": "Grade reel", "category": "color-grade",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
    })
    assert r.status_code == 201
    assert r.json()["youtube_id"] == "dQw4w9WgXcQ"


def test_create_video_defaults_to_unlisted(admin_client):
    r = admin_client.post("/api/py/videos", json={
        "title": "X", "category": "short-form",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
    })
    assert r.json()["visibility"] == "unlisted"


def test_rejects_private_visibility(admin_client):
    r = admin_client.post("/api/py/videos", json={
        "title": "X", "category": "short-form",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ", "visibility": "private",
    })
    assert r.status_code == 422


def test_rejects_unparseable_url(admin_client):
    r = admin_client.post("/api/py/videos", json={
        "title": "X", "category": "short-form", "youtube_url": "https://vimeo.com/1",
    })
    assert r.status_code == 422


def test_setting_featured_clears_the_previous_one_in_that_category(admin_client):
    a = admin_client.post("/api/py/videos", json={"title": "A", "category": "color-grade",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ", "is_featured": True}).json()
    b = admin_client.post("/api/py/videos", json={"title": "B", "category": "color-grade",
        "youtube_url": "https://youtu.be/oHg5SJYRHA0", "is_featured": True}).json()
    listed = admin_client.get("/api/py/videos?category=color-grade").json()
    featured = [v for v in listed if v["is_featured"]]
    assert len(featured) == 1 and featured[0]["id"] == b["id"]


# --- additional coverage beyond the brief's minimum ---

def test_list_videos_filters_by_category(admin_client):
    admin_client.post("/api/py/videos", json={"title": "Grade", "category": "color-grade",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ"})
    admin_client.post("/api/py/videos", json={"title": "Short", "category": "short-form",
        "youtube_url": "https://youtu.be/oHg5SJYRHA0"})
    listed = admin_client.get("/api/py/videos?category=short-form").json()
    assert len(listed) == 1
    assert listed[0]["title"] == "Short"


def test_list_videos_orders_by_sort_order(admin_client):
    admin_client.post("/api/py/videos", json={"title": "Second", "category": "short-form",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ", "sort_order": 2})
    admin_client.post("/api/py/videos", json={"title": "First", "category": "short-form",
        "youtube_url": "https://youtu.be/oHg5SJYRHA0", "sort_order": 1})
    listed = admin_client.get("/api/py/videos?category=short-form").json()
    assert [v["title"] for v in listed] == ["First", "Second"]


def test_list_videos_does_not_require_auth(client_no_cookie):
    r = client_no_cookie.get("/api/py/videos")
    assert r.status_code == 200


def test_update_video_requires_auth(client_no_cookie):
    r = client_no_cookie.patch("/api/py/videos/00000000-0000-0000-0000-000000000000", json={
        "title": "nope",
    })
    assert r.status_code == 401


def test_patch_video_updates_fields(admin_client):
    created = admin_client.post("/api/py/videos", json={
        "title": "Original", "category": "short-form",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
    }).json()
    r = admin_client.patch(f"/api/py/videos/{created['id']}", json={"title": "Renamed"})
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"
    assert r.json()["youtube_id"] == "dQw4w9WgXcQ"


def test_patch_video_reparses_youtube_id_on_url_change(admin_client):
    created = admin_client.post("/api/py/videos", json={
        "title": "Original", "category": "short-form",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
    }).json()
    r = admin_client.patch(f"/api/py/videos/{created['id']}", json={
        "youtube_url": "https://youtu.be/oHg5SJYRHA0",
    })
    assert r.status_code == 200
    assert r.json()["youtube_id"] == "oHg5SJYRHA0"


def test_patch_video_rejects_unparseable_url(admin_client):
    created = admin_client.post("/api/py/videos", json={
        "title": "Original", "category": "short-form",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
    }).json()
    r = admin_client.patch(f"/api/py/videos/{created['id']}", json={
        "youtube_url": "https://vimeo.com/1",
    })
    assert r.status_code == 422


def test_patch_video_featured_clears_previous_in_target_category(admin_client):
    a = admin_client.post("/api/py/videos", json={"title": "A", "category": "color-grade",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ", "is_featured": True}).json()
    b = admin_client.post("/api/py/videos", json={"title": "B", "category": "color-grade",
        "youtube_url": "https://youtu.be/oHg5SJYRHA0", "is_featured": False}).json()
    admin_client.patch(f"/api/py/videos/{b['id']}", json={"is_featured": True})
    listed = admin_client.get("/api/py/videos?category=color-grade").json()
    featured = [v for v in listed if v["is_featured"]]
    assert len(featured) == 1 and featured[0]["id"] == b["id"]


def test_patch_video_category_change_still_clears_target_categorys_featured(admin_client):
    # A PATCH that only changes `category` (not `is_featured`) still moves an
    # already-featured video into its new category, and must clear whatever was already
    # featured there — otherwise the target category ends up with two featured videos.
    moved = admin_client.post("/api/py/videos", json={"title": "A", "category": "color-grade",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ", "is_featured": True}).json()
    already_there = admin_client.post("/api/py/videos", json={"title": "B", "category": "short-form",
        "youtube_url": "https://youtu.be/oHg5SJYRHA0", "is_featured": True}).json()

    admin_client.patch(f"/api/py/videos/{moved['id']}", json={"category": "short-form"})

    listed = admin_client.get("/api/py/videos?category=short-form").json()
    featured = [v for v in listed if v["is_featured"]]
    assert len(featured) == 1 and featured[0]["id"] == moved["id"]
    assert already_there["id"] not in [v["id"] for v in featured]


def test_patch_with_explicit_null_is_ignored_not_500(admin_client):
    created = admin_client.post("/api/py/videos", json={
        "title": "Original", "category": "short-form",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
    }).json()
    r = admin_client.patch(f"/api/py/videos/{created['id']}", json={"title": None})
    assert r.status_code == 200
    assert r.json()["title"] == "Original"


def test_patch_missing_video_returns_404(admin_client):
    r = admin_client.patch("/api/py/videos/00000000-0000-0000-0000-000000000000", json={
        "title": "nope",
    })
    assert r.status_code == 404


def test_delete_video_requires_auth(client_no_cookie):
    r = client_no_cookie.delete("/api/py/videos/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 401


def test_delete_video_removes_it(admin_client):
    created = admin_client.post("/api/py/videos", json={
        "title": "Doomed", "category": "short-form",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ",
    }).json()
    r = admin_client.delete(f"/api/py/videos/{created['id']}")
    assert r.status_code == 204
    listed = admin_client.get("/api/py/videos?category=short-form").json()
    assert created["id"] not in [v["id"] for v in listed]


def test_delete_missing_video_returns_404(admin_client):
    r = admin_client.delete("/api/py/videos/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
