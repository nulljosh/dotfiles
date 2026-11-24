#!/usr/bin/env python3
"""Sum App Store Sales & Trends reports (TSV or .tsv.gz) into per-app totals in CAD.

usage: sales_sum.py REPORT [REPORT ...] [--json]
Counts first downloads (1, 1F, 1T, F1, 1E, 1EP, 1EU) and in-app purchases (IA*),
skips updates (7*) and redownloads (3*). Proceeds are converted to CAD with the
latest Bank of Canada rate (public Valet API, no account needed).
"""
import csv, gzip, io, json, sys, urllib.request
from collections import defaultdict

FIRST = {"1", "1F", "1T", "F1", "1E", "1EP", "1EU"}

def rows(path):
    raw = open(path, "rb").read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    yield from csv.DictReader(io.StringIO(raw.decode("utf-8", "replace")), delimiter="\t")

def fx_to_cad(cur, cache={}):
    if cur == "CAD":
        return 1.0
    if cur not in cache:
        url = f"https://www.bankofcanada.ca/valet/observations/FX{cur}CAD/json?recent=1"
        try:
            obs = json.load(urllib.request.urlopen(url, timeout=10))["observations"][0]
            cache[cur] = float(obs[f"FX{cur}CAD"]["v"])
        except Exception:
            cache[cur] = None
    return cache[cur]

def main(argv):
    paths = [a for a in argv if not a.startswith("--")]
    apps = defaultdict(lambda: {"title": "", "downloads": 0, "paid_units": 0, "iap_units": 0,
                                "proceeds": defaultdict(float)})
    for p in paths:
        for r in rows(p):
            ptype = (r.get("Product Type Identifier") or "").strip()
            if ptype.startswith(("7", "3")):
                continue
            units = int(float(r.get("Units") or 0))
            proceeds = float(r.get("Developer Proceeds") or 0)
            cur = (r.get("Currency of Proceeds") or "USD").strip()
            key = (r.get("Parent Identifier") or "").strip() or (r.get("Apple Identifier") or "").strip()
            a = apps[key]
            if not a["title"] or ptype in FIRST:
                a["title"] = r.get("Title", key)
            if ptype in FIRST:
                a["downloads"] += units
                if proceeds > 0:
                    a["paid_units"] += units
            elif ptype.startswith("IA"):
                a["iap_units"] += units
            a["proceeds"][cur] += proceeds * units
    out, missing = [], set()
    for key, a in apps.items():
        cad = 0.0
        for cur, amt in a["proceeds"].items():
            rate = fx_to_cad(cur)
            if rate is None:
                missing.add(cur)
            else:
                cad += amt * rate
        out.append({"id": key, "title": a["title"], "downloads": a["downloads"],
                    "paid_units": a["paid_units"], "iap_units": a["iap_units"],
                    "proceeds_cad": round(cad, 2),
                    "proceeds_by_currency": {k: round(v, 2) for k, v in a["proceeds"].items() if v}})
    out.sort(key=lambda x: (-x["proceeds_cad"], -x["downloads"]))
    total = {"downloads": sum(x["downloads"] for x in out),
             "paid_units": sum(x["paid_units"] for x in out),
             "proceeds_cad": round(sum(x["proceeds_cad"] for x in out), 2),
             "unconverted_currencies": sorted(missing)}
    if "--json" in argv:
        print(json.dumps({"total": total, "apps": out}, indent=2))
        return
    print(f"{'app':28} {'downloads':>9} {'paid':>5} {'iap':>4} {'CAD':>9}")
    for x in out:
        print(f"{x['title'][:28]:28} {x['downloads']:9} {x['paid_units']:5} {x['iap_units']:4} {x['proceeds_cad']:9.2f}")
    print(f"{'TOTAL':28} {total['downloads']:9} {total['paid_units']:5} {'':4} {total['proceeds_cad']:9.2f}")
    if missing:
        print("not converted:", ", ".join(sorted(missing)))

if __name__ == "__main__":
    main(sys.argv[1:])
