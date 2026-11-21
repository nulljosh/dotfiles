---
name: opus-ad
description: Make a short launch film in the grammar of Anthropic's Opus 5.5 ad, for one of Joshua's apps, with its own pictures, colours and type. Every shot is one picture seen through the same giant disc, so the rim is one horizon across fast hard cuts, and a three-beat line sits on it. Use for /opus-ad, "make a commercial like the Opus ad", "launch video", "promo for <app>".
---

# /opus-ad

Three house styles: this one (the rim and fast cuts), `/kimi-ad` (wordless: field lines, bars, one number, the app's screens in the geometry) and `/fable-ad` (calm: steady cuts under one horizon, a bookend, a small name). Joshua picked the kimi cut for Kernel 20. Either way the film shows the real app: no shot is only shapes or flat colour for long, and the best screenshots go first.

The reference is Anthropic's Opus 5.5 film (x.com/claudeai/status/2102435511222890900, 20 s), measured: 37 cuts, a D sub-bass under a D major 9 bell motif. Its grammar:
- One shape, matched across every cut: a curved horizon at the same height, with a different world under it each time.
- The cuts accelerate, about 1 s apart at first and 0.12 s at the end, and the music is cut to them: bells alone for the first 4 s, then a sub pulse on every cut, building.
- A short line, one beat per word, sitting on the rim, landing around cut 12, 16 and 18 of 34. The last word holds over the fastest cuts.
- It opens on a glowing horizon (a dark planet with a lit rim), then drops to silence and one clear bell on the name, then a low boom under the mark.
From Apple's macOS reveal films: the name card is big and bold, centred, over the horizon.

Borrow the grammar, never the brand. Use the app's own pictures, palette and typeface, and no Claude mark, Anthropic serif or their colours. Our design system wins: flat colours (the horizon glow is the one exception, in the app's own accent), the app's accent and type.

## 1. Gather pictures (12 to 20)
Use the app's real material: product renders, real photos, app screenshots, the mascot, the mark. Short on real photos of a place or object? Search Wikimedia Commons first (`commons.wikimedia.org/w/api.php`, keyless), public domain or CC-BY only, credit in the end card. Go for close-ups with texture under the rim. Two kinds of shot are cheap and strong: a flat-colour disc per theme colour, and the mark's own curve. Make a contact sheet first:
`magick montage -font /System/Library/Fonts/Supplemental/Arial.ttf -label '%f' A B C ... -geometry 300x200+4+4 -tile 4x sheet.jpg`

## 2. Write the line
Three beats, about the release's one idea, in the house voice: plain words, no hype (Joshua Tree 6.0, "Yours": "It's / all / yours."). Put the last word on the shots that prove it.

## 3. Write the spec and render
A JSON spec, documented at the top of `arcad.py` in this folder: open, pool (about 34 shots in order: image or flat fill, focus, zoom, sky), schedule (count, first, last), words (cut index and word), title, end (mark and name). Put the best pictures first, because the early cuts are long, and the flat colours and repeats in the fast run at the end. Joshua Tree's spec is `docs/hardware/ad/yours.json` there.
```
uv run -q --with pillow --with numpy python ~/.claude/skills/opus-ad/arcad.py SPEC.json
```
Frames stream to ffmpeg, so length costs no memory. The built-in score is original and generated from the same timeline, in stereo: detuned strings whose filter opens as the cuts speed up, a soft piano opening, a sub thump on each cut, an air riser into a hard stop, one bell on the name and a boom under the mark, through a hall reverb, at -14 LUFS. Every sound is faded in and out, so nothing clicks. Keep about 2 GB free.

Better than the built-in score: ElevenLabs Music (`POST /v1/music`, `music_v2_5`, a `composition_plan` of chunks timed to the cut plan). The key needs the Music Generation permission. Better than stills: Higgsfield Seedance clips from the app's own renders (`api.higgsfield.ai/bytedance/seedance-2.5/reference-to-video`, an image URL from the public repo), used as `video` shots; about $1 to $3 for 4 s at 1080p, so check the API balance first.

## 4. QA until A+
Pull one frame from the middle of every shot into a sheet (`ffmpeg -vf "select=..."` or `fps=2,tile`), and look at all of it:
- the rim is at the same height on every shot;
- the picture under the rim reads (a face, a screen, a board), not a blur or empty background;
- the text has contrast on its sky and never touches the rim;
- the end card is centred and the mark is crisp.
- no shot is empty: a near-blank screenshot or a crop of plain background gets swapped;
- no picture repeats back to back.
- the audio has no clicks: count second-difference spikes 40x over the local median (the check is in the Joshua Tree run); a limiter squashing a loud boom also crackles, so keep the boom under it.
Fix the focus and zoom, re-render, look again. Never play the audio on the Mac. Check it with `ffmpeg -af volumedetect` (peak under -0.5 dB, mean around -15) and the loudness per second: it should rise to a peak just before the title, then drop.

## 5. Ship
Send Joshua the mp4 and the frame sheet with SendUserFile. Put the spec in the repo beside the old ad. Replace the landing's video only when he says yes.
