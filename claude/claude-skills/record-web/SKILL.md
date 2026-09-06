---
name: record-web
description: Record a live web page headlessly into a GIF plus four still frames, to verify animations, hero motion, or any time-based UI without opening Chrome. Use when the user says /record-web, "record the site", "get a recording", "make a gif of the page", or asks to verify an animation looks right.
---

# record-web

Headless Chromium (Playwright via uvx) records the page for N seconds, ffmpeg turns it into a GIF, and four evenly spaced PNG frames land beside it.

```
~/.claude/skills/record-web/record.py URL [seconds=30] [out.gif] [WxH=1200x800]
```

Defaults: 30 s, `~/Desktop/<host>.gif`, 1200x800. A cache-busting query is appended so the deploy just pushed is what gets recorded.

After it runs, Read one or two of the printed frame PNGs to actually look at the result, then tell the user the GIF path. First run on a machine installs Chromium (`uvx --from playwright playwright install chromium`) if the launch fails.
