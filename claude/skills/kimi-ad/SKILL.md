---
name: kimi-ad
description: Make a 20-second wordless launch teaser in the grammar of the Kimi K3 teaser (diagrams, field lines and geometry built around one number, the name only at the end) that shows the app's real screens, for one of Joshua's apps, in its own palette, type and mark. Use for /kimi-ad, "kimi commercial", "kimi style ad", "wordless teaser", or a launch film that is not the Opus rim style.
---

# /kimi-ad

Reports on the Kimi K3 teaser (Moonshot, July 2026) describe the grammar: wordless, built around the number of the
release, a glossy montage of diagrams, geometric shapes and magnetic field lines, ending on the name. Borrow the
grammar, never the brand: the app's own colours, typeface and mark. The first one made was Kernel 20 (spec kernel/ad/kernel-20-field.json).
Sibling styles: `/opus-ad` (the rim and accelerating cuts) and `/fable-ad` (calm: one horizon, steady cuts, a bookend).

## Show the app (Joshua, 2026-10-30)
Lines alone are not a commercial. Every film shows the app's real screens: five screenshots in `shots`, current UI
only (retake any that show an old layout), dark mode on the dark ink background, no objectionable book text, no
test or internal notes on screen. Phone shots read best; one iPad shot is fine.

## The film (20 s, fixed timeline)
1. 0 to 3 s: a gold seed appears, one orbit arc sweeps round it.
2. 3 to 7 s: dipole field lines open around the seed and turn slowly; screen 1 fades in at the centre of the field.
3. 7 to 11 s: the field gives way to a stack of bars drawn one after another on the left (chapters, tracks, tasks: whatever the app counts), the last ending on a light seed; screen 2 rises in on the right.
4. 11 to 15 s: the bars swing into a burst of rays around screen 3, rings open, and screens 4 and 5 slide out to either side.
5. 15 to 17.5 s: the release number, outlined then filled, over the field. A bell.
6. 17.5 to 20 s: the mark and the name, letterspaced, a low boom, fade to ink.
Score is generated in the script: a D drone that swells, a tick on each scene change, the bell and the boom.

## Make one
1. Write `SPEC.json` beside the app's ad folder (paths are relative to the spec):
```json
{"out": "v20/app-20-field.mp4", "number": "20", "name": "KERNEL", "bars": 20,
 "mark": "v20/mark.png", "font_bold": "../fonts/KernelSans-Bold.otf",
 "palette": {"ink": "#141311", "paper": "#faf8f4", "gold": "#a56200", "light": "#f5b83d"},
 "shots": ["v20/book-dark.png", "v20/library-dark.png", "v20/ipad-dark.png", "v20/book-light.png", "v20/library-light.png"]}
```
   `ink` is the background, `paper` the bars and name, `gold` and `light` the accents. Use the app's brand tokens
   (brand/tokens.css or BRAND.md). The mark is a square PNG with transparency; render an SVG mark with rsvg, not magick.
2. Render (about two minutes, needs ~2 GB free):
```
uv run -q --with pillow --with numpy python ~/.claude/skills/kimi-ad/field.py SPEC.json
```
   Screenshots: `app-screenshots` skill, or a simulator launch with the app's snapshot flags (Kernel: `-UITEST_SNAPSHOT 1 -UITEST_BOOK <slug>`).
3. QA: `ffmpeg -i OUT -vf "fps=2,scale=480:-1,tile=6x7" -frames:v 1 sheet.jpg`, then look at all of it: the field is symmetric, the bars never run off the frame, the number is centred and crisp, the name is centred, every screen is sharp, current and readable. Audio: `ffmpeg -i OUT -af volumedetect -f null -`, peak under -0.5 dB. Never play audio on the Mac.
4. Send Joshua the mp4 and the sheet with SendUserFile. Commit the spec beside the old ads; attach the mp4 to the GitHub release only when he likes it.

## Rules
- No Kimi or Moonshot name, logo, colours or type anywhere in the film.
- Wordless until the name. No tagline.
- Tweak timing or shapes in field.py itself; keep it one file.
