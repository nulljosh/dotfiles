---
name: x
description: Joshua's X/Twitter (@nulljosh1) — check sign-in, read his posts and their stats, and post app launches from <app>/launch/x.md (prefilled compose, then click Post since he's signed in). Also the sign-in route for Product Hunt. Use for /x, /twitter, "tweet", "post on X", "my X stats", or posting an app's launch/x.md.
---

# /x

**Joshua wants this headless: never make him look at Safari.** Background tabs still pop the window, and navigating the active tab is worse. True headless needs X API keys (developer.x.com) in Keychain `x-api`; until those exist, ask once before any Safari step and batch every post into that one window. Check the live profile before posting: an x.md without a `Post:` line doesn't prove it was never posted (Nimble got duplicated 2026-11-24).

Handle: **@nulljosh1**. As of 2026-11-24 he's signed in to x.com in Safari on Dad's Mac. Open background tabs (`osascript … make new tab at end of tabs`), act by tab id, and close your tabs afterwards.

## Sign-in
`x.com/home` loads the timeline = signed in. If a login form appears, Joshua types; never enter his password.

## Read
In a background tab, `https://x.com/nulljosh1` → `get_page_text` for recent posts with views, likes and reposts. Per-post numbers are at `https://x.com/nulljosh1/status/<id>/analytics`. No API key; don't scrape in loops.

## Post
- Draft: `<app>/launch/x.md` (thread lines `1/`, `2/`…; a `Post:` line means it already went out).
- Single post: open `https://x.com/intent/post?text=<urlenc>` in a background tab, then click **Post** (Joshua said: when he's signed in, clicking buttons is my job). For threads, post 1/, then reply to it with 2/ and so on.
- At most one app per day, no reposting the same text. Use info@jaybulb.com if an email is needed, never the personal one.
- Afterwards, write `Post: <url> (YYYY-MM-DD)` at the top of x.md and commit/push the app repo.

## Product Hunt via X
PH's "Sign in with X" goes to /duplicate-account because his PH account is email-based; PH emails a login link to his iCloud address. Joshua opens that link. Never click "create a new account".
