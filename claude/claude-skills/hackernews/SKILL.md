---
name: hackernews
description: Joshua's Hacker News — find or create his account, read karma and past submissions (public API, headless), and prepare Show HN posts from an app's launch/hn.md (prefilled submit form, he clicks submit, first comment on the clipboard). Use for /hn, /hackernews, "show hn", "post on hacker news", "hn login", or "hn karma".
---

# /hackernews

## Account
- No HN user exists as nulljosh, nulljosh1, jaybulb or joshtrommel (checked 2026-11-24 via the public API). Ask Joshua his handle once; if he has none, he makes one at https://news.ycombinator.com/login (username + password, email optional; he types them). Record the handle (not the password) in `~/Documents/Josh/App Store/STATE.md`.
- Lost password: the reset only works if an email was set on the account (https://news.ycombinator.com/forgot).

## Read (headless, no login)
`curl -s https://hacker-news.firebaseio.com/v0/user/<handle>.json` → karma, created, submitted ids. `…/v0/item/<id>.json` → title, score, descendants (comments). Algolia search: `https://hn.algolia.com/api/v1/search?query=<app>&tags=story`.

## Post (Show HN)
- **New accounts can't post Show HN** (HN redirects to /showlim: "temporarily restricting Show HNs… get to know the community first"). Hit 2026-11-24 with Joshua's new account. Don't work around it with a plain link post. Build karma with real comments first, then retry. Check: if submit lands on /showlim, stop.
- Draft: `<app>/launch/hn.md`. The first line is the title (`Show HN: X – …`, ≤80 chars), the rest is the first comment.
- Background tab (see /reddit for the osascript line): `https://news.ycombinator.com/submitlink?u=<urlenc url>&t=<urlenc title>`. `pbcopy` the first-comment text. **Joshua clicks submit**, then pastes the comment on his own post.
- One Show HN per app, never reposted within weeks, and only for something people can try now (the web build, not just an App Store link). After posting, add `Post: <url> (date)` to hn.md and commit/push.
