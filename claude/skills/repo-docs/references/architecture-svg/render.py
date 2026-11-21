#!/usr/bin/env python3
"""Render a house-style diagram (Liquid Glass on the Orchard tokens, see glass.py) from a
hand-written row spec.
Spec (JSON on stdin): {"title":..,"accent":"clay|leaf|gold","out":path,
 "rows":[{"kind":"client|core|ext|store|gate","cells":["A","B"]},...],
 "arrows":true, "loop":{"from":row,"to":row,"label":".."}}   # last two: agent graphs
ponytail: layout only; every repo's rows are still written by hand.
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glass
from glass import esc

W = 640

def main():
    spec = json.load(sys.stdin)
    acc = glass.color(spec.get("accent", "clay"))
    rows, loop = spec["rows"], spec.get("loop")
    H = 60 + len(rows) * 90
    o = [glass.head(W, H),
         f'<text class="t" x="320" y="30" font-size="16" font-weight="600" text-anchor="middle">{esc(spec["title"])}</text>']
    centers = []
    for i, row in enumerate(rows):
        y = 55 + i * 90
        cells, kind = row["cells"], row["kind"]
        small = kind == "ext"
        h = 30 if small else 40
        n, gap = len(cells), 30
        bw = min(160 if small else 200, (W - 80 - gap * (n - 1)) // n)
        total = n * bw + gap * (n - 1)
        x0 = (W - total) // 2
        rowc = []
        for j, c in enumerate(cells):
            x = x0 + j * (bw + gap)
            cx = x + bw // 2
            rowc.append(cx)
            if kind == "gate":       # the one bold box: a person decides here
                o.append(glass.card(x, y, bw, h, 12, "gate"))
            elif kind in ("core", "store"):
                o.append(glass.card(x, y, bw, h, 12, f"tint-{acc}"))
            elif small:              # checks are capsules
                o.append(glass.card(x, y, bw, h, h // 2, "glass", "sh1"))
            else:
                o.append(glass.card(x, y, bw, h, 12))
            lines = c.split("|")
            fs = 10 if small else 12
            longest = max(len(l) for l in lines)
            f = min(fs, max(8, int((bw - 14) / (0.56 * longest))))
            for k, ln in enumerate(lines):
                ty = y + h // 2 + 4 + (k - (len(lines) - 1) / 2) * (f + 2)
                bold = ' font-weight="600"' if kind == "gate" and k == 0 else (' font-weight="500"' if kind in ("core", "store") and k == 0 else "")
                cls = "t2" if (small or (k and kind != "gate")) else "t"
                o.append(f'<text class="{cls}" x="{cx}" y="{ty:.0f}" font-size="{f if k == 0 else max(f - 1, 8)}"{bold} text-anchor="middle">{esc(ln)}</text>')
        centers.append((y, h, rowc, x0, x0 + total))
    d = []
    for i in range(len(rows) - 1):
        y, h, cs = centers[i][:3]
        ny, nh, ncs = centers[i + 1][:3]
        bot, top = y + h, ny
        mid = (bot + top) // 2
        if len(cs) > 1:
            for c in cs:
                d.append(f'M{c} {bot}v{mid - bot}')
            d.append(f'M{cs[0]} {mid}H{cs[-1]}')
        else:
            d.append(f'M{cs[0]} {bot}V{mid}')
        if len(ncs) > 1:
            for c in ncs:
                d.append(f'M{c} {mid}v{top - mid}')
            d.append(f'M{ncs[0]} {mid}H{ncs[-1]}')
        else:
            d.append(f'M{ncs[0]} {mid}V{top}')
        if len(cs) == 1 and len(ncs) == 1 and cs[0] == ncs[0]:
            d = d[:-2] + [f'M{cs[0]} {bot}V{top}']
    o.insert(2, f'<path class="ln" stroke-linejoin="round" d="{"".join(d)}"/>')   # under the cards
    if spec.get("arrows"):   # dots travel each edge; reduced-motion leaves them as a dotted texture
        k = 0
        for i in range(len(rows) - 1):
            y, h, cs = centers[i][:3]
            ny, _, ncs = centers[i + 1][:3]
            bot, mid = y + h, (y + h + ny) // 2
            for c in cs:
                for t in ncs:
                    o.insert(3, f'<path class="flow-{acc}" style="animation-delay:-{(k * .37) % 1.4:.2f}s" d="M{c} {bot}V{mid}H{t}V{ny}"/>')
                    k += 1
        for ny, _, ncs, *_ in centers[1:]:
            o += [f'<path class="tip" d="M{c - 4} {ny - 6}L{c} {ny}L{c + 4} {ny - 6}z"/>' for c in ncs]
    if loop:  # dashed back-edge up the right margin: the "do it again" arrow
        fy, fh, _, _, fr = centers[loop["from"]]
        ty, th, _, _, tr = centers[loop["to"]]
        rx, a, b = W - 22, fy + fh // 2, ty + th // 2
        o.append(f'<path class="dash-{acc} march" d="M{fr} {a}H{rx}V{b}H{tr + 6}"/>')
        o.append(f'<path class="f-{acc}" d="M{tr + 6} {b - 4}L{tr} {b}L{tr + 6} {b + 4}z"/>')
        o.append(f'<text class="t-{acc}" x="{rx - 6}" y="{(a + b) // 2}" font-size="10" text-anchor="middle" transform="rotate(-90 {rx - 6} {(a + b) // 2})">{esc(loop.get("label", ""))}</text>')
    o.append('</svg>')
    out = os.path.expanduser(spec["out"])
    open(out, "w").write("\n".join(o) + "\n")
    print(out)

main()
