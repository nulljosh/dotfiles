#!/usr/bin/env python3
"""Render the fleet map in the house Liquid Glass look (glass.py): projects are glass chips
on a tinted band per group, shared services are capsules on the right, one coloured line
per real use. Spec (JSON on stdin):
 {"out":path, "title":.., "groups":[{"name":..,"items":["epiphany",..]}],
  "services":[{"name":"Supabase","detail":"spark","color":"leaf","uses":["epiphany",..]}],
  "status":{"epiphany":"live|review|rejected|draft"},   # chip tint, dot, glow when it needs a look
  "store":["epiphany",..],            # fallback when no status: ink dot, on the App Store
  "links":[["paintbar","turing"]], "footer":".."}
Lines drop into the gutter under their row and run right along it, bundled like metro
lines, then curve to the capsule. A project-to-project link is a "uses X" second line on
the chip, not a line across the grid.
ponytail: fixed grid, no force layout; past ~90 chips, split by group.
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glass
from glass import esc

STC = {"live": "leaf", "review": "gold", "rejected": "clay"}
W, COLS, CW, CH, GX, GY = 1200, 6, 128, 30, 8, 18
X0, SX = 32, 960            # chip area left edge, service column left edge
XR = X0 + COLS * (CW + GX) - GX

def main():
    s = json.load(sys.stdin)
    bands, labels, chips, pos, y = [], [], [], {}, 64
    for g in s["groups"]:
        top = y - 8
        labels.append(f'<text class="t2" x="{X0}" y="{y + 12}" font-size="11" font-weight="600" letter-spacing=".7" style="font-variant:small-caps">{esc(g["name"])}</text>')
        y += 24
        for i, name in enumerate(g["items"]):
            r, c = divmod(i, COLS)
            pos[name] = (X0 + c * (CW + GX), y + r * (CH + GY))
        y += ((len(g["items"]) - 1) // COLS + 1) * (CH + GY)
        bands.append(f'<rect class="band" x="{X0 - 12}" y="{top}" width="{XR - X0 + 24}" height="{y - top - 4}" rx="18"/>')
        y += 16
    H = y + 36
    svcs = s["services"]
    for v in svcs:
        ys = [pos[u][1] + CH / 2 for u in v["uses"] if u in pos]
        v["y"] = sum(ys) / len(ys)
    svcs.sort(key=lambda v: v["y"])
    for i in range(1, len(svcs)):
        svcs[i]["y"] = max(svcs[i]["y"], svcs[i - 1]["y"] + 64)
    over = svcs[-1]["y"] + 40 - H
    if over > 0:
        for v in svcs: v["y"] -= over
    lines, dots, flows = [], [], []
    for k, v in enumerate(svcs):
        c, ty = glass.color(v["color"]), v["y"]
        for u in v["uses"]:
            if u not in pos: continue
            x, cy = pos[u]
            sx, gy = x + CW - 14 - k * 7, cy + CH + 4 + k * 3   # own drop point and lane per service
            ex = XR + 14 + k * 6
            mx = (ex + SX) / 2
            d = f"M{sx} {cy + CH}V{gy}H{ex}C{mx:.0f} {gy} {mx:.0f} {ty:.0f} {SX} {ty:.0f}"
            lines.append(f'<path class="ln-{c}" d="{d}"/>')
            flows.append(f'<path class="flow-{c}" style="animation-delay:-{(len(flows) * .37) % 1.4:.2f}s" d="{d}"/>')
            dots.append(f'<circle class="f-{c}" cx="{sx}" cy="{cy + CH}" r="2.5"/>')
    uses = {a: b for a, b, *_ in s.get("links", [])}
    store, status = set(s.get("store", [])), s.get("status", {})
    for name, (x, cy) in pos.items():
        st = status.get(name)
        c = STC.get(st)
        chips.append(glass.card(x, cy, CW, CH, 9, f"st-{c}" if c else "glass", f"gl-{c}" if st in ("review", "rejected") else "sh1"))
        f = min(11, int((CW - 26) / (0.56 * len(name))))
        if name in uses:
            chips.append(f'<text class="t" x="{x + 11}" y="{cy + 13}" font-size="{f}">{esc(name)}</text>')
            chips.append(f'<text class="t2" x="{x + 11}" y="{cy + 24}" font-size="9">uses {esc(uses[name])}</text>')
        else:
            chips.append(f'<text class="t" x="{x + 11}" y="{cy + 19}" font-size="{f}">{esc(name)}</text>')
        if st:
            chips.append(f'<circle class="{"hollow" if st == "draft" else "f-" + c}" cx="{x + CW - 11}" cy="{cy + CH / 2}" r="3"/>')
        elif name in store:
            chips.append(f'<circle class="ink" cx="{x + CW - 11}" cy="{cy + CH / 2}" r="3"/>')
    pills = []
    for v in svcs:
        c, ty = glass.color(v["color"]), v["y"]
        pills.append(glass.card(SX, round(ty - 22), 220, 44, 22, f"tint-{c}"))
        pills.append(f'<text class="t" x="{SX + 110}" y="{ty - 3:.0f}" font-size="13" font-weight="600" text-anchor="middle">{esc(v["name"])}</text>')
        pills.append(f'<text class="t2" x="{SX + 110}" y="{ty + 12:.0f}" font-size="10" text-anchor="middle">{esc(v.get("detail", ""))} · {len(v["uses"])}</text>')
    o = [glass.head(W, H),
         f'<text class="t" x="{W // 2}" y="34" font-size="16" font-weight="600" text-anchor="middle">{esc(s["title"])}</text>']
    o += bands + lines + flows + labels + chips + dots + pills
    if status:   # legend: one dot per state, then what the lines mean
        lx = X0 + 4
        for label, cls in (("live", "f-leaf"), ("pending", "f-gold"), ("rejected", "f-clay"), ("draft", "hollow")):
            o.append(f'<circle class="{cls}" cx="{lx}" cy="{H - 22}" r="3"/><text class="t2" x="{lx + 10}" y="{H - 18}" font-size="10">{label}</text>')
            lx += 24 + len(label) * 5.4
        tail = f'App Store state, newest version per platform · lines carry a shared service · {s.get("footer", "")}'
        o.append(f'<text class="t2" x="{lx + 6}" y="{H - 18}" font-size="10">{esc(tail)}</text>')
    else:
        o.append(f'<circle class="ink" cx="{X0 + 4}" cy="{H - 22}" r="3"/><text class="t2" x="{X0 + 14}" y="{H - 18}" font-size="10">on the App Store · coloured dot and line: uses that shared service · {esc(s.get("footer", ""))}</text>')
    o.append('</svg>')
    out = os.path.expanduser(s["out"])
    open(out, "w").write("\n".join(o) + "\n")
    print(out)

main()
