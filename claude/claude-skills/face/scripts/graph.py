#!/usr/bin/env python3
"""Draw the face-loop ledger as an SVG: benchmark total per version (line)
and Joshua's grades (dots). No libraries. Writes face-versions.svg next to
the ledger. Letter grades map to the benchmark's own scale (A+ 95 ... F 40).
"""
import re
L = "/Volumes/LaCie/lipsync/face-versions.tsv"
G = {"A+": 95, "A": 88, "A-": 82, "B+": 78, "B": 75, "B-": 71, "C+": 68, "C": 65, "C-": 61, "D": 55, "F": 40}
rows = [r.rstrip("\n").split("\t") for r in open(L)][1:]
bench, grade = [], []
for r in rows:
    v = int(r[0]); b = re.match(r"(\d+)", r[3] or "")
    if b: bench.append((v, int(b.group(1))))
    g = re.match(r"([A-F][+-]?)", r[4] or "")
    if g: grade.append((v, G.get(g.group(1), None), r[4]))
W, H, X0, Y0, X1, Y1 = 640, 320, 50, 30, 620, 270
vs = [v for v, _ in bench] + [v for v, *_ in grade]
if not vs: raise SystemExit  # fresh ledger, nothing to draw yet
vmin = min(vs); vmax = max(max(vs), 50, vmin + 1)
x = lambda v: X0 + (X1 - X0) * (v - vmin) / (vmax - vmin)
y = lambda s: Y1 - (Y1 - Y0) * (s - 40) / 60
out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="background:#fff;font-family:-apple-system,Helvetica,sans-serif">',
       f'<text x="{W//2}" y="18" font-size="14" font-weight="600" fill="#222" text-anchor="middle">Samantha face, version by version</text>']
for s, lab in ((95, "A+"), (85, "A"), (75, "B"), (65, "C"), (55, "D")):
    out.append(f'<line x1="{X0}" x2="{X1}" y1="{y(s):.0f}" y2="{y(s):.0f}" stroke="#eee"/><text x="{X0-8}" y="{y(s)+4:.0f}" font-size="10" fill="#999" text-anchor="end">{lab}</text>')
for v in range(vmin, vmax + 1, 5):
    out.append(f'<text x="{x(v):.0f}" y="{Y1+16}" font-size="10" fill="#999" text-anchor="middle">v{v}</text>')
out.append('<polyline fill="none" stroke="#2f6b3a" stroke-width="2" points="' + " ".join(f"{x(v):.1f},{y(s):.1f}" for v, s in bench) + '"/>')
for v, s, lab in grade:
    if s: out.append(f'<circle cx="{x(v):.1f}" cy="{y(s):.1f}" r="5" fill="#161513"/><text x="{x(v):.1f}" y="{y(s)-9:.1f}" font-size="10" fill="#161513" text-anchor="middle">{lab.split()[0]}</text>')
out.append(f'<text x="{X1}" y="{H-8}" font-size="10" fill="#2f6b3a" text-anchor="end">line: benchmark (vs a real NASA interview)   dots: Joshua\'s grade</text></svg>')
open(L.replace(".tsv", ".svg"), "w").write("\n".join(out))
print("wrote", L.replace(".tsv", ".svg"), len(bench), "bench points,", len(grade), "grades")
