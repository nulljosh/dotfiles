#!/usr/bin/env python3
"""Pull the App Store screenshots of competitor apps, one contact sheet per app, no login.

    python3 fetch.py OUT_DIR "Ground News" "Reeder" "Pocket Casts" ...

Uses Apple's public iTunes Search API (country us, iPhone shots, 8 per app at 300 px wide) and ImageMagick to
join each app's shots into OUT_DIR/sheet-<slug>.jpg. Prints name, shot count, rating and rating count per app.
"""
import json, os, re, subprocess, sys, urllib.parse, urllib.request

out, apps = sys.argv[1], sys.argv[2:]
os.makedirs(out, exist_ok=True)
for a in apps:
    q = urllib.parse.urlencode({"term": a, "entity": "software", "country": "us", "limit": 1})
    res = json.load(urllib.request.urlopen("https://itunes.apple.com/search?" + q)).get("results", [])
    if not res:
        print(f"{a}: not found"); continue
    r = res[0]
    slug = re.sub(r"\W+", "-", a.lower()).strip("-")
    files = []
    for i, u in enumerate(r.get("screenshotUrls", [])[:8]):
        f = os.path.join(out, f"{slug}-{i}.jpg")
        try:
            urllib.request.urlretrieve(re.sub(r"/\d+x\d+bb\.(png|jpg)$", "/300x0w.jpg", u), f)
            files.append(f)
        except Exception as e:
            print(f"{a} shot {i}: {e}")
    if files:
        subprocess.run(["magick", *files, "-resize", "x520", "+append", os.path.join(out, f"sheet-{slug}.jpg")], check=False)
    print(f"{a} | {r['trackName']} | {len(files)} shots | {round(r.get('averageUserRating', 0), 1)} ({r.get('userRatingCount')})")
