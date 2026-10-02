#!/usr/bin/env python3
"""Pull live App Store state into a fleet spec: python3 fleet-status.py path/to/fleet.json
One `asc versions list --latest` per app, one at a time. Per project the newest version on
each platform counts and the most urgent state wins: rejected > review > draft > live.
ponytail: ASC ids hardcoded (from ~/Documents/Code/CLAUDE.md and the asc ledger); a new
app needs a line here. A newer build in review shows as review even while the old one sells.
"""
import json, subprocess, sys

IDS = {"bookrank": 6792376485, "blockframe": 6794988951, "curbfind": 6809031662, "curvely": 6794988370,
       "bcgd": 6791106082, "epiphany": 6779522175, "healstack": 6785764864, "inkpress": 6787759999,
       "lexly": 6783501611, "litigate": 6787857503, "madobe": 6809355192, "nyc": 6782618198,
       "nimble": 6807858746, "plain": 6809841903, "quotestreak": 6804394619, "sidewise": 6806028670,
       "siftbox": 6811141466, "sparkjar": 6785162492, "talli": 6782366555, "toroid": 6806324937,
       "notate": 6782604262, "windgate": 6810806058, "wordroot": 6794988021}
LIVE = {"READY_FOR_SALE", "READY_FOR_DISTRIBUTION"}
REJECTED = {"REJECTED", "METADATA_REJECTED", "INVALID_BINARY"}
DRAFT = {"PREPARE_FOR_SUBMISSION"}
RANK = {"rejected": 3, "review": 2, "draft": 1, "live": 0}

def kind(state):
    return "rejected" if state in REJECTED else "live" if state in LIVE else "draft" if state in DRAFT else "review"

spec_path = sys.argv[1]
spec = json.load(open(spec_path))
status = {}
for name, app in IDS.items():
    r = subprocess.run(["asc", "versions", "list", "--app", str(app), "--latest", "--output", "json"],
                       capture_output=True, text=True, timeout=90)
    try:
        items = json.loads(r.stdout)["items"]
    except Exception:
        print(f"skip {name}: {r.stderr.strip()[:80] or r.stdout[:80]}"); continue
    kinds = [kind(i["attributes"].get("appVersionState") or i["attributes"].get("appStoreState")) for i in items]
    if kinds:
        status[name] = max(kinds, key=RANK.get)
        print(f"{name}: {status[name]}  {[(i['attributes']['platform'], i['attributes']['versionString'], i['attributes'].get('appVersionState')) for i in items]}")
spec["status"] = status
json.dump(spec, open(spec_path, "w"), indent=1)
