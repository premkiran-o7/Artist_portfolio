from api._lib.models import Video, Category, Visibility


def test_category_enum_values():
    assert {c.value for c in Category} == {
        "color-grade", "short-form", "text-tracking", "3d-modeling"
    }


def test_visibility_has_no_private_option():
    # private videos cannot be embedded — see spec §4
    assert {v.value for v in Visibility} == {"public", "unlisted"}


def test_video_defaults_to_unlisted():
    assert Video.__table__.c.visibility.default.arg == Visibility.unlisted
