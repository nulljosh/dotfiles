#!/usr/bin/env python3
"""All-time per-app App Store numbers through the asc web session (no API key needed).

usage: all_apps.py [--start 2025-01-01] [--end YYYY-MM-DD] [--json]
App IDs come from the GTM ledger (ASC column) plus ASC_EXTRA_APP_IDS.
Prints units (first downloads), sales and proceeds (USD, whole dollars) per app, and a total.
Source the env first: set -a; . ~/.config/asc.env; set +a
"""
import datetime, json, os, re, subprocess, sys

def arg(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

START = arg("--start", "2025-01-01")
END = arg("--end", (datetime.date.today() - datetime.timedelta(days=1)).isoformat())
MEASURES = "units,proceeds,sales"  # impressions/page views come back near zero here; don't trust them

def ledger_ids():
    for p in ("~/Documents/Code/GTM.md", "~/Documents/Josh/Code/labs/GTM.md"):
        p = os.path.expanduser(p)
        if os.path.exists(p):
            ids = []
            for line in open(p):
                m = re.match(r"\|\s*([^|]+?)\s*\|\s*(\d{9,10})\s*\|", line)
                if m:
                    ids.append((m.group(2), m.group(1)))
            break
    else:
        ids = []
    # apps missing from the ledger: ASC_EXTRA_APP_IDS="id:Name,id:Name" in ~/.config/asc.env
    for pair in filter(None, os.environ.get("ASC_EXTRA_APP_IDS", "").split(",")):
        i, _, n = pair.partition(":")
        ids.append((i.strip(), n.strip() or i.strip()))
    return ids

def fetch(app_id, measures):
    r = subprocess.run(["asc", "web", "analytics", "metrics", "--app", app_id, "--start", START,
                        "--end", END, "--measures", measures, "--output", "json"],
                       capture_output=True, text=True, timeout=120)
    if r.returncode:
        return None, (r.stderr or r.stdout).strip().splitlines()[0:1]
    d = json.loads(r.stdout)
    return {x["measure"]: x.get("total", 0) for x in d["result"]["results"]}, None

rows = []
for app_id, name in ledger_ids():
    vals, err = fetch(app_id, MEASURES)
    rows.append({"id": app_id, "app": name, **(vals or {"error": err})})

rows.sort(key=lambda r: (-(r.get("proceeds") or 0), -(r.get("units") or 0)))
tot = {k: sum(r.get(k) or 0 for r in rows) for k in ("units", "proceeds", "sales")}
if "--json" in sys.argv:
    print(json.dumps({"start": START, "end": END, "total": tot, "apps": rows}, indent=2)); sys.exit()
print(f"{START} → {END}")
print(f"{'app':30} {'units':>6} {'sales$':>7} {'proc$':>7}")
for r in rows:
    if "error" in r:
        print(f"{r['app'][:30]:30} error: {r['error']}"); continue
    print(f"{r['app'][:30]:30} {r.get('units',0):>6} {r.get('sales',0):>7} {r.get('proceeds',0):>7}")
print(f"{'TOTAL':30} {tot['units']:>6} {tot['sales']:>7} {tot['proceeds']:>7}")
