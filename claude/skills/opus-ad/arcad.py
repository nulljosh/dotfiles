#!/usr/bin/env python3
"""A launch film in the grammar of Anthropic's Opus 5.5 ad, with the closing name card of Apple's macOS reveals.

The grammar, measured off the reference (20 s, 37 cuts):
  - every shot is a picture seen through one giant disc, so its rim is one horizon at the same height across hard cuts;
  - the cuts accelerate, about 1 s apart at first and under 0.15 s at the end, and the music is cut to them;
  - a three-beat line sits on the rim, the last word held over the fastest cuts;
  - it opens on a glowing horizon and lands, in silence and one bell, on the name; then the mark, over a low boom.

    uv run -q --with pillow --with numpy python arcad.py SPEC.json

SPEC (paths relative to the spec file):
  out, size [w, h], fps, font, font_bold, font_size, palette {name: "#hex"}, sky (the dark), glow [core, halo]
  open     {secs}                                  the glowing horizon rising into place
  pool     [{image | video | fill, focus [x, y], zoom, sky, push, start}]   shots in order; a video plays from `start` s
  grain    0 to 1                                  film grain over the whole film (0.25 is gentle)
  schedule {count, first, last}                    seconds per cut, eased from first to last
  words    [[k, "word"], ...]                      lands on cut k and holds until the next word or the title
  title    {text, secs}                            the name, big and bold (title_scale x font_size), in silence and one bell
  end      {mark, name, secs}                      the mark beside the name, over the horizon
"""
import json, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

spec_path = os.path.abspath(sys.argv[1]); base = os.path.dirname(spec_path)
S = json.load(open(spec_path))
P = lambda p: p if os.path.isabs(p) else os.path.join(base, p)
W, H = S.get("size", [1920, 1080]); FPS = S.get("fps", 30)
PAL = S.get("palette", {})
def rgb(c):
    c = PAL.get(c, c).lstrip("#"); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
ARC_Y = int(H * S.get("arc_y", 0.56)); R = int(W * S.get("radius", 1.1))
FONT = ImageFont.truetype(P(S["font"]), int(S.get("font_size", 0.09 * H)))
BOLD = ImageFont.truetype(P(S.get("font_bold", S["font"])), int(FONT.size * S.get("title_scale", 1.9)))
DARK, LIGHT = rgb(S.get("sky", "#141311")), rgb(S.get("light", "#faf8f4"))
CORE, HALO = (rgb(c) for c in S.get("glow", ["#faf8f4", "#b5502c"]))
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)

def disc_mask(top):                            # anti-aliased: drawn at 4x, then reduced
    k = 4; m = Image.new("L", (W * k, H * k), 0)
    ImageDraw.Draw(m).ellipse([(W / 2 - R) * k, top * k, (W / 2 + R) * k, (top + 2 * R) * k], fill=255)
    return m.resize((W, H), Image.LANCZOS)
MASK = disc_mask(ARC_Y)

def horizon(top, strength=1.0):                # the dark planet with a lit rim: a thin core and a wide halo, outside only
    d = np.sqrt((XX - W / 2) ** 2 + (YY - (top + R)) ** 2) - R          # >0 in the sky
    core = np.exp(-np.abs(d) / 2.5) * 0.95 + np.exp(-np.maximum(d, 0) / 9) * 0.5 * (d > 0)
    halo = np.exp(-np.maximum(d, 0) / (H * 0.09)) * (d > 0) * 0.85
    inner = np.exp(np.minimum(d, 0) / (H * 0.05)) * (d <= 0) * 0.18    # a little light just inside the rim
    img = np.empty((H, W, 3), np.float32); img[:] = DARK
    for c, a in ((HALO, halo), (HALO, inner), (CORE, core)):
        a = (a * strength)[..., None]; img = img * (1 - a) + np.array(c, np.float32) * a
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

def cover(img, focus, zoom):
    img = img.convert("RGB"); s = max(W / img.width, H / img.height) * zoom * 1.06
    img = img.resize((int(img.width * s) + 1, int(img.height * s) + 1), Image.LANCZOS)
    fx, fy = focus
    return img, (min(max(0, int(fx * img.width - W / 2)), img.width - W), min(max(0, int(fy * img.height - (ARC_Y + H) / 2)), img.height - H))

def clip(path, start, m, focus, zoom):          # m frames of a video from `start`, filling W x H around focus
    fx, fy = focus; z = max(1.0, zoom)
    vf = (f"fps={FPS},scale={int(W * z)}:{int(H * z)}:force_original_aspect_ratio=increase,"
          f"crop={W}:{H}:(iw-{W})*{fx}:(ih-{H})*{fy}")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-i", path, "-vf", vf, "-frames:v", str(m),
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    fr = [Image.frombytes("RGB", (W, H), raw[i * W * H * 3:(i + 1) * W * H * 3]) for i in range(len(raw) // (W * H * 3))]
    return fr + [fr[-1]] * (m - len(fr))        # a clip shorter than the shot holds its last frame

GRAIN = float(S.get("grain", 0)); _rng = np.random.default_rng(1)
def grain(img):                                # fine monochrome film grain, the same strength in light and dark
    if not GRAIN: return img
    a = np.asarray(img, np.int16) + (_rng.standard_normal((H, W, 1)) * 9 * GRAIN).astype(np.int16)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def centred(frame, text, font, y, colour):
    d = ImageDraw.Draw(frame); l, t, r, b = d.textbbox((0, 0), text, font=font)
    d.text(((W - (r - l)) / 2 - l, y - t), text, font=font, fill=colour)
def word_on_rim(frame, text, colour):
    if not text: return
    d = ImageDraw.Draw(frame); l, t, r, b = d.textbbox((0, 0), text, font=FONT)
    d.text(((W - (r - l)) / 2 - l, ARC_Y - (b - t) - int(H * 0.03) - t), text, font=FONT, fill=colour)
def ink_for(sky):
    r, g, b = sky; return DARK if 0.299 * r + 0.587 * g + 0.114 * b > 140 else LIGHT
def ease(x): return 1 - (1 - x) ** 3

# ---- the timeline: the opener, the accelerating cuts, the title, the end ----
o, sc, t_, e = S["open"], S["schedule"], S["title"], S["end"]
n = sc["count"]; durs = [sc["first"] * (sc["last"] / sc["first"]) ** (i / (n - 1)) for i in range(n)]
if sc.get("until"):                            # an external score: the cuts end on its peak, so the run is stretched to fit
    k_ = (sc["until"] - o["secs"]) / sum(durs); durs = [d * k_ for d in durs]
cuts = [o["secs"]]
for d in durs: cuts.append(cuts[-1] + d)
br = S.get("breath")                           # one slow shot after the cuts, in the score's quiet, before the name
T_TITLE = cuts[-1] + (br["secs"] if br else 0); T_END = T_TITLE + t_["secs"]; DUR = T_END + e["secs"]
words = sorted(S.get("words", []))            # [[cut index, word]]: a word lands on a cut and holds
def word_at(k):
    w = ""
    for at, wd in words:
        if k >= at: w = wd
    return w

out = P(S["out"]); silent = out + ".video.mp4"
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", silent], stdin=subprocess.PIPE)
count = 0
def emit(img):                                 # streamed: a 20 s film held in memory would be 4 GB of frames
    global count; enc.stdin.write(grain(img).tobytes()); count += 1
def frames_until(t): return max(0, int(round(t * FPS)) - count)

m0 = frames_until(cuts[0])
for i in range(m0):                            # the horizon rises into place and brightens
    k = ease(i / max(1, m0 - 1))
    emit(horizon(int(H * 1.0 + (ARC_Y - H * 1.0) * k), 0.35 + 0.65 * k))

pool = S["pool"]
for k in range(n):
    sh = pool[k % len(pool)]; sky = rgb(sh.get("sky", "ink"))
    m = frames_until(cuts[k + 1]); push = sh.get("push", 0.04)
    if "video" in sh: vid = clip(P(sh["video"]), sh.get("start", 0), m, sh.get("focus", [0.5, 0.5]), sh.get("zoom", 1.0))
    elif "fill" in sh: src, (x0, y0) = Image.new("RGB", (W, H), rgb(sh["fill"])), (0, 0)
    else: src, (x0, y0) = cover(Image.open(P(sh["image"])), sh.get("focus", [0.5, 0.5]), sh.get("zoom", 1.0))
    for i in range(m):                         # a slow push-in on a still, so nothing is frozen; a video moves by itself
        z = push * (i + 1) / max(1, m) * durs[k] / 0.8; dx, dy = W * z / 2, H * z / 2
        pic = vid[i] if "video" in sh else src.crop((x0 + dx, y0 + dy, x0 + W - dx, y0 + H - dy)).resize((W, H), Image.BICUBIC) if "image" in sh else src
        f = Image.new("RGB", (W, H), sky); f.paste(pic, (0, 0), MASK)
        word_on_rim(f, word_at(k), sh.get("ink") and rgb(sh["ink"]) or ink_for(sky)); emit(f)

if br:
    m = frames_until(T_TITLE); sky = rgb(br.get("sky", "ink"))
    vid = clip(P(br["video"]), br.get("start", 0), m, br.get("focus", [0.5, 0.5]), br.get("zoom", 1.0)) if "video" in br else None
    for i in range(m):
        f = Image.new("RGB", (W, H), sky); f.paste(vid[i] if vid else Image.new("RGB", (W, H), rgb(br["fill"])), (0, 0), MASK)
        word_on_rim(f, br.get("word", ""), ink_for(sky)); emit(f)

low = int(H * 0.9)
for i in range(frames_until(T_END)):           # silence and one bell: the name, big and bold, over a low horizon
    f = horizon(low, 0.8); centred(f, t_["text"], BOLD, int(H * 0.40), LIGHT); emit(f)
BIG = ImageFont.truetype(P(S["font"]), int(FONT.size * e.get("scale", 1.0)))
mark = Image.open(P(e["mark"])).convert("RGBA"); mh = int(BIG.size * 1.7); mark = mark.resize((mh, mh), Image.LANCZOS)
total = frames_until(DUR)
for i in range(total):
    f = horizon(int(low - H * 0.03 * ease(i / max(1, total - 1))), 0.8 + 0.2 * ease(min(1, i / FPS)))
    d = ImageDraw.Draw(f); l, tt, r, b = d.textbbox((0, 0), e["name"], font=BIG)
    gap = int(BIG.size * 0.3); x = (W - (mh + gap + r - l)) // 2; cy = int(H * 0.44)
    f.paste(mark, (x, cy - mh // 2), mark); d.text((x + mh + gap - l, cy - (b - tt) / 2 - tt), e["name"], font=BIG, fill=LIGHT)
    fade = min(1, (total - 1 - i) / (0.6 * FPS))
    emit(Image.blend(Image.new("RGB", (W, H), DARK), f, fade) if fade < 1 else f)
enc.stdin.close(); enc.wait()

wav = P(S["music_file"]) if S.get("music_file") else out + ".wav"   # a composed score (ElevenLabs Music, timed to this plan), or the built-in one
if not S.get("music_file"):
    # ---- the music, cut to the same timeline: an original cinematic score in D major 9, in stereo ----
    # Strings (detuned saws through a filter that opens as the cuts speed up), soft piano for the opening, a sub thump on every
    # cut, a noise riser into a hard stop, one bell on the name and a boom under the mark. Every sound fades out over its last
    # 30 ms, so nothing clicks.
    SR = 44100; N = int(SR * DUR) + 1; mix = np.zeros((N, 2)); dry = np.zeros((N, 2))
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    tt = np.arange(N) / SR
    rng = np.random.default_rng(6)
    def soft(sig, attack=0.004, release=0.03):     # no clicks: a ramp in and a ramp out on every sound
        n_ = len(sig); a_ = min(n_, int(attack * SR)); r_ = min(n_, int(release * SR))
        sig = sig.copy(); sig[:a_] *= np.linspace(0, 1, a_); sig[n_ - r_:] *= np.linspace(1, 0, r_) ** 2; return sig
    def put(buf, t, sig, g, pan=0.0):              # equal-power pan, -1 left to 1 right
        sig = soft(sig); i = int(t * SR); j = min(N, i + len(sig)); a = (pan + 1) * np.pi / 4
        if i < N: buf[i:j, 0] += g * np.cos(a) * sig[:j - i]; buf[i:j, 1] += g * np.sin(a) * sig[:j - i]
    def lowpass(x, fc):                            # a gentle 2-pole low-pass, done in one FFT
        L_ = 1 << int(np.ceil(np.log2(len(x)))); f = np.fft.rfftfreq(L_, 1 / SR)
        return np.fft.irfft(np.fft.rfft(x, L_) / np.sqrt(1 + (f / fc) ** 4), L_)[:len(x)]
    def saw(f, t):
        return 2 * ((f * t) % 1) - 1
    def strings(notes, t):                         # three detuned saws a note, a slow vibrato
        v = 1 + 0.002 * np.sin(2 * np.pi * 5 * t)
        return sum(saw(hz(m) * v * 2 ** (c / 1200), t) for m in notes for c in (-8, 0, 7)) / (3 * len(notes))
    def piano(m, d=3.5):                           # a felt piano: soft attack, a quick-dying second partial, a long tail
        t = np.arange(int(d * SR)) / SR; f = hz(m)
        s_ = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 4) + 0.1 * np.sin(6 * np.pi * f * t) * np.exp(-t * 7)
        return s_ * np.exp(-t * 1.1) * np.minimum(1, t / 0.008)
    def bell(m, d=5.0):                            # one clean bell, a light FM shimmer that dies away
        t = np.arange(int(d * SR)) / SR; f = hz(m)
        return np.sin(2 * np.pi * f * t + 0.8 * np.exp(-t * 3) * np.sin(2 * np.pi * 2.0 * f * t)) * np.exp(-t * 0.9)
    def thump(d, f0=36.7):                         # the pulse: a sub that drops into the low D, with a soft low noise body
        t = np.arange(int(d * SR)) / SR; f = f0 * (1 + 0.6 * np.exp(-t * 30)); ph = 2 * np.pi * np.cumsum(f) / SR
        body = lowpass(rng.standard_normal(len(t)), 180) * np.exp(-t * 18) * 0.6
        return (np.sin(ph) + 0.25 * np.sin(2 * ph)) * np.exp(-t * (2.2 / d)) + body
    prog = np.clip((tt - cuts[2]) / (T_TITLE - cuts[2]), 0, 1)
    duck = np.ones(N)                              # the strings breathe out of the way of every pulse
    for t in cuts[2:-1]:
        i = int(t * SR); k_ = np.arange(N - i) / SR; duck[i:] *= 1 - 0.35 * np.exp(-k_ / 0.15)
    CH = (38, 50, 57, 62, 64, 66, 69, 73)          # D2 D3 A3 D4 E4 F#4 A4 C#5
    raw = strings(CH, tt)
    dark, bright = lowpass(raw, 320), lowpass(raw, 2600)   # the filter opens with the build
    st = dark * (1 - prog ** 1.5) + bright * prog ** 1.5
    env = np.clip((tt - 0.3) / 2.5, 0, 1) * (0.35 + 0.65 * prog ** 1.4) * duck
    cut_at = int(T_TITLE * SR); env[cut_at:] = 0; env[cut_at - int(0.02 * SR):cut_at] *= np.linspace(1, 0, int(0.02 * SR))
    haas = int(0.013 * SR)
    mix[:, 0] += 0.22 * st * env; mix[haas:, 1] += 0.22 * (st * env)[:-haas]
    for k, (t, m) in enumerate(zip(np.arange(0.2, cuts[2] + 0.5, 0.9), (57, 66, 73, 76, 69, 74))):   # the opening: soft piano
        put(mix, t, piano(m), 0.16, (-0.35, 0.35)[k % 2])
    for k, t in enumerate(cuts[2:-1], 2):
        p = float(prog[min(N - 1, int(t * SR))])
        put(dry, t, thump(max(0.25, 0.9 - 0.6 * p)), 0.32 + 0.38 * p)
    a = (tt - (T_TITLE - 3.5)) / 3.5; ramp = np.where((a > 0) & (a < 1), a ** 2.5, 0)
    for ch in (0, 1):
        nz = rng.standard_normal(N); riser = lowpass(nz, 6000) - lowpass(nz, 900)       # a band of air that swells
        mix[:, ch] += riser * ramp * 0.09 * np.where(tt < T_TITLE - 0.01, 1, 0)
    put(mix, T_TITLE + 0.05, bell(81), 0.11, -0.1); put(mix, T_TITLE + 0.05, bell(88), 0.05, 0.2)   # the drop: one clean bell
    put(dry, T_END, thump(3.5), 0.42)                                                                  # the mark: a low boom
    tail = np.arange(N - int(T_END * SR)) / SR                                                         # and the strings resolve under it
    res = lowpass(strings((38, 50, 57, 62, 66, 69), tail), 900) * np.minimum(1, tail / 0.4) * np.exp(-tail * 0.7) * 0.2
    mix[int(T_END * SR):, 0] += res; mix[int(T_END * SR) + haas:, 1] += res[:-haas]
    ir_t = np.arange(int(2.6 * SR)) / SR                                                               # a hall: two decaying noises, one per side
    def ir():
        x = lowpass(rng.standard_normal(len(ir_t)), 5000) * np.exp(-ir_t * 2.2); x[0] = 0; return x / np.sqrt((x ** 2).sum())
    L = 1 << int(np.ceil(np.log2(N + len(ir_t))))
    conv = lambda x, h: np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(h, L), L)[:N]
    irl, irr = ir(), ir()
    wet = np.stack([conv(mix[:, 0] + 0.4 * mix[:, 1], irl), conv(mix[:, 1] + 0.4 * mix[:, 0], irr)], 1)
    final = dry + mix + 0.3 * wet
    final *= np.minimum(1, (DUR - tt) / 0.8).clip(0, 1)[:, None]
    final = final / np.abs(final).max() * 0.8
    with wave.open(wav, "wb") as w_:
        w_.setnchannels(2); w_.setsampwidth(2); w_.setframerate(SR); w_.writeframes(np.int16(final * 32767).tobytes())

subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", silent, "-i", wav, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.84:level=false",   # social loudness, then a ceiling
                "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest",
                "-movflags", "+faststart", out], check=True)
for f_ in ((silent,) if S.get("music_file") else (wav, silent)): os.remove(f_)
print(f"wrote {out}: {DUR:.1f}s, {count} frames, {n} cuts from {sc['first']}s to {sc['last']}s, title at {T_TITLE:.2f}s, mark at {T_END:.2f}s")
