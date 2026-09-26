#!/usr/bin/env python3
"""Refresh an ink logo: bitmap -> clean potrace vector -> 2x transparent PNG + previews.

Usage:
  logo.py SRC.png OUTDIR [--erase x1,y1,x2,y2 ...] [--draw MVG ...] [--bg '#faf8f6']
          [--turd 6] [--alpha 1.1] [--scale 2]
  logo.py --selftest

--erase paints white rects over noise (tiny text that traces badly) in SRC pixel coords.
--draw adds ImageMagick MVG strokes in black (motifs), e.g. "circle 118,296 124,296".
Writes OUTDIR/logo.svg, logo@2x.png (transparent), preview.png (on bg), compare.png (old|new).
"""
import argparse, os, subprocess, sys, tempfile

def run(*a):
    subprocess.run(a, check=True)

def refresh(src, out, erase=(), draw=(), bg="#faf8f6", turd=6, alpha=1.1, scale=2):
    os.makedirs(out, exist_ok=True)
    w, h = subprocess.check_output(["magick", "identify", "-format", "%w %h", src], text=True).split()
    pbm = os.path.join(out, "logo.pbm")
    # ponytail: alpha-extract assumes ink on transparent; flatten path covers ink on white
    cmd = ["magick", src, "-background", "white", "-flatten", "-colorspace", "gray", "-threshold", "55%"]
    if erase:
        cmd += ["-fill", "white", "-stroke", "none"] + sum([["-draw", "rectangle {},{} {},{}".format(*r.split(","))] for r in erase], [])
    if draw:
        cmd += ["-fill", "none", "-stroke", "black", "-strokewidth", "2.3"] + sum([["-draw", d] for d in draw], [])
    run(*cmd, "-threshold", "50%", pbm)
    svg = os.path.join(out, "logo.svg")
    # no blur: blur+threshold merged the brush strokes into blobs ("simplified too much")
    run("potrace", pbm, "-s", "-t", str(turd), "-a", str(alpha), "-O", "0.4", "-o", svg)
    big = f"{int(w) * scale}x{int(h) * scale}"
    png2 = os.path.join(out, f"logo@{scale}x.png")
    run("magick", "-density", str(96 * scale * 2), "-background", "none", svg, "-resize", big, f"PNG32:{png2}")
    prev = os.path.join(out, "preview.png")
    run("magick", png2, "-background", bg, "-flatten", prev)
    old = os.path.join(out, "old.png")
    run("magick", src, "-background", bg, "-flatten", "-resize", big, old)
    run("magick", old, prev, "+append", "-resize", "50%", os.path.join(out, "compare.png"))
    return svg, png2, prev

def selftest():
    d = tempfile.mkdtemp()
    src = os.path.join(d, "src.png")
    run("magick", "-size", "200x200", "xc:white", "-fill", "none", "-stroke", "black", "-strokewidth", "6",
        "-draw", "circle 100,100 100,40", "-draw", "rectangle 10,10 30,30", src)
    svg, png2, prev = refresh(src, os.path.join(d, "out"), erase=["5,5,35,35"], draw=["line 100,60 100,140"])
    assert os.path.getsize(svg) > 200 and "<path" in open(svg).read()
    assert subprocess.check_output(["magick", "identify", "-format", "%w", png2], text=True) == "400"
    # erased square is gone: its corner pixel is transparent in the 2x output
    px = subprocess.check_output(["magick", png2, "-format", "%[fx:p{40,40}.a]", "info:"], text=True)
    assert float(px) < 0.1, px
    print("selftest ok:", d)

if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        selftest(); sys.exit()
    p = argparse.ArgumentParser()
    p.add_argument("src"); p.add_argument("out")
    p.add_argument("--erase", nargs="*", default=[]); p.add_argument("--draw", nargs="*", default=[])
    p.add_argument("--bg", default="#faf8f6"); p.add_argument("--turd", type=int, default=6)
    p.add_argument("--alpha", type=float, default=1.1); p.add_argument("--scale", type=int, default=2)
    a = p.parse_args()
    for f in refresh(a.src, a.out, a.erase, a.draw, a.bg, a.turd, a.alpha, a.scale):
        print(f)
