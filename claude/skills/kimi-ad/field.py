"""A wordless launch teaser: a seed, field lines, a stack of bars, a burst, one big number, then the mark and name.

The grammar of a wordless model teaser (diagrams, geometry and field lines built around one number, the name only
at the end), in the app's own palette, type and mark. Frames stream to ffmpeg; the score is generated here.
    uv run -q --with pillow --with numpy python field.py SPEC.json
SPEC.json (paths relative to the spec): {"out": "film.mp4", "number": "20", "name": "KERNEL", "mark": "mark.png",
  "font_bold": "Bold.otf", "palette": {"ink": "#141311", "paper": "#faf8f4", "gold": "#a56200", "light": "#f5b83d"},
  "bars": 20, "shots": ["phone-1.png", "phone-2.png", "phone-3.png", "phone-4.png", "phone-5.png"]}
"""
import json, math, os, random, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SPEC = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {}
if len(sys.argv) > 1: os.chdir(os.path.dirname(os.path.abspath(sys.argv[1])))
hexrgb = lambda h: tuple(int(h.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
PAL = {"ink": "#141311", "paper": "#faf8f4", "gold": "#a56200", "light": "#f5b83d", **SPEC.get("palette", {})}
W, H, FPS, SECS, SS = 1920, 1080, 30, 20.0, 2          # SS: drawn at 2x, scaled down, for clean lines
INK, PAPER, GOLD, LIGHT = (hexrgb(PAL[k]) for k in ("ink", "paper", "gold", "light"))
BOLD = SPEC.get("font_bold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf")
NUMBER, NAME, MARK = SPEC.get("number", "20"), SPEC.get("name", "KERNEL"), SPEC.get("mark")
OUT = SPEC.get("out", "film.mp4"); WAV = OUT.rsplit(".", 1)[0] + ".wav"
CX, CY = W * SS // 2, H * SS // 2
ease = lambda x: 0.5 - 0.5 * math.cos(math.pi * min(1, max(0, x)))
mix = lambda a, b, k: tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))

# Scenes (start, end): seed, field, chapters, burst, twenty, name.
S = [(0, 3), (3, 7), (7, 11), (11, 15), (15, 17.5), (17.5, 20)]
_r = random.Random(7)
CHAPTER_W = [round(_r.uniform(0.45, 0.92), 2) for _ in range(int(SPEC.get("bars", 20)))]
NB = len(CHAPTER_W)
# The app itself: real screenshots (phone shots read best), shown inside the field, beside the bars and in the burst.
SHOTS = [Image.open(s).convert("RGB") for s in SPEC.get("shots", [])]
BX0, BFULL = (CX - 860 * SS, 760 * SS) if SHOTS else (CX - 520 * SS, 1040 * SS)   # the bars move left to make room

def card(img, i, cx, cy, h, alpha=1.0, wmax=None):
    """Screenshot i as a rounded card of height h (a landscape shot: width wmax), centred on (cx, cy), faded in by alpha."""
    if not SHOTS or alpha <= 0: return
    s = SHOTS[i % len(SHOTS)]
    if s.width > s.height and wmax: h = min(h, wmax * s.height / s.width)   # landscape (a desktop OS): fill the room beside it
    h = int(h); w = int(s.width * h / s.height)
    s = s.resize((w, h), Image.LANCZOS)
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=int(min(w, h) * 0.045), fill=int(255 * min(1, alpha)))
    img.paste(s, (int(cx - w / 2), int(cy - h / 2)), m)

def field(d, t, k, color):
    """Dipole field lines around the seed, drawn in as k goes 0 to 1, turning slowly."""
    for i in range(1, 13):
        r = 140 * SS * i ** 0.85
        pts = []
        for j in range(int(181 * k)):
            th = math.radians(j * 2 - 180)
            rr = r * math.sin(th) ** 2                      # r = L sin^2(theta): a dipole line
            x, y = rr * math.sin(th) * 1.6, rr * math.cos(th)
            rot = t * 0.08                                  # the whole field turns, slowly
            pts += [(CX + x * math.cos(rot) - y * math.sin(rot), CY + x * math.sin(rot) + y * math.cos(rot))]
        if len(pts) > 1:
            d.line(pts, fill=mix(INK, color, 0.35 + 0.05 * (12 - i)), width=2 * SS)

def seed(d, r, color=GOLD):
    d.ellipse([CX - r, CY - r, CX + r, CY + r], fill=color)

def chapters(d, k, y0=None, color=PAPER):
    """Twenty chapter bars, drawn left to right one after another, the last ending on the gold seed."""
    gap, h = 46 * SS, 14 * SS
    gap = min(gap, int(880 * SS / NB)); y0 = y0 if y0 is not None else CY - gap * (NB - 1) / 2
    x0, full = BX0, BFULL
    for i, w in enumerate(CHAPTER_W):
        p = min(1, max(0, k * NB - i))
        if p <= 0: break
        y = y0 + i * gap
        d.rounded_rectangle([x0, y, x0 + full * w * ease(p), y + h], radius=h // 2, fill=color)
        if i == NB - 1 and p >= 1:
            sx = x0 + full * w + 26 * SS
            d.ellipse([sx - 11 * SS, y - 4 * SS, sx + 11 * SS, y + h + 4 * SS], fill=LIGHT)

def frame(t):
    img = Image.new("RGB", (W * SS, H * SS), INK)
    d = ImageDraw.Draw(img)
    if t < S[0][1]:                                           # a seed, and one orbit
        k = ease(t / 2.2)
        seed(d, int(36 * SS * k))
        a = t * 2.4
        d.arc([CX - 260 * SS, CY - 160 * SS, CX + 260 * SS, CY + 160 * SS], math.degrees(a), math.degrees(a) + 120 * k, fill=LIGHT, width=3 * SS)
    elif t < S[1][1]:                                         # the field opens around it
        k = ease((t - 3) / 3.2)
        field(d, t, k, LIGHT); seed(d, 36 * SS)
        card(img, 0, CX, CY, 860 * SS * (0.9 + 0.1 * ease((t - 4.6) / 2)), ease((t - 4.6) / 1.2), 1300 * SS)   # the app, inside its field
    elif t < S[2][1]:                                         # the field gives way to twenty chapters
        k = (t - 7) / 3.6
        if k < 0.25: field(d, t, 1 - k * 4, LIGHT)
        chapters(d, max(0, k - 0.05) * 1.05)
        card(img, 1, CX + 470 * SS, CY + 40 * SS * (1 - ease((t - 7.6) / 1.4)), 900 * SS, ease((t - 7.6) / 1.0), 940 * SS)   # the bars, as the app shows them
    elif t < S[3][1]:                                         # the chapters swing into a burst of twenty rays
        k = ease((t - 11) / 2.4)
        for i, w in enumerate(CHAPTER_W):
            a = -math.pi / 2 + k * (i / NB) * 2 * math.pi + (1 - k) * 0
            r0, r1 = 90 * SS, (90 + 520 * w) * SS
            if k < 1e-3: continue
            p0 = (CX + r0 * math.cos(a) * k + (1 - k) * (BX0 - CX), CY + r0 * math.sin(a) * k + (1 - k) * ((i - (NB - 1) / 2) * min(46 * SS, int(880 * SS / NB))))
            p1 = (CX + r1 * math.cos(a) * k + (1 - k) * (BX0 + BFULL * w - CX), CY + r1 * math.sin(a) * k + (1 - k) * ((i - (NB - 1) / 2) * min(46 * SS, int(880 * SS / NB))))
            d.line([p0, p1], fill=mix(PAPER, LIGHT, k * (i % 2)), width=int(14 * SS * (1 - 0.6 * k)))
        seed(d, int(36 * SS * k))
        if t > 13.6:                                          # rings, one per four chapters
            for i in range(5):
                r = (120 + 110 * i) * SS * ease((t - 13.6) / 1.2)
                d.ellipse([CX - r, CY - r, CX + r, CY + r], outline=mix(INK, GOLD, 0.8), width=2 * SS)
        if t > 13.2:                                                                # two more screens slide out from behind
            j = ease((t - 13.2) / 1.0)
            card(img, 3, CX - (360 + 260 * j) * SS, CY, 640 * SS, j, 600 * SS)
            card(img, 4, CX + (360 + 260 * j) * SS, CY, 640 * SS, j, 600 * SS)
        card(img, 2, CX, CY, 780 * SS, ease((t - 11.4) / 1.0), 1080 * SS)          # the app at the centre of the burst
    elif t < S[4][1]:                                         # 20, outlined then filled
        k = (t - 15) / 2.5
        f = ImageFont.truetype(BOLD, int(620 * SS * min(1, 2.2 / max(2, len(NUMBER)))))
        field(d, t, 1, GOLD)
        box = d.textbbox((0, 0), NUMBER, font=f)
        x, y = CX - (box[2] - box[0]) // 2 - box[0], CY - (box[3] - box[1]) // 2 - box[1]
        d.text((x, y), NUMBER, font=f, fill=INK, stroke_width=4 * SS, stroke_fill=LIGHT)
        if k > 0.35:
            d.text((x, y), NUMBER, font=f, fill=mix(INK, LIGHT, ease((k - 0.35) / 0.4)))
    else:                                                     # the mark and the name
        k = ease((t - 17.5) / 0.8)
        m = int(180 * SS) if MARK else 0
        mark = Image.open(MARK).convert("RGBA").resize((m, m), Image.LANCZOS) if MARK else None
        f = ImageFont.truetype(BOLD, 120 * SS)
        gap = 28 * SS
        widths = [d.textlength(c, font=f) for c in NAME]
        total = m + (60 * SS if m else 0) + sum(widths) + gap * 5
        x = CX - total // 2
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        if mark: layer.paste(mark, (int(x), CY - m // 2), mark)
        ld = ImageDraw.Draw(layer)
        cx = x + m + (60 * SS if m else 0)
        for c, cw in zip(NAME, widths):
            ld.text((cx, CY), c, font=f, fill=PAPER + (255,), anchor="lm"); cx += cw + gap
        a = layer.getchannel("A").point(lambda v: int(v * k))
        layer.putalpha(a)
        img.paste(layer, (0, 0), layer)
        if t > 19.3:
            fade = ease((t - 19.3) / 0.7)
            img = Image.blend(img, Image.new("RGB", img.size, INK), fade)
    return img.resize((W, H), Image.LANCZOS)

def score():
    """A low D drone that swells scene by scene, a tick on each scene change, a bell on 20 and a boom on the name."""
    sr = 48000; n = int(sr * SECS); t = np.arange(n) / sr
    swell = np.clip(t / 15, 0, 1) ** 1.5 * (t < 17.5) + (t >= 17.5) * np.clip(1 - (t - 17.5) / 2.5, 0, 1) * 0.6
    drone = sum(np.sin(2 * np.pi * f * t + p) * a for f, a, p in [(73.42, 0.5, 0), (110.0, 0.25, 1), (146.83, 0.18, 2), (73.9, 0.3, 0.5)])
    out = drone * (0.15 + 0.6 * swell)
    for s, _ in S[1:]:
        i = int(s * sr); e = np.exp(-np.arange(int(0.3 * sr)) / (0.04 * sr))
        out[i:i + len(e)] += 0.5 * e * np.sin(2 * np.pi * 880 * np.arange(len(e)) / sr)
    for at, f, amp, dec in [(15.0, 587.33, 0.45, 0.9), (15.0, 880.0, 0.25, 0.7), (17.5, 41.2, 0.9, 0.6)]:
        i = int(at * sr); m = n - i; e = np.exp(-np.arange(m) / (dec * sr))
        out[i:] += amp * e * np.sin(2 * np.pi * f * np.arange(m) / sr)
    out[:int(0.05 * sr)] *= np.linspace(0, 1, int(0.05 * sr)); out[-int(0.5 * sr):] *= np.linspace(1, 0, int(0.5 * sr))
    out = out / np.max(np.abs(out)) * 0.85
    st = np.stack([out, np.roll(out, 240)], 1)
    with wave.open(WAV, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes((st * 32767).astype("<i2").tobytes())

if __name__ == "__main__":
    score()
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                           "-i", WAV, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-shortest", OUT], stdin=subprocess.PIPE)
    for i in range(int(SECS * FPS)):
        ff.stdin.write(frame(i / FPS).tobytes())
    ff.stdin.close(); ff.wait()
    print("wrote", OUT)
