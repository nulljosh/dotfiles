#!/usr/bin/env python3
"""One store submission a week (GTM rule). Exit 1 if ANY app was submitted for review in the last 7 days.
Run before every `asc review submit` / `submissions-submit`. Tries the API key, then the web session."""
import datetime, json, os, re, subprocess, sys

def run(*a):
    r = subprocess.run(["asc", *a, "--output", "json"], capture_output=True, text=True, timeout=90)
    try: return json.loads(r.stdout)
    except Exception: return None

def dates(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == "submittedDate" and isinstance(v, str): yield v
            else: yield from dates(v)
    elif isinstance(o, list):
        for v in o: yield from dates(v)

ids = []
apps = run("apps", "list", "--paginate")
if apps:
    ids = sorted(set(re.findall(r'"id":\s*"(\d{9,10})"', json.dumps(apps))))
if not ids:
    for p in ("~/Documents/Code/GTM.md", "~/Documents/Josh/Code/labs/GTM.md"):
        p = os.path.expanduser(p)
        if os.path.exists(p):
            ids = [m.group(1) for l in open(p) if (m := re.match(r"\|[^|]+\|\s*(\d{9,10})\s*\|", l))]
            break
cut = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)).isoformat()[:10]
recent = []
for i in ids:
    subs = run("review", "submissions", "list", "--app", i) or run("web", "review", "list", "--app", i)
    recent += [(d[:10], i) for d in dates(subs) if d[:10] >= cut]
if recent:
    print(f"BLOCKED: {len(recent)} submission(s) since {cut}: " + ", ".join(f"{a}@{d}" for d, a in sorted(recent)))
    sys.exit(1)
print(f"OK: no submissions since {cut} across {len(ids)} apps")
