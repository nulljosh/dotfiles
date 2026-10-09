#!/usr/bin/env python3
"""Fleet audit: read-only checks across ~/Documents/Code Apple projects, lessons from the 2026-10-03 fix loop.
Usage: audit.py [--asc]   (--asc adds URL and name checks that call the asc CLI)
Prints a markdown report. Never edits anything."""
import json, re, subprocess, sys, pathlib, urllib.request

ROOT = pathlib.Path.home() / "Documents/Code"
USE_ASC = "--asc" in sys.argv
OLD_NAMES = ["Charwork", "Wiretext", "Voxprint", "Sieve", "Lucarne", "Newsline", "Grand Swift", "Rainjack", "Breathe", "Echo Pro", "Margin", "Lingo", "Parlay", "Transcriptly"]

def run(cmd):
    try: return subprocess.run(cmd, capture_output=True, text=True, timeout=90).stdout
    except Exception: return ""

def read(p):
    try: return pathlib.Path(p).read_text(errors="ignore")
    except Exception: return ""

def projects():
    for d in sorted(ROOT.iterdir()):
        if not d.is_dir() or d.name.startswith((".", "_")): continue
        for rel in ("ios/project.yml", "project.yml"):
            f = d / rel
            if f.exists(): yield d, f; break

findings = {}
def add(check, repo, msg): findings.setdefault(check, []).append(f"{repo}: {msg}")

apps = {}
if USE_ASC:
    for a in json.loads(run(["asc", "apps", "list", "--output", "json"]) or '{"data":[]}')["data"]:
        apps[a["attributes"]["bundleId"]] = (a["id"], a["attributes"]["name"])

names = [d.name for d, _ in projects()]
for d, yml in projects():
    repo, base, y = d.name, yml.parent, read(yml)
    swift = list(base.rglob("*.swift"))
    src = {p: read(p) for p in swift if "/.build/" not in str(p) and "Tests" not in p.parts}
    ver = re.search(r'MARKETING_VERSION:\s*["\']?([\d.]+)', y)
    bundle = re.search(r'PRODUCT_BUNDLE_IDENTIFIER:\s*(\S+)', y)
    # (b) project.yml vs pbxproj drift
    for pbx in base.glob("*.xcodeproj/project.pbxproj"):
        pb = read(pbx)
        fam = re.search(r'TARGETED_DEVICE_FAMILY:\s*["\']?([\d,]+)', y)
        if fam and f'TARGETED_DEVICE_FAMILY = "{fam.group(1)}"' not in pb and f"TARGETED_DEVICE_FAMILY = {fam.group(1)};" not in pb:
            add("b: project.yml vs pbxproj drift", repo, f"device family {fam.group(1)} in project.yml not in {pbx.name} (run xcodegen)")
        if ver and f"MARKETING_VERSION = {ver.group(1)};" not in pb:
            add("b: project.yml vs pbxproj drift", repo, f"version {ver.group(1)} in project.yml not in pbxproj")
    # (d) Sign in with Apple: raw errors on cancel, 4.8
    allsrc = "\n".join(src.values())
    if ("ASAuthorizationController" in allsrc or "SignInWithAppleButton" in allsrc) and ".canceled" not in allsrc and "1001" not in allsrc:
        add("d: sign in with Apple", repo, "Apple sign-in code never handles ASAuthorizationError.canceled (cancel shows a raw error)")
    if re.search(r"GoogleSignIn|provider:\s*\.google|FBSDK|signInWithGoogle", allsrc) and "ASAuthorizationAppleIDRequest" not in allsrc and "SignInWithAppleButton" not in allsrc:
        add("d: sign in with Apple", repo, "third-party login without Sign in with Apple (guideline 4.8)")
    # (e) List(selection:) + NavigationLink(value:)
    for p, t in src.items():
        if re.search(r"List\([^)]*selection:", t) and "NavigationLink(value:" in t:
            add("e: List(selection) + NavigationLink(value)", repo, f"{p.relative_to(d)}")
    # (f) copy-paste leftovers: other apps' names, old names
    own = repo.lower()
    for p, t in src.items():
        for n in OLD_NAMES:
            if re.search(rf'"[^"\n]*\b{re.escape(n)}\b[^"\n]*"', t) and n.lower() not in own and not any(n.lower() in x.lower() for x in (repo,)):
                add("f: old or other app names in code strings", repo, f"{p.relative_to(d)} mentions {n}")
                break
    # (h) encryption flag
    plists = [p for p in base.rglob("*Info.plist") if not any(x in str(p) for x in ("/.build/", "node_modules", "/.asc/", "xcarchive", "DerivedData", "/build/"))]
    if plists and "ITSAppUsesNonExemptEncryption" not in y and not any("ITSAppUsesNonExemptEncryption" in read(p) for p in plists):
        add("h: encryption flag missing", repo, "no ITSAppUsesNonExemptEncryption in Info.plist or project.yml")
    # (i) repo files bundled into the app
    for m in re.finditer(r"sources:\s*\n((?:\s+-\s+.*\n)+)", y):
        for line in m.group(1).splitlines():
            pm = re.search(r"path:\s*(\S+)", line)
            if pm and pm.group(1) in (".", "./"):
                # xcodegen gives .md no build phase, so only resource types really get bundled
                junk = [n for n in ("ExportOptions.plist", "icon.svg") if (base / n).exists() and n not in y]
                if junk: add("i: repo files bundled into app", repo, f"sources path '.' also bundles {', '.join(junk)}")
    # (j) stale What's New
    wn = re.search(r'whatsNewVersion\s*=\s*"([\d.]+)"', allsrc)
    if wn and ver and wn.group(1) != ver.group(1):
        add("j: stale What's New", repo, f"sheet says {wn.group(1)}, app is {ver.group(1)}")
    # (l) installed name vs ASC name, (k) URLs
    if USE_ASC and bundle and bundle.group(1) in apps:
        appid, asc_name = apps[bundle.group(1)]
        disp = re.search(r'CFBundleDisplayName.*?<string>(.*?)</string>', "".join(read(p) for p in plists), re.S)
        if disp and "$(" not in disp.group(1) and disp.group(1).strip().lower() != asc_name.strip().lower():
            add("l: installed name vs ASC name", repo, f"app says '{disp.group(1)}', ASC says '{asc_name}'")
        vs = json.loads(run(["asc", "versions", "list", "--app", appid, "--output", "json"]) or '{"data":[]}')["data"]
        if vs:
            locs = json.loads(run(["asc", "localizations", "list", "--version", vs[0]["id"], "--output", "json"]) or '{"data":[]}')["data"]
            for l in locs[:1]:
                for k in ("supportUrl", "marketingUrl"):
                    u = l["attributes"].get(k)
                    if not u: add("k: support or marketing URL", repo, f"{k} is empty"); continue
                    try:
                        code = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "fleet-audit"}), timeout=15).status
                        if code >= 400: add("k: support or marketing URL", repo, f"{k} {u} returns {code}")
                    except Exception as e:
                        add("k: support or marketing URL", repo, f"{k} {u} fails ({str(e)[:40]})")

print("# Fleet audit\n")
if not findings: print("No findings.")
for k in sorted(findings):
    print(f"## {k} ({len(findings[k])})")
    for f in findings[k]: print(f"- {f}")
    print()
