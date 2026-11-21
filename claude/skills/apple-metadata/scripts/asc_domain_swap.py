#!/usr/bin/env python3
"""Swap heyitsmejosh.com for jaybulb.com in App Store support, marketing and privacy URLs.

  asc_domain_swap.py            every app on the account
  asc_domain_swap.py <app_id>   one app

Apple only lets these fields change on a version that is not live (prepare, rejected,
waiting for review) and on the editable app-info record. Live ones print as locked;
run this again right after each app's next version is created. Safe to rerun.
"""
import json, subprocess, sys

RENAMES = {"healstack.heyitsmejosh.com": "intake.jaybulb.com", "grapher.heyitsmejosh.com": "curvely.jaybulb.com"}


def swap(u):
    for a, b in RENAMES.items():
        u = u.replace(a, b)
    return u.replace("heyitsmejosh.com", "jaybulb.com")


def asc(*args):
    r = subprocess.run(["asc", *args, "--output", "json"], capture_output=True, text=True)
    s = r.stdout
    return (json.loads(s[s.index("{"):]) if "{" in s else None), r.returncode, r.stdout + r.stderr


def update(kind, lid, fields):
    args = ["localizations", "update", "--id", lid] + (["--type", "app-info"] if kind == "info" else [])
    for flag, value in fields:
        args += [flag, value]
    _, rc, out = asc(*args)
    return "updated" if rc == 0 else ("locked" if "cannot be edited" in out or "state" in out else "error: " + out[:100])


def main(ids):
    for app in ids:
        for plat in ("IOS", "MAC_OS"):
            d, _, _ = asc("localizations", "list", "--app", app, "--platform", plat)
            for l in (d or {}).get("data", []):
                a = l["attributes"]
                f = [(fl, swap(a[k])) for k, fl in (("supportUrl", "--support-url"), ("marketingUrl", "--marketing-url"))
                     if "heyitsmejosh" in (a.get(k) or "")]
                if f:
                    print(app, plat, a.get("locale"), update("version", l["id"], f))
        infos, _, _ = asc("apps", "info", "list", "--app", app)
        for inf in (infos or {}).get("data", []):
            d, _, _ = asc("localizations", "list", "--app", app, "--type", "app-info", "--app-info", inf["id"])
            for l in (d or {}).get("data", []):
                a = l["attributes"]
                f = [(fl, swap(a[k])) for k, fl in (("privacyPolicyUrl", "--privacy-policy-url"), ("privacyChoicesUrl", "--privacy-choices-url"))
                     if "heyitsmejosh" in (a.get(k) or "")]
                if f:
                    print(app, "app-info", inf["attributes"].get("state"), update("info", l["id"], f))


if __name__ == "__main__":
    ids = sys.argv[1:]
    if not ids:
        d, _, _ = asc("apps", "list")
        ids = [a["id"] for a in d["data"]]
    main(ids)
