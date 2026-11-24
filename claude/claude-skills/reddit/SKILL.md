---
name: reddit
description: Joshua's Reddit — help him sign in (find the account, reset or social sign-in, never type passwords), read his account (karma, age, posts, comments, which subs allow promo), and post launch drafts (prefilled submit forms, he clicks Post). Use for /reddit, "post on reddit", "reddit login", "my karma", "which subreddits", or posting an app's launch/reddit/*.md drafts.
---

# /reddit

Joshua uses Safari. Work headless where you can. When a page is needed, open it as a **background tab** (`osascript -e 'tell application "Safari" to tell front window to make new tab at end of tabs with properties {URL:"…"}'`), read it by explicit tab id (`mcp__safari__tabs_list` then `get_page_text`/`javascript` with `tab`), and close your tabs when done.

## Sign in (help, never type)
- Likely username: **u/nulljosh** (found in repos; unconfirmed). curl to reddit.com gets 403, so confirm in a Safari tab.
- Order: (1) iPhone/Mac Passwords app, search "reddit"; on Dad's Mac (Ventura) `open "x-apple.systempreferences:com.apple.Passwords-Settings.extension"`. (2) "Continue with Google/Apple" on reddit.com/login if the account was made that way. (3) Reset: open https://www.reddit.com/password in a background tab; Joshua enters the username/email and the link goes to his inbox.
- Once signed in, old.reddit.com shares the session.
- Record the confirmed username, and whether login is Google, Apple or password (never the password), in `~/Documents/Josh/App Store/STATE.md`.

## Read (once signed in)
In a background tab: `fetch('/user/<name>/about.json').then(r=>r.json())` → karma and account age. `/user/<name>/submitted.json` → posts with score and comments. For each launch draft, check the sub's rules at `/r/<sub>/about/rules.json` and the pinned self-promo thread.

## Post
- Drafts: `<app>/launch/reddit/<sub>.md` (`Title:` line, then `Body:`). Rules and sub choice: the launch skill's `reddit.md`.
- Prefill: `https://old.reddit.com/r/<sub>/submit?selftext=true&title=<urlenc>&text=<urlenc>` as a background tab. **Joshua clicks Post.** Flair-required subs (r/iOSProgramming "Show and Tell") need him to pick the flair.
- At most 3 subs per run, never the same body twice, one app per day. After posting, write `Post: <url> (YYYY-MM-DD)` at the top of that draft and commit/push the app repo.
