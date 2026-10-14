"""Render icons/{16,32,48,128}.png: white headphones with equalizer bars on a
violet-to-indigo rounded square.

Pure standard library. Keep the geometry and colors in sync with ICON_SVG in
src/main.js (same shapes in a 100x100 viewBox) and the badge color in
src/background.js.

Usage: python3 scripts/make_icons.py
"""
import math
import struct
import zlib
from pathlib import Path

GRADIENT_START = (0x81, 0x6C, 0xFA)  # #816CFA, top-left
GRADIENT_END = (0x43, 0x38, 0xCA)  # #4338CA, bottom-right
WHITE = (255, 255, 255)
SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 4
OUT_DIR = Path(__file__).resolve().parent.parent / 'icons'

# Equalizer bars between the ear cups: (x, half-height above the baseline).
BARS = ((.40, .07), (.50, .13), (.60, .09))


def rounded_rect(x, y, cx, cy, half_w, half_h, r):
    """Signed distance from (x, y) to a rounded rectangle (negative = inside)."""
    qx, qy = abs(x - cx) - half_w + r, abs(y - cy) - half_h + r
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r


def capsule(x, y, ax, ay, bx, by, r):
    """Signed distance to a line segment from (ax, ay) to (bx, by), thickened by r."""
    px, py, dx, dy = x - ax, y - ay, bx - ax, by - ay
    h = max(0, min(1, (px * dx + py * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - dx * h, py - dy * h) - r


def glyph(x, y):
    """Signed distance to the white artwork, in unit-square coordinates."""
    band = abs(math.hypot(x - .5, y - .56) - .30) - .045 if y <= .57 else 1
    cups = min(rounded_rect(x, y, .22, .66, .07, .13, .05),
               rounded_rect(x, y, .78, .66, .07, .13, .05))
    bars = min(capsule(x, y, bx, .68 - h, bx, .68 + h * .4, .035) for bx, h in BARS)
    return min(band, cups, bars)


def render(size):
    rows = []
    n = SUPERSAMPLE * SUPERSAMPLE
    for j in range(size):
        row = bytearray(b'\x00')  # PNG filter type: none
        for i in range(size):
            bg_hits = fg_hits = 0
            for sj in range(SUPERSAMPLE):
                for si in range(SUPERSAMPLE):
                    x = (i + (si + .5) / SUPERSAMPLE) / size
                    y = (j + (sj + .5) / SUPERSAMPLE) / size
                    if rounded_rect(x, y, .5, .5, .5, .5, .22) <= 0:
                        bg_hits += 1
                        fg_hits += glyph(x, y) <= 0
            t = (i + j + 1) / (2 * size)  # diagonal gradient position
            base = [a * (1 - t) + b * t for a, b in zip(GRADIENT_START, GRADIENT_END)]
            f = fg_hits / bg_hits if bg_hits else 0
            rgb = (round(c * (1 - f) + w * f) for c, w in zip(base, WHITE))
            row += bytes(rgb) + bytes([round(255 * bg_hits / n)])
        rows.append(bytes(row))
    return b''.join(rows)


def write_png(path, size, raw):
    def chunk(kind, data):
        return (struct.pack('>I', len(data)) + kind + data
                + struct.pack('>I', zlib.crc32(kind + data) & 0xFFFFFFFF))

    header = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header)
                     + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


if __name__ == '__main__':
    for size in SIZES:
        write_png(OUT_DIR / f'{size}.png', size, render(size))
        print(f'wrote icons/{size}.png')
