---
name: landing-demo
description: Give a web app's landing page the nimble treatment — the real app running live inside a device frame (iPhone, Android, Mac window, Windows window) picked from the visitor's user agent, right under the hero tagline. Use when the user says /landing-demo, "nimble treatment", "live demo on the landing", "sexy landing", or when shipping a new app's landing page. Every landing page in ~/Documents/Code must have this.
---

# Landing demo (the nimble treatment)

The reference is `nimble/docs/index.html`. What it does:

1. A UA sniff in `<head>` sets `data-device` on `<html>`: android / iphone / windows / mac (iphone is the default).
2. `devices.css` (canonical copy in `nulljosh.github.io/devices.css`, local copy next to the landing page) draws a realistic frame for that device.
3. Inside the frame is the app itself, live and interactive. Nimble ships its real engine; every other app uses a same-origin `<iframe>` of the app, rendered at native width and scaled to the screen.
4. A caption under it: "This is the iPhone app, live. Try it." with the device name swapped in.

## Run it

`~/.claude/skills/landing-demo/inject.py` does the whole thing. Add a row to `APPS`:

```
('Name', 'repo/path/to/landing.html', 'app url', 'selectors hidden when embedded')
```

- App url is relative to the landing page (`/app`, `play.html`, `/app.html`). Leave it `''` when the landing and the app are the same page: the script then iframes `./?embed`, and the head script adds class `embed` to `<html>` so `.hero`, `nav`, `footer` and the demo block itself disappear inside the frame. Put the hero selector in the fourth column (`.hero`, or `header,h1,.sub` when there is no hero class).
- Insertion point is after the first `</p>` following the first `<h1>`, i.e. right under the tagline. If the page has no h1 the script prints `NO ANCHOR`: add the block by hand from the template inside the script.
- It copies `devices.css` in if missing and skips pages that already have `id="demoFrame"`.

Then run `python3 ~/.claude/skills/landing-demo/inject.py`, screenshot once with headless Chrome (a Mac UA and an iPhone UA) to eyeball it, commit, push, and deploy with the repo's own deploy command. A push deploys nothing.

## Rules

- The frame holds the real app, never a screenshot or a mock. If the app is auth-gated with no guest mode, there is no demo: say so instead of faking one.
- One frame, matched to the visitor. Do not show all four devices.
- Keep the caption honest: "live", not "demo mode", unless it really is.
- Sizing lives in CSS (`--device-w`); only the iframe scale is JS, because CSS cannot divide a length into a unitless number.
- No emojis, no gradients, house tokens only. See `~/Documents/Code/CLAUDE.md`.

## Done so far (2026-09-06)

nimble, charwork, numen (real engine or grid). iframe treatment: bookrank, breathe, conway, dream, homeqi, inkpress, keyrate, quotestreak, seamark, tripwire, voxprint, wordroot, curvely, lexly, sidewise, nyc. curbfind's hero is the full-bleed live app and sparkjar shows live frames by media query; both count. Skipped: epiphany, healstack, talli, roost (SPA shells, auth-gated, no landing), plain (native-only, inline textarea demo already), cadence (the page is the app), homeward and bcgd (no web landing).
