#!/usr/bin/env python3
"""ASC status for every app, via the public API (no web session, no Chrome).
usage: status.py [--reasons]
  --reasons  also pull Resolution Center text for rejected apps with `asc web review show`
             (needs a live web session: `asc web auth status`)."""
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

LIVE = {"READY_FOR_SALE", "READY_FOR_DISTRIBUTION"}
REJECTED = {"REJECTED", "METADATA_REJECTED", "DEVELOPER_REJECTED", "INVALID_BINARY"}
APPLE_ID = "trommatic@icloud.com"

def asc(*args):
    r = subprocess.run(["asc", *args], capture_output=True, text=True)
    return json.loads(r.stdout) if r.stdout.strip().startswith("{") else {"data": []}

def app_state(app):
    versions = asc("versions", "list", "--app", app["id"], "--output", "json")["data"]
    per = {}
    for v in sorted(versions, key=lambda v: v["attributes"]["createdDate"], reverse=True):
        per.setdefault(v["attributes"]["platform"], v["attributes"])  # newest per platform
    return app["attributes"]["name"], app["id"], {
        p.replace("IOS", "iOS").replace("MAC_OS", "macOS"): (a["versionString"], a["appStoreState"])
        for p, a in per.items()}

def bucket(state):
    return "rejected" if state in REJECTED else "live" if state in LIVE else "in flight"

def main():
    apps = asc("apps", "list", "--paginate", "--output", "json")["data"]
    with ThreadPoolExecutor(6) as pool:
        rows = sorted(pool.map(app_state, apps))
    groups = {"rejected": [], "in flight": [], "live": []}
    for name, aid, plats in rows:
        worst = "rejected" if any(bucket(s) == "rejected" for _, s in plats.values()) else \
                "in flight" if any(bucket(s) == "in flight" for _, s in plats.values()) else "live"
        groups[worst].append((name, aid, plats))
    for g in ("rejected", "in flight", "live"):
        print(f"\n== {g.upper()} ({len(groups[g])})")
        for name, aid, plats in groups[g]:
            print(f"  {name:<16} {aid}  " + "  ".join(f"{p} {v} {s}" for p, (v, s) in plats.items()))
    if "--reasons" in sys.argv:
        auth = subprocess.run(["asc", "web", "auth", "status"], capture_output=True, text=True).stdout
        if '"authenticated":true' not in auth:
            print("\nWeb session expired. Run `asc-login` once (it has a 20 minute cooldown). "
                  "If Apple answers 503 it is throttling: wait, do not loop. Chrome fallback is in SKILL.md.")
            return
        for name, aid, _ in groups["rejected"]:
            print(f"\n---- {name} ({aid})")
            out = subprocess.run(["asc", "web", "review", "show", "--app", aid, "--apple-id", APPLE_ID],
                                 capture_output=True, text=True)
            print("\n".join((out.stdout or out.stderr).splitlines()[:60]))

main()
