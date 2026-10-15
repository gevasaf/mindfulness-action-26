#!/usr/bin/env python3
"""Partner logo: from the partner's file (white background) to two site-ready PNGs.

    python3 tech/tools/partner-logo.py tech/tools/educare-logo-original.png site/assets/partners/educare

writes <out>.png (light theme) and <out>-dark.png (dark theme):
  - upscaled 3x (Lanczos) first, so the edges stay smooth on phone screens (the source is tiny);
  - white turned into transparency with "colour to alpha", so anti-aliased edges keep their
    true colour instead of a white fringe; JPEG-like noise near white is dropped;
  - cropped to the drawing, with a small margin;
  - dark version: dark pixels (the teal text, head and wing) are lifted toward a light tint of
    their own hue, muted, so they read on the dark paper; the bright orange and green stay as they are.
The partner's colours are not changed in the light version.
"""
import sys
import colorsys
import numpy as np
from PIL import Image

SCALE, PAD = 3, 6
DARK_TARGET_L = 0.78  # lightness the darkest pixels are lifted to in the dark version
DARK_DESAT = 0.8      # and how much of their saturation they lose (lifted teal at full saturation glows)


def color_to_alpha(rgb):
    """rgb: float array 0..1 on white. Returns (rgb, alpha) un-composited from white."""
    a = (1.0 - rgb).max(axis=2)
    a = np.where(a < 0.04, 0.0, a)  # near-white noise -> fully transparent
    safe = np.where(a > 0, a, 1.0)[..., None]
    out = (rgb - (1.0 - a[..., None])) / safe
    return np.clip(out, 0, 1), a


def lift_darks(rgb, a):
    h, w, _ = rgb.shape
    out = rgb.copy()
    flat = rgb.reshape(-1, 3)
    res = out.reshape(-1, 3)
    for i in np.nonzero(a.reshape(-1) > 0)[0]:
        hh, ll, ss = colorsys.rgb_to_hls(*flat[i])
        k = min(1.0, max(0.0, (0.5 - ll) / 0.5))  # 1 for black, 0 from mid-lightness up
        if k > 0:
            res[i] = colorsys.hls_to_rgb(hh, ll + (DARK_TARGET_L - ll) * k, ss * (1 - DARK_DESAT * k))
    return out


def main(src, out):
    im = Image.open(src).convert("RGB")
    im = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)
    rgb, a = color_to_alpha(np.asarray(im, dtype=np.float64) / 255.0)

    ys, xs = np.nonzero(a > 0.08)
    y0, y1 = max(ys.min() - PAD, 0), min(ys.max() + PAD + 1, a.shape[0])
    x0, x1 = max(xs.min() - PAD, 0), min(xs.max() + PAD + 1, a.shape[1])
    rgb, a = rgb[y0:y1, x0:x1], a[y0:y1, x0:x1]

    def save(c, path):
        px = np.dstack([c, a]) * 255.0
        Image.fromarray(np.round(px).astype(np.uint8), "RGBA").save(path, optimize=True)
        print(path, a.shape[1], "x", a.shape[0])

    save(rgb, out + ".png")
    save(lift_darks(rgb, a), out + "-dark.png")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
