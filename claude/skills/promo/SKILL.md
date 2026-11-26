---
name: promo
description: Scan the codebase for apps with real screenshots and make promo videos from them, a 16:9 walkthrough for YouTube and a 9:16 ad for TikTok, in each app's own colour and mark. Use for /promo, "make promo videos", "TikTok ad", "YouTube walkthrough", "demo video for <app>", "advertise the apps".
---

# /promo

Two cuts per app, from the app's real screens and nothing invented: `explore.mp4` (1920x1080, about 30 s, slow push on each screen, a caption beside it) and `ad.mp4` (1080x1920, about 14 s, hook line first, a cut every 2 s, captions kept clear of TikTok's top and bottom bars). `/opus-ad`, `/kimi-ad` and `/fable-ad` are the artful single-app films; this one is the fast, repeatable one for the whole fleet.

## 1. Scan
```
uv run -q --with pillow --with numpy python ~/.agents/skills/promo/promo.py scan
```
Drafts `~/Documents/Code/launch/promo/<app>/spec.json` for every app with 3+ real screenshots (`launch/gallery`, `screenshots`, `docs/screenshots`, `public/screenshots`). Name, tagline, accent and icon come from the README, `brand/tokens.css` and `icon.svg`. It never overwrites a spec, so hand edits stick.

## 2. Edit the spec (this is what makes it good)
The draft captions are only file names. Rewrite each as a benefit in 2 to 5 words ("Ask anything.", "Graphs draw offline."), put the strongest screen first, drop dead ones (hero composites, near-empty screens), fix a clipped tagline, and set `hook` if the ad needs a sharper first line. Take claims from the README. No price, rating or "free" claim, no device frame, no emoji, no em dash. The end card shows the name and `<app>.jaybulb.com` only.

## 3. Render
```
uv run -q --with pillow --with numpy python ~/.agents/skills/promo/promo.py render nimble echo [--only ad|explore]
```
Frames stream to ffmpeg. The score is generated: a soft chord with a thump and a bell on every cut, at -14 LUFS. One app takes about a minute. Run apps one after another, in the background for a batch.

## 4. QA
Read `explore.jpg` and `ad.jpg` (a frame every 2 s). Check: text never touches an edge, every screen reads and is not blank, the caption fits its side, the end card is centred. Read the name printed inside each screen: renames leave old screenshots behind (Echo's gallery said Voxprint and Notate), so use only shots dated after the last rename and drop the rest. Fix the spec, re-render. Never play the audio; the render prints mean and max volume (mean near -16 dB, max under -1 dB).

## 5. Ship
Files stay in `launch/promo/<app>/` (`launch/` is gitignored in labs, so specs and videos stay on this Mac). Upload to YouTube and TikTok only on Joshua's yes: posting is outward-facing, so this skill stops at the files. Keep the title and description plain, with the `<app>.jaybulb.com` link first.
