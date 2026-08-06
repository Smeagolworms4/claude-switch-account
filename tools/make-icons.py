#!/usr/bin/env python3
"""Génère icons/icon{16,48,128}.png (flèches de bascule sur fond Claude).

Usage : python3 tools/make-icons.py   (nécessite Pillow)
"""

from PIL import Image, ImageDraw

BG = (31, 30, 29, 255)    # #1f1e1d
FG = (217, 119, 87, 255)  # #d97757
SIZES = (16, 48, 128)


def make(size: int) -> None:
    s = size * 10  # supersampling, puis réduction LANCZOS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 0.22, fill=BG)

    # Deux flèches opposées (⇄) : la bascule de compte, lisible dès 16px.
    bar = s * 0.085   # épaisseur du trait
    head = s * 0.16   # demi-hauteur de la pointe
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
