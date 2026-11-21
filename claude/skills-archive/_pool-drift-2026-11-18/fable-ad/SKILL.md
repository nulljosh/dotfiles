---
name: fable-ad
description: Make a 19-second trailer for the current repo's app in the grammar of Anthropic's Fable 5.2 film. One gentle curved horizon sits in every shot while the world under it changes at a steady pace. It opens and closes on the same calm home shot with a tiny traveller walking the rim, and ends with the name, small, on the horizon, then the mark. Use for /fable-ad, "fable trailer", "trailer like the Fable ad", "make a trailer for this repo".
---

# /fable-ad

There are three house styles. `/opus-ad` uses the rim with accelerating cuts. `/kimi-ad` is wordless, built from field lines and one number. This one is calm: steady cuts under one horizon, a bookend, a small name. Whichever you pick, the film shows the real app, with the best screens first.

The reference is Anthropic's "Introducing Claude Fable 5.2" (youtube.com/watch?v=6a1QSJlsYpU, 19 s, 2026-11-09). Measured: about 10 cuts, at 2.7, 4.7, 6.3, 7.2, 8.1, 9.3, 10.1, 11.3, 12.3 and 13.5 s. It opens on a home shot, a dusk sky over a curved sea, while a tiny walker crosses the rim. Then every shot puts a different world under the same convex curve: a dune, a planet limb, an eye, a chart of arcs, a sunrise, a leaf, a microscope slide, an aurora. At 13.5 s it returns to the home shot. The name fades in small, centred just above the rim, and at 16 s it swaps for the mark and wordmark in the same spot, then fades. The audio holds at about -14 dB through the shots, drops to about -34 on the return, swells once under the mark, and goes out.

Borrow the grammar, never the brand. Use the app's own palette, typeface and mark. No Claude mark, no Anthropic serif, and not their peach-sky-over-blue-sea palette. Never use frames from the reference.

## 1. Read the current repo
- Root: `git rev-parse --show-toplevel`. Name it the way the repo's CLAUDE.md and README do, using one name everywhere.
- Palette: `brand/tokens.css` or `brand/BRAND.md`. No brand? Run `/brand` first.
- Mark: render `icon.svg` or `brand/mark.svg` with `rsvg-convert -w 512` to a square PNG with transparency. Don't use magick for this.
- Font: the repo's `fonts/`. If it has none, use SF Pro (`/System/Library/Fonts/SFNS.ttf`).
- Pictures: reuse the list from any older ad spec (`find . -path '*ad/*.json'`). Next try fastlane or App Store screenshots. Then fall back to the `app-screenshots` skill. Current UI only, dark and light both, with no test data or old names on screen.
- Numbers for the chart shot come from the repo itself. Commits per month (`git log --format=%ad --date=format:%Y-%m | sort | uniq -c`), chapters, tracks: real counts only.

## 2. Pick the shots (9, plus home)
The Fable signature is that the curve belongs to the picture. Mix three kinds so it doesn't read as opus-ad slowed down:
- Screens under the rim (`image`, with `sky` set to two palette colours). Set `focus` so the readable part of the screen lands below the rim; a low focus y (about 0.2) puts the top of the screen right on the rim. These go first, because the early shots are the longest.
- Pictures with their own curve (`full: true`): a device edge, a close-up from Wikimedia Commons on the app's subject (public domain or CC-BY, credit it in the README), or the mark's own curve.
- One chart shot (`lines`: one arc per real number, each a label like "570 commits, Oct" so it reads), plus a flat palette colour or two near the end.
Home is the calmest frame you have, often a flat accent colour under a gradient sky. The traveller is the mark as a small silhouette.

## 3. Write the spec and render
Put `fable.json` in the repo's ad folder (`ad/` or `docs/ad/`). The format is documented at the top of `rim.py`:
```json
{"out": "fable.mp4", "font": "../fonts/App-Medium.otf",
 "palette": {"ink": "#141311", "paper": "#faf8f4", "gold": "#a56200", "light": "#f5b83d", "deep": "#c97a00"},
 "home": {"fill": "gold", "sky": ["ink", "deep"]},
 "shots": [{"image": "shots/library-dark.png", "focus": [0.5, 0.4], "zoom": 1.3, "sky": ["paper", "light"]},
           {"lines": [16, 83, 126, 64, 330], "fg": "ink", "bg": "light", "full": true}],
 "name": {"text": "App 2.0", "colour": "paper"},
 "end": {"mark": "mark.png", "name": "App"}}
```
```
uv run -q --with pillow --with numpy python ~/.claude/skills/fable-ad/rim.py fable.json
```
This takes about a minute and needs about 1 GB free. Frames stream to ffmpeg. The built-in score is a warm open-fifth bed in E, with a soft pulse on each cut. It drops to near silence on the return, plays a bell under the name and one swell under the mark, then fades. Output is -14 LUFS. For a better score, use ElevenLabs Music timed to the cut list it prints, passed as `music_file` (see opus-ad).

## 4. QA until A+
- Frames: `ffmpeg -i OUT -vf "fps=2,scale=400:-1,tile=5x8" -frames:v 1 sheet.jpg`. Look at every tile. The rim is at the same height on every masked shot. Each screen reads under the rim (no blank crops). The name is small, centred and never touches the rim. The traveller sits on the rim. No picture repeats back to back.
- Audio: `ffmpeg -i OUT -af volumedetect -f null -` should show a peak under -0.5 dB. The per-half-second RMS (`asetnsamples=24000,astats`) should hold steady through the shots and fall 15 dB or more on the return. Never play audio on the Mac.

## 5. Ship
Send Joshua the mp4 and the sheet with SendUserFile. Commit the spec beside the older ads. Swap it onto the landing or a release only when he says yes.
