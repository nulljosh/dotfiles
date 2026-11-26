#!/usr/bin/env python3
"""Promo videos made from the real screenshots of our apps: a 16:9 walkthrough (YouTube) and a 9:16 ad (TikTok).

    uv run -q --with pillow --with numpy python promo.py scan
    uv run -q --with pillow --with numpy python promo.py render nimble echo [--only ad|explore]

scan   walks ~/Documents/Code, drafts launch/promo/<app>/spec.json for every app with 3+ real screenshots (never overwrites a spec).
render writes explore.mp4, ad.mp4 and a contact sheet of each beside the spec.

SPEC: name, tagline, hook (optional, the ad's first line), url, accent "#hex", icon (path from the Code root, svg or png),
      shots [{img (path from the Code root), caption}]. The ad uses the first 5 shots, the walkthrough all of them.
"""
import io, itertools, json, re, subprocess, sys, wave
from functools import lru_cache
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path.home() / "Documents/Code"; OUT = ROOT / "launch/promo"; FPS = 30
DIRS = ("launch/gallery", "screenshots", "docs/screenshots", "public/screenshots", "metadata/screenshots")
SKIP = re.compile(r"thumb|(^|[-_])og[-_.]|icon|logo|social|preview|banner|badge", re.I)

# ---------- scan ----------
def find_shots(app):
    seen, out = set(), []
    for d in DIRS:
        for p in sorted((ROOT / app / d).rglob("*")) if (ROOT / app / d).is_dir() else []:
            if p.suffix.lower() not in (".png", ".jpg", ".jpeg") or SKIP.search(p.name): continue
            try: w, h = Image.open(p).size
            except OSError: continue
            key = (w, h, p.stat().st_size)
            if min(w, h) >= 600 and key not in seen and (b := busy(p)) >= 6: seen.add(key); out.append((p, w / h, b))
    return sorted(out, key=lambda x: -x[2])  # busiest first: blank screens are dropped, the strongest lead

def busy(p):  # mean edge strength on a small gray copy: about 3 is a blank screen, 10 or more is a full one
    im = Image.open(p).convert("L"); g = np.asarray(im.resize((160, int(160 * im.height / im.width))), np.float32)
    return float(np.abs(np.diff(g, axis=0)).mean() + np.abs(np.diff(g, axis=1)).mean())

def caption(p):
    s = re.sub(r"^\d+[-_ ]*", "", p.stem).replace("_", "-")
    s = re.sub(r"\b(ios|iphone|ipad\d*|mac|macos|watch|android|new|screenshot)\b", "", s, flags=re.I)
    return " ".join(w for w in re.split(r"[-\s]+", s) if w).title()

def accent(app):
    for f, pat in (("brand/tokens.css", r"--accent:\s*(#[0-9a-fA-F]{6})"), ("icon.svg", r'stop-color="(#[0-9a-fA-F]{6})"')):
        t = ROOT / app / f
        if t.exists():
            m = re.findall(pat, t.read_text(errors="ignore"))
            if m: return m[0] if f.endswith("css") else m[-1]
    return "#4f8cff"

def readme(app):
    t = (ROOT / app / "README.md").read_text(errors="ignore") if (ROOT / app / "README.md").exists() else ""
    name = (re.search(r'alt="([^"]+?) icon"', t) or [0, app.title()])[1]
    line = next((l for l in t.splitlines() if re.match(r"[A-Z]", l)), name)
    tag = ""
    for s in re.split(r"(?<=\.) ", line):
        if tag and len(tag + s) > 52: break
        tag = (tag + " " + s).strip()
    return name, tag

def scan():
    for d in sorted(p for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith(("_", ".", "jt-"))):
        sh = find_shots(d.name)
        if len(sh) < 3: continue
        P = [x for x in sh if x[1] < 0.8][:4]; L = [x for x in sh if x[1] >= 0.8][:3]
        pick = [x for x in itertools.chain.from_iterable(itertools.zip_longest(P, L)) if x]
        name, tag = readme(d.name); spec = OUT / d.name / "spec.json"
        icon = next((f"{d.name}/{f}" for f in ("icon.svg", "icon.png") if (d / f).exists()), "")
        new = not spec.exists()
        if new:
            spec.parent.mkdir(parents=True, exist_ok=True)
            spec.write_text(json.dumps({"name": name, "tagline": tag, "url": f"{d.name}.jaybulb.com", "accent": accent(d.name), "icon": icon,
                "shots": [{"img": str(p.relative_to(ROOT)), "caption": caption(p)} for p, *_ in pick]}, indent=1))
        print(f"{d.name:14} {len(P)}p {len(L)}l  {'drafted' if new else 'kept'}  {tag[:50]}")

# ---------- drawing ----------
@lru_cache(None)
def font(size, bold=True):
    for p in ("/System/Library/Fonts/HelveticaNeue.ttc", "/System/Library/Fonts/Helvetica.ttc"):
        for i in range(14):
            try: f = ImageFont.truetype(p, size, index=i)
            except (OSError, FileNotFoundError): break
            if f.getname()[1] == ("Bold" if bold else "Regular"): return f
    return ImageFont.load_default(size)

def rgb(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def lift(c):  # a dark accent is unreadable as text on the dark sky
    lum = (.299 * c[0] + .587 * c[1] + .114 * c[2]) / 255
    return c if lum > .45 else tuple(int(v + (255 - v) * .5) for v in c)

def background(W, H, acc):
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    g = np.exp(-(np.hypot(x - .85 * W, y - .1 * H) / max(W, H) / .55) ** 2)[..., None]
    return Image.fromarray(np.clip(np.array((11, 11, 14), np.float32) + g * np.array(acc, np.float32) * .38, 0, 255).astype(np.uint8))

def wrap(text, f, maxw):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if f.getlength(t) <= maxw or not cur: cur = t
        else: lines.append(cur); cur = w
    return lines + [cur] if cur else lines

def text(s, size, maxw, align="center", color=(255, 255, 255), bold=True):
    f = font(size, bold); lines = wrap(s, f, maxw); lh = int(size * 1.14)
    L = Image.new("RGBA", (maxw, lh * len(lines) + size // 3), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    for i, l in enumerate(lines): d.text(((maxw - f.getlength(l)) / 2 if align == "center" else 0, i * lh), l, font=f, fill=color)
    return L

def rounded(im, r):
    m = Image.new("L", im.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    im = im.convert("RGBA"); im.putalpha(Image.composite(im.getchannel("A"), Image.new("L", im.size, 0), m)); return im

def card(path, w, h, r):  # the screenshot, rounded, on its own soft shadow
    im = Image.open(path).convert("RGB").resize((w, h), Image.LANCZOS); pad = int(w * .12)
    sm = Image.new("L", (w + 2 * pad, h + 2 * pad), 0)
    ImageDraw.Draw(sm).rounded_rectangle((pad, pad + h // 60, pad + w, pad + h + h // 60), r, fill=170)
    out = Image.new("RGBA", sm.size, (0, 0, 0, 0)); out.putalpha(sm.filter(ImageFilter.GaussianBlur(pad * .45)))
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255)
    out.paste(im, (pad, pad), m); return out, pad

def icon(spec, size):
    p = ROOT / spec["icon"] if spec.get("icon") else None
    if not p or not p.exists(): return None
    if p.suffix == ".svg":
        im = Image.open(io.BytesIO(subprocess.run(["rsvg-convert", "-w", str(size * 2), "-h", str(size * 2), str(p)], capture_output=True, check=True).stdout))
    else: im = Image.open(p)
    return rounded(im.convert("RGBA").resize((size, size), Image.LANCZOS), int(size * .2237))

def ease(k): return 1 - (1 - min(max(k, 0), 1)) ** 3

# ---------- segments: each is (seconds, fn(t) -> PIL image) ----------
def static(bg, items, dur):
    f = bg.copy()
    for im, x, y in items:
        if im: f.paste(im, (int(x), int(y)), im)
    return dur, lambda t: f

def title_seg(spec, bg, W, H, ad, end, dur):
    acc = lift(rgb(spec["accent"])); ic = icon(spec, int((W * (.3 if end else .2)) if ad else H * .22)); items = []
    cy = H * (.22 if ad else .24)
    if ic: items.append((ic, (W - ic.width) / 2, cy))
    y = cy + (ic.height if ic else 0) + H * .03
    if ad and not end:   # the hook: the line first, big
        t = text(spec.get("hook", spec["tagline"]), int(W * .12), int(W * .86)); items.append((t, (W - t.width) / 2, H * .38))
    else:
        n = text(spec["name"], int(W * .14) if ad else int(H * .15), int(W * .9)); items.append((n, (W - n.width) / 2, y))
        s = text(spec["url"] if end else spec["tagline"], int(W * .05) if ad else int(H * .05), int(W * (.86 if ad else .7)), color=acc if end else (205, 205, 210), bold=end)
        items.append((s, (W - s.width) / 2, y + n.height + H * .01))
    return static(bg, items, dur)

def shot_seg(sh, bg, W, H, ad, side, dur):
    path = ROOT / sh["img"]; iw, ih = Image.open(path).size; portrait = iw / ih < .8; cap = sh.get("caption", "")
    top = None; push = .07 if ad else .04
    if ad:
        cw = int(W * (.8 if portrait else .94)); ch = int(cw * ih / iw); cx = W / 2
        if portrait: top = int(H * .30)
        else: cy = H * .58
        capl = text(cap, int(W * .092), int(W * .84)) if cap else None; cap_xy = lambda: ((W - capl.width) / 2, H * .10)
    elif portrait:
        ch = int(H * .84); cw = int(ch * iw / ih); cy = H / 2; cx = W / 2 if not cap else W * (.7 if side else .3)
        capl = text(cap, int(H * .09), int(W * .4), "left") if cap else None; cap_xy = lambda: (W * (.09 if side else .54), (H - capl.height) / 2)
    else:
        cw = int(W * .62); ch = int(cw * ih / iw); cx = W / 2; cy = H * .44
        capl = text(cap, int(H * .06), int(W * .8)) if cap else None; cap_xy = lambda: ((W - capl.width) / 2, H * .86)
    base, pad = card(path, int(cw * 1.08), int(ch * 1.08), int(cw * (.07 if ad and portrait else .09 if portrait else .012)))
    cxy = cap_xy() if capl else None

    def fn(t):
        f = bg.copy(); s = (1 + push * min(t / dur, 1)) / 1.08
        c = base.resize((int(base.width * s), int(base.height * s)), Image.BILINEAR)
        f.paste(c, (int(cx - c.width / 2), int(top - pad * s) if top is not None else int(cy - c.height / 2)), c)
        if capl:
            k = ease(t / .4); l = capl
            if k < 1: l = capl.copy(); l.putalpha(capl.getchannel("A").point(lambda v: int(v * k)))
            f.paste(l, (int(cxy[0]), int(cxy[1] + (1 - k) * 28)), l)
        return f
    return dur, fn

# ---------- sound: a soft chord, one thump and a bell on every cut ----------
def score(total, cuts, ad, path):
    sr = 44100; n = int(total * sr); t = np.arange(n) / sr; L = np.zeros(n); R = np.zeros(n)
    for f, a in zip((73.42, 146.83, 220, 293.66, 369.99, 554.37, 659.25), (.5, .4, .3, .22, .16, .1, .07)):
        sw = .75 + .25 * np.sin(2 * np.pi * (.11 + f / 5000) * t + f)
        L += a * np.sin(2 * np.pi * (f - .35) * t) * sw; R += a * np.sin(2 * np.pi * (f + .35) * t + 1) * sw
    env = np.clip(np.minimum(t / 1.5, (total - t) / 1.8), 0, 1); L *= env; R *= env
    for c in cuts:
        i = int(c * sr); m = min(int(.6 * sr), n - i)
        if m <= 0: continue
        k = np.arange(m) / sr
        hit = (.7 if ad else .35) * np.sin(2 * np.pi * 55 * k * (1 + 2 * np.exp(-k * 25))) * np.exp(-k * 9) + .05 * np.sin(2 * np.pi * 1318.5 * k) * np.exp(-k * 5)
        L[i:i + m] += hit; R[i:i + m] += hit
    x = np.tanh(np.stack([L, R], 1) / np.abs(np.stack([L, R], 1)).max() * 1.1) * .8
    with wave.open(str(path), "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes((x * 32767).astype("<i2").tobytes())

# ---------- render ----------
def render(spec, ad, out):
    W, H = (1080, 1920) if ad else (1920, 1080); ov = .12 if ad else .28
    bg = background(W, H, rgb(spec["accent"])); shots = spec["shots"][:5] if ad else spec["shots"][:8]; d = 2.0 if ad else 4.2
    segs = [title_seg(spec, bg, W, H, ad, False, 1.6 if ad else 3.2)]; side = 0
    for sh in shots:
        segs.append(shot_seg(sh, bg, W, H, ad, side, d)); side ^= Image.open(ROOT / sh["img"]).size[0] / Image.open(ROOT / sh["img"]).size[1] < .8
    segs.append(title_seg(spec, bg, W, H, ad, True, 2.4 if ad else 4.0))
    starts = list(itertools.accumulate([0] + [s[0] - ov for s in segs[:-1]])); total = starts[-1] + segs[-1][0]
    wav = out.with_suffix(".wav"); score(total, [s + ov / 2 for s in starts[1:]], ad, wav)
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(wav),
        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", "-shortest", str(out)], stdin=subprocess.PIPE)
    black = Image.new("RGB", (W, H)); n = int(total * FPS)
    for i in range(n):
        t = i / FPS; act = [j for j, s in enumerate(starts) if s <= t < s + segs[j][0]]
        fr = segs[act[0]][1](t - starts[act[0]])
        if len(act) > 1: fr = Image.blend(fr, segs[act[1]][1](t - starts[act[1]]), (t - starts[act[1]]) / ov)
        k = min(1, t / .4, (total - t) / .5)
        if k < 1: fr = Image.blend(black, fr, max(k, 0))
        p.stdin.write(fr.tobytes())
    p.stdin.close(); p.wait(); wav.unlink()
    tile = "scale=180:-1,tile=8x2" if ad else "scale=320:-1,tile=4x3"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(out), "-vf", f"fps=1/2,{tile}", "-frames:v", "1", str(out.with_suffix(".jpg"))])
    vol = subprocess.run(["ffmpeg", "-i", str(out), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    print(out, f"{total:.1f}s", *re.findall(r"(?:mean|max)_volume: \S+ dB", vol))

if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["scan"]: scan()
    elif a[:1] == ["render"]:
        only = a[a.index("--only") + 1] if "--only" in a else None
        for app in [x for x in a[1:] if not x.startswith("--") and x not in ("ad", "explore")]:
            spec = json.loads((OUT / app / "spec.json").read_text())
            for ad in (False, True):
                if only in (None, "ad" if ad else "explore"): render(spec, ad, OUT / app / ("ad.mp4" if ad else "explore.mp4"))
    else: sys.exit(__doc__)
