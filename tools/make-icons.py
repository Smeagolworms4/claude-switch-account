#!/usr/bin/env python3
"""Generates icons/icon{16,48,128}.png (switch arrows on a dark background).

Usage: python3 tools/make-icons.py   (requires Pillow)
"""

from PIL import Image, ImageDraw

BG = (31, 30, 29, 255)    # #1f1e1d
FG = (217, 119, 87, 255)  # #d97757
SIZES = (16, 48, 128)


def make(size: int) -> None:
    s = size * 10  # supersample, then downscale with LANCZOS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 0.22, fill=BG)

    # Two opposing arrows: the account switch, still readable at 16px.
    bar = s * 0.085   # stroke thickness
    head = s * 0.16   # arrowhead half-height
    x0, x1 = s * 0.22, s * 0.78

    for y, direction in ((s * 0.37, 1), (s * 0.63, -1)):
        tip = x1 if direction > 0 else x0
        base = tip - direction * head * 1.25
        shaft_start = x0 if direction > 0 else x1
        shaft_end = base + direction * bar * 0.3
        d.line([(shaft_start, y), (shaft_end, y)], fill=FG, width=int(bar))
        d.polygon([(tip, y), (base, y - head), (base, y + head)], fill=FG)

    img.resize((size, size), Image.LANCZOS).save(f"icons/icon{size}.png")


if __name__ == "__main__":
    for n in SIZES:
        make(n)
    print("icons:", ", ".join(f"icon{n}.png" for n in SIZES))
