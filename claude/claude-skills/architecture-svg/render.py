#!/usr/bin/env python3
"""Render house-style architecture.svg from a hand-written row spec.
Spec (JSON on stdin): {"title":..,"accent":"#hex","out":path,
 "rows":[{"kind":"client|core|ext|store","cells":["A","B"]},...]}
ponytail: layout only; every repo's rows are still written by hand.
"""
import json, sys, os

W = 640
def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

def main():
    spec = json.load(sys.stdin)
    accent = spec.get("accent", "#0071e3")
    rows = spec["rows"]
    H = 60 + len(rows) * 90
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" style="background:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif" viewBox="0 0 {W} {H}">',
         f'<text x="320" y="28" fill="#333" font-size="16" font-weight="600" text-anchor="middle">{esc(spec["title"])}</text>']
    centers = []
    for i, row in enumerate(rows):
        y = 55 + i * 90
        cells = row["cells"]
        kind = row["kind"]
        small = kind == "ext"
        h = 30 if small else 40
        n = len(cells)
        gap = 30
        bw = min(200 if not small else 160, (W - 80 - gap * (n - 1)) // n)
        total = n * bw + gap * (n - 1)
        x0 = (W - total) // 2
        rowc = []
        for j, c in enumerate(cells):
            x = x0 + j * (bw + gap)
            cx = x + bw // 2
            rowc.append(cx)
            if kind == "client":
                fill, stroke, tc, fs, fw = "#f5f5f7", "#d1d1d6", "#333", 12, ""
            elif kind == "ext":
                fill, stroke, tc, fs, fw = "#f0f0f0", "#ccc", "#666", 10, ""
            else:
                fill, stroke, tc, fs, fw = accent, accent, "#333", 12, ' font-weight="500"'
            op = ' fill-opacity=".15"' if kind in ("core", "store") else ""
            o.append(f'<rect width="{bw}" height="{h}" x="{x}" y="{y}" fill="{fill}"{op} stroke="{stroke}" rx="{6 if small else 8}"/>')
            lines = c.split("|")
            # shrink to fit: ~0.56em per char for this font at these sizes
            longest = max(len(l) for l in lines)
            f = min(fs, max(8, int((bw - 14) / (0.56 * longest))))
            for k, ln in enumerate(lines):
                ty = y + h // 2 + 4 + (k - (len(lines) - 1) / 2) * (f + 2)
                o.append(f'<text x="{cx}" y="{ty:.0f}" fill="{tc}" font-size="{f}"{fw} text-anchor="middle">{esc(ln)}</text>')
        centers.append((y, h, rowc))
    # connectors
    d = []
    for i in range(len(rows) - 1):
        y, h, cs = centers[i]
        ny, nh, ncs = centers[i + 1]
        bot, top = y + h, ny
        mid = (bot + top) // 2
        if len(cs) > 1:
            d.append(f'M{cs[0]} {bot}v{mid-bot}')
            for c in cs[1:]:
                d.append(f'M{c} {bot}v{mid-bot}')
            d.append(f'M{cs[0]} {mid}H{cs[-1]}')
        else:
            d.append(f'M{cs[0]} {bot}V{mid}')
        if len(ncs) > 1:
            for c in ncs:
                d.append(f'M{c} {mid}v{top-mid}')
            d.append(f'M{ncs[0]} {mid}H{ncs[-1]}')
        else:
            d.append(f'M{ncs[0]} {mid}V{top}')
        if len(cs) == 1 and len(ncs) == 1 and cs[0] == ncs[0]:
            d = d[:-2] + [f'M{cs[0]} {bot}V{top}']
    o.append(f'<path stroke="#d1d1d6" fill="none" d="{"".join(d)}"/>')
    o.append('</svg>')
    out = os.path.expanduser(spec["out"])
    open(out, "w").write("\n".join(o) + "\n")
    print(out)

main()
