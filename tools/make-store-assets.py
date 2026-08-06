#!/usr/bin/env python3
"""Renders the popup with sample accounts and builds the listing assets.

Outputs:
  docs/screenshot.png            popup shot for the README
  store/screenshot-1280x800.png  Chrome Web Store screenshot
  store/promo-440x280.png        Chrome Web Store small promo tile

Usage: python3 tools/make-store-assets.py   (needs Pillow + google-chrome)

The accounts shown are fictional on purpose: these images are published, so
they must never carry a real session or e-mail address.
"""

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BG = (24, 23, 22)
PANEL = (31, 30, 29)
TEXT = (240, 238, 230)
MUTED = (163, 160, 154)
ACCENT = (217, 119, 87)

MOCK = """<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="popup.css"></head><body>
<header><h1>Claude Switch Account</h1><button class="ghost">↗</button></header>
<div class="status ok">Switched to “Work”</div>
<ul class="list">
  <li class="item active"><div class="avatar" style="background:#d97757">PE</div>
    <div class="info"><div class="name">Personal</div><div class="sub">personal@example.com</div></div>
    <span class="badge">active</span></li>
  <li class="item"><div class="avatar" style="background:#6a9fb5">WO</div>
    <div class="info"><div class="name">Work</div><div class="sub">me@company.example · Acme Inc</div></div></li>
  <li class="item"><div class="avatar" style="background:#8a7bbd">CL</div>
    <div class="info"><div class="name">Client</div><div class="sub">contact@client.example</div></div></li>
</ul>
<footer><button class="primary">＋ Save current session</button>
<div class="row"><button class="ghost small">↻ Refresh active account</button>
<button class="ghost small">⇥ New login</button></div></footer>
</body></html>"""


def font(size, bold=False):
    path = "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else "")
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, img.size[0] - 1, img.size[1] - 1], radius=radius, fill=255
    )
    out = img.copy()
    out.putalpha(mask)
    return out


def render_popup():
    """Screenshots the mock through headless Chrome at 3x for crisp downscaling."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "mock.html").write_text(MOCK)
        (tmp / "popup.css").write_text((ROOT / "popup.css").read_text())
        shot = tmp / "shot.png"
        subprocess.run(
            ["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu",
             f"--user-data-dir={tmp / 'profile'}", "--force-device-scale-factor=3",
             "--window-size=384,470", f"--screenshot={shot}",
             "--virtual-time-budget=3000", str(tmp / "mock.html")],
            check=True, capture_output=True, timeout=120,
        )
        img = Image.open(shot).convert("RGBA")
        # Trim the dead space below the footer so the panel hugs its content.
        return img.crop((0, 0, img.size[0], int(img.size[1] * 0.86)))


def readme_shot(popup):
    out = ROOT / "docs" / "screenshot.png"
    out.parent.mkdir(exist_ok=True)
    width = 420
    popup.resize((width, int(popup.size[1] * width / popup.size[0])), Image.LANCZOS).save(out)
    return out


def store_screenshot(popup):
    w, h = 1280, 800
    canvas = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(canvas)
    for y in range(h):  # subtle vertical wash
        k = y / h
        draw.line([(0, y), (w, y)], fill=(int(24 + 9 * k), int(23 + 6 * k), int(22 + 5 * k)))

    # Fit by width so the panel can never run past the right edge.
    panel_w = 440
    panel = popup.resize(
        (panel_w, int(popup.size[1] * panel_w / popup.size[0])), Image.LANCZOS
    )
    panel = rounded(panel, 20)
    px, py = 770, (h - panel.size[1]) // 2

    shadow = Image.new("RGBA", (panel.size[0] + 56, panel.size[1] + 56), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [28, 34, panel.size[0] + 28, panel.size[1] + 38], radius=26, fill=(0, 0, 0, 120)
    )
    canvas.paste(shadow.convert("RGB"), (px - 28, py - 28), shadow)
    canvas.paste(panel, (px, py), panel)

    draw.text((80, 250), "Several Claude", font=font(50, True), fill=TEXT)
    draw.text((80, 308), "accounts.", font=font(50, True), fill=TEXT)
    draw.text((80, 378), "One click to switch.", font=font(38, True), fill=ACCENT)
    for i, line in enumerate([
        "Save each claude.ai session as a profile,",
        "then swap accounts without logging out.",
        "Everything stays local in your browser.",
    ]):
        draw.text((82, 456 + i * 32), line, font=font(19), fill=MUTED)

    out = ROOT / "store" / "screenshot-1280x800.png"
    out.parent.mkdir(exist_ok=True)
    canvas.save(out)
    return out


def promo_tile():
    w, h = 440, 280
    tile = Image.new("RGB", (w, h), PANEL)
    draw = ImageDraw.Draw(tile)
    draw.rectangle([0, 0, w, 6], fill=ACCENT)

    icon = Image.open(ROOT / "icons" / "icon128.png").convert("RGBA").resize((72, 72), Image.LANCZOS)
    tile.paste(icon, (32, 52), icon)

    draw.text((122, 58), "Claude", font=font(30, True), fill=TEXT)
    draw.text((122, 94), "Switch Account", font=font(30, True), fill=ACCENT)
    draw.text((32, 160), "Multiple claude.ai accounts,", font=font(17), fill=MUTED)
    draw.text((32, 186), "one click to switch between them.", font=font(17), fill=MUTED)
    draw.text((32, 226), "Local only  ·  No tracking  ·  Open source", font=font(14), fill=(120, 117, 112))

    out = ROOT / "store" / "promo-440x280.png"
    out.parent.mkdir(exist_ok=True)
    tile.save(out)
    return out


if __name__ == "__main__":
    try:
        popup = render_popup()
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as err:
        sys.exit(f"headless Chrome render failed: {err}")

    for path in (readme_shot(popup), store_screenshot(popup), promo_tile()):
        print(f"{path.relative_to(ROOT)}  {Image.open(path).size}")
