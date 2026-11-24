---
name: producthunt
description: Joshua's Product Hunt (maker @nulljosh1) — help him sign in, read his products and launches (votes, comments, launch dates, which apps have no launch), and prepare launches from an app's launch/producthunt.md (fill the form, he clicks Schedule/Submit). Use for /producthunt, /ph, "product hunt login", "launch on product hunt", "PH stats", or "which apps aren't on PH".
---

# /producthunt

Joshua uses Safari. Open background tabs only (see /reddit for the osascript line), read them by tab id, and close them afterwards.

## Sign in (help, never type)
- Maker profile: **@nulljosh1** (same handle as his X account).
- Product Hunt sign-in is social or email: try **Continue with X (@nulljosh1)** first, then Google/Apple. An email code goes to his inbox. https://www.producthunt.com/login in a background tab.
- Cloudflare "Just a moment…" is a browser check. Let it finish in Safari; curl and headless can't pass it.
- Record which sign-in worked (not credentials) in `~/Documents/Josh/App Store/STATE.md`.

## Read
- API (headless): `python3 ~/Documents/Josh/Code/dotfiles/claude/claude-skills/launch/producthunt.py list` with the Keychain item `producthunt-api` (a personal developer token from producthunt.com/v2/oauth/applications; Joshua makes it once while signed in, then `security add-generic-password -s producthunt-api -a nulljosh1 -w`, which prompts for it).
- No token: `https://www.producthunt.com/my/products` in a background tab → `get_page_text`. Slugs never change on rename (see the launch skill).

## Launch
- Copy: `<app>/launch/producthunt.md` (name, tagline ≤60, description ≤260, topics, pricing, first comment). Check that the pricing line matches GTM.md before using it.
- If the product page already exists, launch from it (no duplicate product). Fill fields with `mcp__safari__javascript` on that tab id, or with `launch/ph_submit.py` once `ph_apps.py` has the app; its paths assume Joshua's Mac, so fix `R=` here.
- **Stop before Schedule/Submit.** Joshua picks the day (12:01 a.m. PT) and clicks. Afterwards add `Post: <url> (date)` to producthunt.md and commit/push.
