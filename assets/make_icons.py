"""Regenerates app/favicon.ico and app/apple-icon.png. Run with `python3 assets/make_icons.py`.

Raster siblings of app/icon.svg: favicon.ico (legacy/bookmarks) and
apple-icon.png (iOS home screen). Drawn, not traced, so they match the SVG.

Everything is drawn at 8x and downsampled with LANCZOS — PIL has no
antialiasing on primitives, and a 16px favicon rendered directly looks like a
staircase."""
from pathlib import Path

from PIL import Image, ImageDraw

APP = Path(__file__).resolve().parent.parent / "app"

S = 8  # supersample factor
GROUND = (11, 11, 12, 255)
INK = (244, 241, 236, 255)
ACCENT = (232, 85, 43, 255)


def draw_mark(size, radius, stroke_w, pts, accent_bar):
    """size/radius/stroke/pts are in final pixels; drawn at 8x internally."""
    img = Image.new("RGBA", (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size * S - 1, size * S - 1], radius=radius * S, fill=GROUND)

    w = int(stroke_w * S)
    scaled = [(x * S, y * S) for x, y in pts]
    # joint="curve" rounds the interior joins; the caps have to be drawn by hand.
    d.line(scaled, fill=INK, width=w, joint="curve")
    for x, y in (scaled[0], scaled[-1]):
        d.ellipse([x - w // 2, y - w // 2, x + w // 2, y + w // 2], fill=INK)

    if accent_bar:
        x0, y0, x1, y1 = [v * S for v in accent_bar]
        d.rounded_rectangle([x0, y0, x1, y1], radius=(y1 - y0) / 2, fill=ACCENT)

    return img.resize((size, size), Image.LANCZOS)


# --- favicon.ico: exactly app/icon.svg's 32-unit geometry -------------------
# Master drawn at 48 so the .ico can carry a real 48x48 entry (PIL only
# downsamples when writing an ICO — a 32px master silently drops that size).
ICO_PTS = [(7.5, 23.5), (7.5, 9), (16, 18), (24.5, 9), (24.5, 23.5)]
M = 48 / 32
master = draw_mark(
    48,
    radius=7 * M,
    stroke_w=3.4 * M,
    pts=[(x * M, y * M) for x, y in ICO_PTS],
    accent_bar=tuple(v * M for v in (7.5, 26, 24.5, 28.2)),
)
master.save(
    APP / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
)

# --- apple-icon.png: square corners (iOS masks its own), mark scaled up -----
K = 180 / 32
apple = draw_mark(
    180,
    radius=0,
    stroke_w=3.4 * K,
    pts=[(x * K, y * K) for x, y in ICO_PTS],
    accent_bar=(7.5 * K, 26 * K, 24.5 * K, 28.2 * K),
)
apple.convert("RGB").save(
    APP / "apple-icon.png"
)
print("wrote favicon.ico + apple-icon.png")
