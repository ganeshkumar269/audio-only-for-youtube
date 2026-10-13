"""Render icons/{16,32,48,128}.png: white headphones on a rounded square.

Pure standard library. Keep the geometry and ACCENT in sync with ICON_SVG in
src/main.js and the badge color in src/background.js.

Usage: python3 scripts/make_icons.py
"""
import math
import struct
import zlib
from pathlib import Path

ACCENT = (0x4F, 0x46, 0xE5)  # #4F46E5
WHITE = (255, 255, 255)
SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 4
OUT_DIR = Path(__file__).resolve().parent.parent / 'icons'


def rounded_rect(x, y, cx, cy, half_w, half_h, r):
    """Signed distance from (x, y) to a rounded rectangle (negative = inside)."""
    qx, qy = abs(x - cx) - half_w + r, abs(y - cy) - half_h + r
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r


def sample(x, y):
    """(inside background, inside headphones) for a point in the unit square."""
    bg = rounded_rect(x, y, .5, .5, .5, .5, .22) <= 0
    band = abs(math.hypot(x - .5, y - .56) - .30) <= .055 and y <= .58
    cups = (rounded_rect(x, y, .23, .66, .075, .14, .05) <= 0
            or rounded_rect(x, y, .77, .66, .075, .14, .05) <= 0)
    return bg, bg and (band or cups)


def render(size):
    rows = []
    n = SUPERSAMPLE * SUPERSAMPLE
    for j in range(size):
        row = bytearray(b'\x00')  # PNG filter type: none
        for i in range(size):
            bg_hits = fg_hits = 0
            for sj in range(SUPERSAMPLE):
                for si in range(SUPERSAMPLE):
                    bg, fg = sample((i + (si + .5) / SUPERSAMPLE) / size,
                                    (j + (sj + .5) / SUPERSAMPLE) / size)
                    bg_hits += bg
                    fg_hits += fg
            t = fg_hits / bg_hits if bg_hits else 0
            rgb = (round(a * (1 - t) + b * t) for a, b in zip(ACCENT, WHITE))
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
