#!/usr/bin/env python3
# ponytail: regex heuristics over source, not a DOM/AST — treat every number as "go look", not proof.
# Sweeps ~/Documents/Code: language support (i18n) + accessibility, one table.
import json, os, re, sys
from pathlib import Path

ROOT = Path.home() / "Documents/Code"
SKIP_DIRS = {"node_modules", "dist", "out", "build", ".build", ".git", "Pods", "DerivedData", ".next", "vendor", "kmp", "docs", "fastlane", "ds-bundle", "test_output"}
SKIP_PROJ = {"notes", "os", "scripts", "supabase", "dotfiles", "erdos-targets", "hessian4", "lec", "slicehack", "hackrange", "agent-101"}

def files(proj, exts):
    for p in proj.rglob("*"):
        if any(s in p.parts for s in SKIP_DIRS): continue
        if p.suffix in exts and p.is_file(): yield p

def read(p):
    try: return p.read_text(errors="ignore")
    except Exception: return ""

def i18n(proj):
    master = proj / "i18n/strings.json"
    alt = [p for p in files(proj, {".js", ".ts", ".jsx", ".tsx"}) if re.search(r"i18n|locales?", p.name, re.I)]
    src_i18n = proj / "src/i18n"
    locales, pct = "-", "-"
    if master.exists():
        d = json.loads(read(master)); meta = d.get("_meta", {})
        if "strings" in d and isinstance(d.get("locales"), list):  # wordroot shape
            lo = [l["code"] if isinstance(l, dict) else l for l in d["locales"]]; d = d["strings"]; keys = list(d)
        else:
            keys = [k for k in d if k != "_meta"]; lo = meta.get("locales", [])
        src = meta.get("sourceLanguage", "en")
        done = {l: sum(1 for k in keys if d[k].get(l)) for l in lo if l != src}
        locales = ",".join(lo); pct = " ".join(f"{l}:{v*100//max(len(keys),1)}%" for l, v in done.items())
        kind = "master"
    elif src_i18n.exists():
        n = len(list(src_i18n.glob("*.json")) + list(src_i18n.glob("*.js"))); kind = f"src/i18n({n})"
    elif alt:
        txt = read(alt[0]); langs = re.findall(r'^\s*([a-z]{2}(?:-[A-Z]{2})?):\s*\{', txt, re.M)
        kind = f"{alt[0].name}"; locales = ",".join(langs) if langs else "-"
    else:
        kind = "NONE"
    html_wired = sum(1 for p in files(proj, {".html", ".jsx", ".tsx"}) if "data-i18n" in read(p) or re.search(r"\bt\(['\"]", read(p)))
    swift = list(files(proj, {".swift"}))
    lits = sum(len(re.findall(r'(?:Text|Button|Label)\("[^"\\]*"', read(p))) for p in swift)
    xcs = any(True for p in proj.rglob("*.xcstrings") if not any(s in p.parts for s in SKIP_DIRS)) or (proj/"ios/Sources/Localized.swift").exists()
    return kind, locales, pct, html_wired, lits, xcs

def a11y(proj):
    htmls = [p for p in files(proj, {".html"}) if not p.name.startswith("_") and not p.name.startswith(".")]
    issues = {"nolang": 0, "noalt": 0, "iconbtn": 0, "nolabel": 0, "noscale": 0, "nomain": 0}
    for p in htmls:
        t = read(p)
        if not re.search(r"<html[^>]*\blang=", t): issues["nolang"] += 1
        issues["noalt"] += len([m for m in re.findall(r"<img\b[^>]*>", t) if "alt=" not in m and "src=" in m and "[" not in m])
        # buttons/links whose only content is svg/emoji-free whitespace and no aria-label
        for m in re.finditer(r"<(button|a)\b([^>]*)>(.*?)</\1>", t, re.S):
            attrs, inner = m.group(2), re.sub(r"<svg.*?</svg>|<i\b.*?</i>|<span[^>]*class=\"[^\"]*icon[^\"]*\"[^>]*>.*?</span>", "", m.group(3), flags=re.S)
            if not re.sub(r"<[^>]+>|\s", "", inner) and "aria-label" not in attrs and "title=" not in attrs: issues["iconbtn"] += 1
        for m in re.finditer(r"<(input|select|textarea)\b([^>]*)>", t):
            a = m.group(2)
            if re.search(r'type="(hidden|submit|button|checkbox|radio)"', a): continue
            idm = re.search(r'\bid="([^"]+)"', a)
            labeled = "aria-label" in a or "aria-labelledby" in a or (idm and f'for="{idm.group(1)}"' in t)
            if not labeled: issues["nolabel"] += 1
        if re.search(r"user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b", t): issues["noscale"] += 1
        if "<main" not in t and 'role="main"' not in t and len(t) > 2000: issues["nomain"] += 1
    css = "".join(read(p) for p in files(proj, {".css", ".html"}))
    outline_kill = len(re.findall(r"outline\s*:\s*(none|0)\b", css)) - len(re.findall(r":focus-visible", css))
    motion = ("animation" in css or "transition" in css) and "prefers-reduced-motion" not in css
    sw = "".join(read(p) for p in files(proj, {".swift"}))
    sf_imgs = len(re.findall(r"Image\(systemName:", sw)); ax = len(re.findall(r"\.accessibility(Label|Hidden)\(", sw))
    return len(htmls), issues, max(outline_kill, 0), motion, sf_imgs, ax

rows = []
for proj in sorted(ROOT.iterdir()):
    if not proj.is_dir() or proj.name in SKIP_PROJ or not (proj / ".git").exists(): continue
    kind, locales, pct, wired, lits, xcs = i18n(proj)
    n, iss, ok, motion, sfi, ax = a11y(proj)
    if n == 0 and lits == 0: continue
    rows.append((proj.name, kind, locales, pct, wired, lits, "y" if xcs else "-", n, iss, ok, motion, sfi, ax))

print(f"{'project':14} {'i18n':16} {'locales':22} {'coverage':22} {'wired':>5} {'swiftLit':>8} xcs | html nolang noalt iconbtn nolabel noscale nomain outline motion | sfimg axlbl")
for r in rows:
    name, kind, loc, pct, wired, lits, xcs, n, i, ok, motion, sfi, ax = r
    print(f"{name:14} {kind:16} {loc[:22]:22} {pct[:22]:22} {wired:>5} {lits:>8} {xcs:>3} | {n:>4} {i['nolang']:>6} {i['noalt']:>5} {i['iconbtn']:>7} {i['nolabel']:>7} {i['noscale']:>7} {i['nomain']:>6} {ok:>7} {'Y' if motion else '-':>6} | {sfi:>5} {ax:>5}")

if "--json" in sys.argv:
    print(json.dumps([dict(zip(["project","i18n","locales","coverage","wired","swiftLit","xcs","html","issues","outline","motion","sfimg","axlbl"], r)) for r in rows], indent=1))
