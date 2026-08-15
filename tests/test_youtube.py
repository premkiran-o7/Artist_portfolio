import pytest

from api._lib.youtube import parse_youtube_id

CASES = [
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLabc", "dQw4w9WgXcQ"),
    ("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("http://youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
]


@pytest.mark.parametrize("url,expected", CASES)
def test_parses_every_known_url_shape(url, expected):
    assert parse_youtube_id(url) == expected


@pytest.mark.parametrize("bad", [
    "https://vimeo.com/12345", "not a url", "", "https://youtube.com/watch?v=short",
])
def test_rejects_bad_input(bad):
    with pytest.raises(ValueError):
        parse_youtube_id(bad)
