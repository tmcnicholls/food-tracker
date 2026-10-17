#!/usr/bin/env python3
"""Generate simple PNG app icons for the Weekly Food Journal PWA.

No external dependencies (no Pillow) - writes raw PNG bytes using zlib/struct
so this works in a bare python3 environment. Draws a rounded-square green
background with a simple white "plate + fork" glyph, which is enough for a
recognisable home-screen icon without needing an image library.
"""
import struct
import zlib
import math
import os

BG = (27, 94, 61)        # deep green
FG = (255, 255, 255)     # white
ACCENT = (255, 200, 87)  # warm accent for the "food" dot


def rounded_square_mask(x, y, w, h, radius):
    """Return True if (x, y) is inside a rounded square of size w x h."""
    if x < radius and y < radius:
        return (x - radius) ** 2 + (y - radius) ** 2 <= radius ** 2
    if x >= w - radius and y < radius:
        return (x - (w - radius - 1)) ** 2 + (y - radius) ** 2 <= radius ** 2
    if x < radius and y >= h - radius:
        return (x - radius) ** 2 + (y - (h - radius - 1)) ** 2 <= radius ** 2
    if x >= w - radius and y >= h - radius:
        return (x - (w - radius - 1)) ** 2 + (y - (h - radius - 1)) ** 2 <= radius ** 2
    return True


def pixel(x, y, size):
    """Decide the colour of pixel (x, y) for an icon of the given size."""
    cx, cy = size / 2, size / 2
    radius = size * 0.18

    if not rounded_square_mask(x, y, size, size, int(size * 0.14)):
        return (0, 0, 0, 0)  # transparent corners

    # Plate: a ring (circle outline) in the upper-centre area
    plate_cx, plate_cy, plate_r = cx, cy - size * 0.02, size * 0.27
    dx, dy = x - plate_cx, y - plate_cy
    dist = math.hypot(dx, dy)

    if plate_r - size * 0.035 <= dist <= plate_r:
        return FG + (255,)
    if dist <= plate_r * 0.35:
        return ACCENT + (255,)

    # Fork: three vertical tines + a handle, to the left of the plate
    fork_cx = cx - size * 0.095
    tine_top = cy - size * 0.40
    tine_bottom = cy - size * 0.06
    handle_bottom = cy + size * 0.40
    tine_w = size * 0.028
    gap = size * 0.045

    for i in (-1, 0, 1):
        tx = fork_cx + i * gap
        if abs(x - tx) <= tine_w / 2 and tine_top <= y <= tine_bottom:
            return FG + (255,)
    if abs(x - fork_cx) <= tine_w / 2 and tine_bottom <= y <= handle_bottom:
        return FG + (255,)

    # Spoon: mirrored simple oval + handle, to the right of the plate
    spoon_cx = cx + size * 0.30
    spoon_cy = cy - size * 0.22
    spoon_rx, spoon_ry = size * 0.055, size * 0.09
    sdx, sdy = (x - spoon_cx) / spoon_rx, (y - spoon_cy) / spoon_ry
    if sdx * sdx + sdy * sdy <= 1:
        return FG + (255,)
    if abs(x - spoon_cx) <= tine_w / 2 and spoon_cy + spoon_ry <= y <= handle_bottom:
        return FG + (255,)

    return BG + (255,)


def make_png(path, size):
    rows = []
    for y in range(size):
        row = bytearray([0])  # filter type 0 for this scanline
        for x in range(size):
            r, g, b, a = pixel(x, y, size)
            row += bytes([r, g, b, a])
        rows.append(bytes(row))
    raw = b"".join(rows)
    compressed = zlib.compress(raw, 9)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")

    with open(path, "wb") as f:
        f.write(png)
    print(f"wrote {path} ({size}x{size}, {os.path.getsize(path)} bytes)")


if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "..", "icons")
    os.makedirs(out_dir, exist_ok=True)
    for sz in (32, 180, 192, 512):
        make_png(os.path.join(out_dir, f"icon-{sz}.png"), sz)
