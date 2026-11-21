#!/usr/bin/env python3
"""A trailer in the grammar of Anthropic's Fable 5.2 film (Nov 2026, 19 s), for the current repo's app.

The grammar, measured off the reference (10 cuts, 19 s):
  - one gentle convex horizon, apex near the middle of the frame, sits in every shot; the world changes under it;
  - it opens on a home shot (a calm world, a soft sky) while a tiny traveller walks along the rim, about 2.7 s;
  - then about 9 shots at a steady pace (2.0, 1.6, then near 1 s each), not accelerating;
  - it returns to the home shot: the name, small, centred just above the rim, then the mark and the name in the same
    spot, then a fade. The music drops to near silence on the return and swells once under the mark.

    uv run -q --with pillow --with numpy python rim.py SPEC.json

SPEC (paths relative to the spec file):
  out, size [w, h], fps, font, palette {name: "#hex"}, rim (apex height, 0.55), curve (radius in widths, 2.2), grain
  home     {image | fill, sky [top, horizon], focus, zoom, secs, walker true}   the bookend
  shots    [{image | video | fill | lines, sky [top, horizon], focus, zoom, full, secs, start}]
           full: true shows the picture edge to edge (it has its own curve, so no mask)
           lines: [numbers or "570 commits, Oct"]: one arc each under the rim, labelled at the right (real repo numbers only)
  beats    [secs, ...]                       default shot lengths, cycled (the measured ones if left out)
  name     {text, secs, colour}              the small name on the rim
  end      {mark, name, secs}                the mark beside the name, same spot, then the fade
  music_file                                 a composed score timed to this plan, else the built-in one
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
RIM = int(H * S.get("rim", 0.55)); R = W * S.get("curve", 2.2)
def rim_y(x): return RIM + R - np.sqrt(max(0.0, R * R - (x - W / 2) ** 2))
FONT = ImageFont.truetype(P(S["font"]), int(H * S.get("name_size", 0.042)))
INK = rgb(S["name"].get("colour", "#ffffff"))

def disc_mask():                               # anti-aliased: drawn at 4x, then reduced
    k = 4; m = Image.new("L", (W * k, H * k), 0)
    ImageDraw.Draw(m).ellipse([(W / 2 - R) * k, RIM * k, (W / 2 + R) * k, (RIM + 2 * R) * k], fill=255)
    return m.resize((W, H), Image.LANCZOS)
MASK = disc_mask()

def sky(top, low):                             # a soft vertical gradient, the top colour into the horizon colour
    a = (np.arange(H, dtype=np.float32) / RIM).clip(0, 1)[:, None, None] ** 1.4
    img = np.array(rgb(top), np.float32) * (1 - a) + np.array(rgb(low), np.float32) * a
    return Image.fromarray(np.broadcast_to(img, (H, W, 3)).astype(np.uint8))

def cover(img, focus, zoom, full):             # fill the frame; the focus point lands in the middle of the world under the rim
    img = img.convert("RGB"); s = max(W / img.width, H / img.height) * zoom * 1.06
    img = img.resize((int(img.width * s) + 1, int(img.height * s) + 1), Image.LANCZOS)
    cy = H / 2 if full else (RIM + H) / 2; fx, fy = focus
    lo = 0 if full else -RIM                   # under the rim the picture may start lower than the frame top, so a screen's top can sit on the rim
    return img, (min(max(0, int(fx * img.width - W / 2)), img.width - W), min(max(lo, int(fy * img.height - cy)), img.height - H))

def clip(path, start, m, focus, zoom):         # m frames of a video from `start`, filling W x H around focus
    fx, fy = focus; z = max(1.0, zoom)
    vf = (f"fps={FPS},scale={int(W * z)}:{int(H * z)}:force_original_aspect_ratio=increase,"
          f"crop={W}:{H}:(iw-{W})*{fx}:(ih-{H})*{fy}")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-i", path, "-vf", vf, "-frames:v", str(m),
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    fr = [Image.frombytes("RGB", (W, H), raw[i * W * H * 3:(i + 1) * W * H * 3]) for i in range(len(raw) // (W * H * 3))]
    return fr + [fr[-1]] * (m - len(fr))

def lines(nums, fg, bg):                       # the chart shot: one arc per real number, stacked under the rim, labelled
    f = Image.new("RGB", (W, H), rgb(bg)); d = ImageDraw.Draw(f); small = FONT.font_variant(size=int(H * 0.04))
    gap = (H - RIM) / (len(nums) + 1)
    for i, v in enumerate(nums):
        top = RIM + gap * (i + 0.6)
        d.ellipse([W / 2 - R, top, W / 2 + R, top + 2 * R], outline=rgb(fg), width=5)
        lab = f"{v:,}" if isinstance(v, (int, float)) else str(v)
        x = W * 0.96 - d.textlength(lab, font=small); d.text((x, rim_y(x) - RIM + top - H * 0.035), lab, font=small, fill=rgb(fg))
    return f

GRAIN = float(S.get("grain", 0.2)); _rng = np.random.default_rng(1)
def grain(img):
    if not GRAIN: return img
    a = np.asarray(img, np.int16) + (_rng.standard_normal((H, W, 1)) * 9 * GRAIN).astype(np.int16)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def world(sh):                                 # (still source, offset) or video frames for one shot
    if "fill" in sh: return Image.new("RGB", (W, H), rgb(sh["fill"])), (0, 0)
    if "lines" in sh: return lines(sh["lines"], sh.get("fg", "#ffffff"), sh.get("bg", "#000000")), (0, 0)
    return cover(Image.open(P(sh["image"])), sh.get("focus", [0.5, 0.5]), sh.get("zoom", 1.0), sh.get("full"))

def frame(sh, src, off, i, m, secs, vid=None):  # one frame: the sky, then the world under the rim, with a slow push-in
    if vid is not None: pic = vid[i]
    elif "image" in sh:
        z = sh.get("push", 0.03) * (i + 1) / max(1, m) * secs; dx, dy = W * z / 2, H * z / 2; x0, y0 = off
        pic = src.crop((x0 + dx, y0 + dy, x0 + W - dx, y0 + H - dy)).resize((W, H), Image.BICUBIC)
    else: pic = src
    if sh.get("full"): return pic.copy()
    f = sky(*sh.get("sky", ["#000000", "#202020"])); f.paste(pic, (0, 0), MASK); return f

# ---- the timeline ----
home, shots, nm, e = S["home"], S["shots"], S["name"], S["end"]
beats = S.get("beats", [2.0, 1.6, 0.9, 0.85, 1.2, 0.85, 1.15, 1.0, 1.2])
cuts = [home.get("secs", 2.7)]
for k, sh in enumerate(shots): cuts.append(cuts[-1] + sh.get("secs", beats[k % len(beats)]))
T_RET = cuts[-1]; T_MARK = T_RET + nm.get("secs", 2.6); DUR = T_MARK + e.get("secs", 2.8)

out = P(S["out"]); silent = out + ".video.mp4"
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", silent], stdin=subprocess.PIPE)
count = 0
def emit(img):                                 # streamed, so length costs no memory
    global count; enc.stdin.write(grain(img).tobytes()); count += 1
def frames_until(t): return max(0, int(round(t * FPS)) - count)

def glyph(mk, h):                              # a transparent mark becomes a silhouette in the name colour; an opaque icon stays as it is
    mk = mk.convert("RGBA").resize((h, h), Image.LANCZOS)
    if mk.getchannel("A").getextrema()[0] == 255: return mk
    g = Image.new("RGBA", mk.size, INK + (0,)); g.putalpha(mk.getchannel("A")); return g
walker = None
if home.get("walker", True):                   # the traveller: the mark as a small silhouette in the name colour
    walker = glyph(Image.open(P(e["mark"])), int(H * 0.045))
def walk(f, x, t):
    if walker is None: return
    bob = abs(np.sin(t * 2 * np.pi * 1.6)) * H * 0.004
    f.paste(walker, (int(x - walker.width / 2), int(rim_y(x) - walker.height - bob + 2)), walker)

def label(f, text, mark, a):                   # the name, small, centred just above the rim; with the mark beside it at the end
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    l, t, r, b = d.textbbox((0, 0), text, font=FONT); mh = int((b - t) * 1.35) if mark else 0; gap = int(mh * 0.35) if mark else 0
    x = (W - (mh + gap + r - l)) // 2; base_y = RIM - int(H * 0.045)
    if mark:
        tint = glyph(Image.open(P(e["mark"])), mh)
        layer.paste(tint, (x, base_y - mh + int(mh * 0.12)), tint)
    d.text((x + mh + gap - l, base_y - (b - t) - t), text, font=FONT, fill=INK)
    layer.putalpha(layer.getchannel("A").point(lambda v: int(v * a)))
    f.paste(layer, (0, 0), layer)

hsrc, hoff = world(home); hvid = None
m = frames_until(cuts[0])
for i in range(m):                             # the home shot: the traveller walks in from the left toward the middle
    f = frame(home, hsrc, hoff, i, m, cuts[0]); walk(f, W * (0.08 + 0.3 * i / m), i / FPS); emit(f)
for k, sh in enumerate(shots):
    m = frames_until(cuts[k + 1]); secs = cuts[k + 1] - cuts[k]
    if "video" in sh: src, off, vid = None, None, clip(P(sh["video"]), sh.get("start", 0), m, sh.get("focus", [0.5, 0.5]), sh.get("zoom", 1.0))
    else: (src, off), vid = world(sh), None
    for i in range(m): emit(frame(sh, src, off, i, m, secs, vid))
m = frames_until(T_MARK)
for i in range(m):                             # the return: the name fades in on the rim, the traveller walks on to the right
    f = frame(home, hsrc, hoff, i, m, 0); walk(f, W * (0.62 + 0.3 * i / m), i / FPS)
    label(f, nm["text"], False, min(1, i / (0.5 * FPS)) * min(1, (m - i) / (0.25 * FPS))); emit(f)
m = frames_until(DUR)
for i in range(m):                             # the mark and the name in the same spot, then fade the whole frame out
    f = frame(home, hsrc, hoff, 0, 1, 0); label(f, e["name"], True, min(1, i / (0.25 * FPS)))
    fade = min(1, (m - 1 - i) / (0.7 * FPS))
    emit(Image.blend(Image.new("RGB", (W, H), (0, 0, 0)), f, fade) if fade < 1 else f)
enc.stdin.close(); enc.wait()

wav = P(S["music_file"]) if S.get("music_file") else out + ".wav"
if not S.get("music_file"):
    # ---- the score: a warm bed that holds steady through the shots, a soft pulse on each cut, near silence on the
    # return with one bell under the name, one swell under the mark, then out. Every sound is ramped, so nothing clicks.
    SR = 44100; N = int(SR * DUR) + 1; mix = np.zeros((N, 2)); tt = np.arange(N) / SR; rng = np.random.default_rng(6)
    hz = lambda m_: 440 * 2 ** ((m_ - 69) / 12)
    def soft(sig, attack=0.004, release=0.03):
        n_ = len(sig); a_ = min(n_, int(attack * SR)); r_ = min(n_, int(release * SR))
        sig = sig.copy(); sig[:a_] *= np.linspace(0, 1, a_); sig[n_ - r_:] *= np.linspace(1, 0, r_) ** 2; return sig
    def put(t, sig, g, pan=0.0):
        sig = soft(sig); i = int(t * SR); j = min(N, i + len(sig)); a = (pan + 1) * np.pi / 4
        if i < N: mix[i:j, 0] += g * np.cos(a) * sig[:j - i]; mix[i:j, 1] += g * np.sin(a) * sig[:j - i]
    def lowpass(x, fc):
        L_ = 1 << int(np.ceil(np.log2(len(x)))); f_ = np.fft.rfftfreq(L_, 1 / SR)
        return np.fft.irfft(np.fft.rfft(x, L_) / np.sqrt(1 + (f_ / fc) ** 4), L_)[:len(x)]
    def pad(notes, t):                         # detuned saws, filtered warm, a slow vibrato
        v = 1 + 0.0015 * np.sin(2 * np.pi * 4.5 * t)
        return lowpass(sum(2 * ((hz(n_) * v * 2 ** (c / 1200) * t) % 1) - 1 for n_ in notes for c in (-7, 0, 6)) / (3 * len(notes)), 900)
    def bell(m_, d=5.0):
        t = np.arange(int(d * SR)) / SR; f_ = hz(m_)
        return np.sin(2 * np.pi * f_ * t + 0.7 * np.exp(-t * 3) * np.sin(2 * np.pi * 2.0 * f_ * t)) * np.exp(-t * 0.9)
    def pulse(d=0.6, f0=41.2):                 # a soft low E
        t = np.arange(int(d * SR)) / SR; ph = 2 * np.pi * np.cumsum(f0 * (1 + 0.4 * np.exp(-t * 30))) / SR
        return np.sin(ph) * np.exp(-t * 5)
    bed = pad((40, 52, 59, 64, 66, 71), tt)    # E2 E3 B3 E4 F#4 B4: open, unresolved
    env = np.clip(tt / 1.8, 0, 1) * (0.8 + 0.2 * np.exp(-((tt - 4.5) / 1.5) ** 2))
    drop = np.clip((tt - T_RET) / 0.25, 0, 1)  # near silence on the return (about -20 dB)
    env *= 1 - 0.9 * drop
    sw = np.exp(-((tt - (T_MARK + 0.4)) / 0.9) ** 2) * 0.6 * (tt > T_RET)   # one swell under the mark
    env += sw; env *= np.clip((DUR - tt) / 1.0, 0, 1)
    haas = int(0.013 * SR); mix[:, 0] += 0.3 * bed * env; mix[haas:, 1] += 0.3 * (bed * env)[:-haas]
    for k, t in enumerate(cuts[:-1]): put(t, pulse(), 0.28, (-0.2, 0.2)[k % 2])
    for k, (t, n_) in enumerate(zip(np.arange(0.3, cuts[0], 0.8), (64, 71, 76))): put(t, bell(n_, 3), 0.05, (-0.3, 0.3)[k % 2])
    put(T_RET + 0.1, bell(76), 0.09, -0.1); put(T_MARK, bell(83), 0.06, 0.15)
    ir_t = np.arange(int(2.4 * SR)) / SR
    def ir():
        x = lowpass(rng.standard_normal(len(ir_t)), 5000) * np.exp(-ir_t * 2.4); x[0] = 0; return x / np.sqrt((x ** 2).sum())
    L = 1 << int(np.ceil(np.log2(N + len(ir_t))))
    conv = lambda x, h: np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(h, L), L)[:N]
    irl, irr = ir(), ir()
    final = mix + 0.3 * np.stack([conv(mix[:, 0] + 0.4 * mix[:, 1], irl), conv(mix[:, 1] + 0.4 * mix[:, 0], irr)], 1)
    final *= np.clip((DUR - tt) / 0.8, 0, 1)[:, None]; final = final / np.abs(final).max() * 0.8
    with wave.open(wav, "wb") as w_:
        w_.setnchannels(2); w_.setsampwidth(2); w_.setframerate(SR); w_.writeframes(np.int16(final * 32767).tobytes())

subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", silent, "-i", wav, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.84:level=false",
                "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out], check=True)
for f_ in ((silent,) if S.get("music_file") else (wav, silent)): os.remove(f_)
print(f"wrote {out}: {DUR:.1f}s, {count} frames, {len(shots)} shots, return at {T_RET:.2f}s, mark at {T_MARK:.2f}s")
