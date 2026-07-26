#!/usr/bin/env python3
"""Generate a 1024x1024 no-alpha app icon from a name: solid color + initial(s).
Usage: make_icon.py "Nullfolio" /path/to/AppIcon.appiconset/icon-1024.png
"""
import sys, hashlib
from PIL import Image, ImageDraw, ImageFont

def main():
    name, out_path = sys.argv[1], sys.argv[2]
    h = hashlib.sha256(name.encode()).hexdigest()
    # ponytail: deterministic hue from hash, fixed sat/light for legibility — no palette config
    hue = int(h[:4], 16) % 360
    from colorsys import hls_to_rgb
    r, g, b = hls_to_rgb(hue / 360, 0.42, 0.55)
    bg = (int(r * 255), int(g * 255), int(b * 255))

    initials = "".join(w[0] for w in name.split()[:2]).upper()

    img = Image.new("RGB", (1024, 1024), bg)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/SFNSRounded.ttf", 460)
    except OSError:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 460)
    bbox = draw.textbbox((0, 0), initials, font=font)
    w, hh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((1024 - w) / 2 - bbox[0], (1024 - hh) / 2 - bbox[1]), initials,
               font=font, fill=(255, 255, 255))
    img.save(out_path)
    print(f"wrote {out_path} bg={bg} initials={initials}")

if __name__ == "__main__":
    main()
