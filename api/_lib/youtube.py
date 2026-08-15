import re

_PATTERNS = [
    re.compile(r"(?:youtube\.com|youtube-nocookie\.com)/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})"),
    re.compile(r"youtu\.be/([A-Za-z0-9_-]{11})"),
    re.compile(r"youtube\.com/shorts/([A-Za-z0-9_-]{11})"),
    re.compile(r"youtube\.com/embed/([A-Za-z0-9_-]{11})"),
]


def parse_youtube_id(url: str) -> str:
    """Extract the 11-character video ID. Raises ValueError if absent."""
    if not isinstance(url, str) or not url.strip():
        raise ValueError("empty url")
    for pattern in _PATTERNS:
        if match := pattern.search(url):
            return match.group(1)
    raise ValueError(f"not a recognisable YouTube URL: {url!r}")
