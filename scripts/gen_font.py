"""Dotfiles Sans: Inter (Rasmus Andersson, SIL Open Font License 1.1, no reserved name), renamed, with every dot
(the tittles on i and j, the period, colon, semicolon, ellipsis, ! and ?) redrawn as a true circle a little larger
than Inter's, so the dot in "dotfiles" is the one thing the face owns.
Inter is drawn in the spirit of San Francisco: open shapes, even proportional spacing, built for screens.

Same method as Hermes Sans: pinned release, renamed, OFL shipped beside the fonts, original copyright kept in the
name table, fixed timestamps so every build is the same bytes. Spacing never moves: advances are untouched.

    python3 scripts/gen_font.py            # writes landing/fonts/DotfilesSans-{Regular,Medium,Semibold,Bold}.woff2 + OFL.txt
    python3 scripts/gen_font.py --check    # named Dotfiles Sans, OFL present, dots are circles
Needs fonttools and brotli.
"""
import io
import os
import sys
import urllib.request

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import DecomposingRecordingPen, RecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "landing", "fonts")
SOURCE = "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.2.5/"
WEIGHTS = {"Regular": 400, "Medium": 500, "Semibold": 600, "Bold": 700}
DOTTED = ".:;!?ij…"
GROW = 1.14      # circle diameter over the original dot's larger side
K = 0.5523       # cubic handle length for a quarter circle


def fetch(path):
    """Bytes of one file from the pinned Inter release."""
    with urllib.request.urlopen(SOURCE + path, timeout=60) as r:
        return r.read()


def contours(glyphs, name):
    """The glyph's outline, components flattened, split into one recording per contour."""
    rec = DecomposingRecordingPen(glyphs)
    glyphs[name].draw(rec)
    out, cur = [], []
    for op, args in rec.value:
        cur.append((op, args))
        if op in ("closePath", "endPath"):
            out.append(cur)
            cur = []
    return out


def bounds(contour, glyphs):
    rp = RecordingPen()
    rp.value = contour
    bp = BoundsPen(glyphs)
    rp.replay(bp)
    return bp.bounds


def is_dot(b, upm):
    """Small and roughly square: a tittle or a full stop, never a stem or a bowl."""
    w, h = b[2] - b[0], b[3] - b[1]
    return 0 < w < 0.2 * upm and 0 < h < 0.2 * upm and 0.7 < w / h < 1.43


def circle(pen, cx, cy, r):
    pen.moveTo((cx + r, cy))
    pen.curveTo((cx + r, cy + K * r), (cx + K * r, cy + r), (cx, cy + r))
    pen.curveTo((cx - K * r, cy + r), (cx - r, cy + K * r), (cx - r, cy))
    pen.curveTo((cx - r, cy - K * r), (cx - K * r, cy - r), (cx, cy - r))
    pen.curveTo((cx + K * r, cy - r), (cx + r, cy - K * r), (cx + r, cy))
    pen.closePath()


def round_dots(font):
    """Replace each dot contour with a circle on the same centre; returns how many dots were redrawn."""
    glyphs, glyf, hmtx, cmap = font.getGlyphSet(), font["glyf"], font["hmtx"], font.getBestCmap()
    upm, count = font["head"].unitsPerEm, 0
    for ch in DOTTED:
        name = cmap.get(ord(ch))
        if not name:
            continue
        parts = contours(glyphs, name)
        tt = TTGlyphPen(None)
        for c in parts:
            b = bounds(c, glyphs)
            if b and is_dot(b, upm):
                r = max(b[2] - b[0], b[3] - b[1]) * GROW / 2
                circle(Cu2QuPen(tt, max_err=1.0), (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, r)
                count += 1
            else:
                rp = RecordingPen()
                rp.value = c
                rp.replay(tt)
        glyf[name] = tt.glyph()
        glyf[name].recalcBounds(glyf)
        hmtx[name] = (hmtx[name][0], glyf[name].xMin)
    return count


def rename(font, style):
    """Give the outlines the Dotfiles Sans name; copyright (0) and license (13, 14) stay as the authors wrote them."""
    names = {1: "Dotfiles Sans", 2: style, 3: f"DotfilesSans-{style}", 4: f"Dotfiles Sans {style}", 5: "Version 1.000",
             6: f"DotfilesSans-{style}", 16: "Dotfiles Sans", 17: style}
    table = font["name"]
    table.names = [n for n in table.names if n.nameID in (0, 13, 14)]
    for nid, text in names.items():
        table.setName(text, nid, 3, 1, 0x409)
        table.setName(text, nid, 1, 0, 0)
    font["head"].created = font["head"].modified = 3_700_000_000
    font["OS/2"].achVendID = "DOTF"


def check():
    """Self-check of the shipped files."""
    assert os.path.exists(os.path.join(OUT, "OFL.txt")), "the OFL must ship with the fonts"
    for style in WEIGHTS:
        f = TTFont(os.path.join(OUT, f"DotfilesSans-{style}.woff2"))
        assert f["name"].getDebugName(1) == "Dotfiles Sans", "family name"
        assert f["name"].getDebugName(0), "the original copyright must stay in the name table"
        g = f["glyf"][f.getBestCmap()[ord(".")]]
        assert abs((g.xMax - g.xMin) - (g.yMax - g.yMin)) <= 2, "the period is not a circle"
    print(f"font ok: Dotfiles Sans (Inter, OFL), {len(WEIGHTS)} weights, dots are circles")


def main():
    if "--check" in sys.argv:
        return check()
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "OFL.txt"), "wb") as f:
        f.write(fetch("LICENSE"))
    for style, weight in WEIGHTS.items():
        font = TTFont(io.BytesIO(fetch(f"files/inter-latin-{weight}-normal.woff2")))
        dots = round_dots(font)
        rename(font, style)
        font.flavor = "woff2"
        font.save(os.path.join(OUT, f"DotfilesSans-{style}.woff2"), reorderTables=False)
        print(f"DotfilesSans-{style}: Inter {weight}, {dots} dots made round")


if __name__ == "__main__":
    main()
