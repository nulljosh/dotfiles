---
name: screenshot-refresh
description: Refresh the screenshots/ folder for one or all web app projects under ~/Documents/Code by driving the live site in Chrome. Use when screenshots are missing, stale, or the user asks to refresh app screenshots or invokes /screenshot-refresh.
---

# screenshot-refresh

For iOS/macOS App Store screenshots, use `appstore-screenshots` or `asc-shots-pipeline` instead —
this skill is for the `screenshots/` folder of PNGs in each repo (used in READMEs, portfolio,
etc.), sourced from the live deployed web app.

## Steps

1. Find the target repo(s). If no repo named, do all repos under `~/Documents/Code` that have a
   `screenshots/` dir already (refresh) or a `WHITEPAPER.md` + a live URL in their README but no
   `screenshots/` dir yet (create).
2. Get the live URL from the repo's README (the `heyitsmejosh.com`/`jaybulb.com` subdomain) —
   don't guess a URL, read it.
3. Open the URL in Chrome (claude-in-chrome), wait for load, capture a screenshot at a normal
   desktop viewport. If the app has a couple of obviously distinct screens (e.g. landing +
   one core feature), capture those too — 1-3 shots per app, not a full click-through tour.
4. Save each as `screenshots/<repo>-N.png` (or overwrite existing filenames if refreshing, so
   README image references don't break).
5. Report which repos were refreshed/created and how many shots each got.

## Rules
- ponytail: no headless-browser scripting pipeline — this is a handful of repos, drive Chrome
  directly per repo and move on.
- Don't touch README image references unless a filename changed.
- Skip a repo if its live URL 404s or the deploy looks broken — report it, don't screenshot a
  broken page and move on silently.
