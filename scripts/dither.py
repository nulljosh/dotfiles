"""Dither the site's artworks into 1-bit masks: Atkinson dithering (the classic Mac halftone), light parts become ink.
The page tints each mask with a segment colour and lays scanlines over it, the way Hermes treats its engravings.

Sources, both public domain, via Wikimedia Commons:
  janus.png   Bust of Janus, Vatican Museums. File:Janus-Vatican.JPG
  vulcan.png  Diego Velazquez, The Forge of Vulcan, 1630, Museo del Prado. File:Velazquez - La Fragua de Vulcano (Museo del Prado, 1630).jpg

    python3 scripts/dither.py janus.jpg landing/art/janus.png 640
Needs Pillow.
"""
import sys

from PIL import Image, ImageOps


def atkinson(img):
    """1-bit Atkinson dither of a greyscale image: spreads 6/8 of the error, so highlights stay open and crisp."""
    w, h = img.size
    px = [list(img.getdata())[y * w:(y + 1) * w] for y in range(h)]
    out = Image.new("LA", (w, h), (255, 0))
    for y in range(h):
        row = px[y]
        for x in range(w):
            old = row[x]
            new = 255 if old > 127 else 0
            err = (old - new) / 8
            if new:
                out.putpixel((x, y), (255, 255))
            for dx, dy in ((1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and ny < h:
                    px[ny][nx] += err
    return out


def main(src, dst, width):
    img = Image.open(src).convert("L")
    img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img = ImageOps.autocontrast(img, cutoff=2)
    atkinson(img).save(dst, optimize=True)
    print(f"{dst}: {img.width}x{img.height}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]))
