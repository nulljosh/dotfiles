---
name: distribution
description: Where every app is live and what's stuck — per app and platform (iPhone, iPad, Mac), version state (live, in review, rejected, waiting), latest build and TestFlight, price, and territory coverage, then the next move to get each app in front of more people. Routes the actual build/submit/rejection work to /apple-release. Use for /distribution, "what's live", "which apps are in review", "rejections", "is X on the store", "territories", "ship status", or "get the apps out".
---

# /distribution

One board: every app, every platform, what state it's in, and the one next step.

## 1. Sign in
Follow `~/.claude/skills/sales/asc-signin.md`. Everything here works with an API key; rejection text and some availability steps need a web session.

## 2. Build the board
App IDs come from GTM.md (path in asc-signin.md) or `asc apps list --paginate --output json`. For each app:
- `asc status --app APP_ID --output json` (per platform: add `--platform MAC_OS`): live version, version in flight and its state, latest build, TestFlight.
- `asc pricing current --app APP_ID` and `asc pricing availability territory-availabilities --app APP_ID --paginate`: price and how many of the 175 territories it's in.
- Rejected? `asc web review list --app APP_ID` then `show` for the guideline and Apple's text.
Write the board to `~/Documents/Josh/App Store/distribution.md` (app · platform · live version · in flight · state · territories · next step). Don't re-fetch apps whose state is final and unchanged since the last board unless asked.

## 3. Report (terse)
One line: **N live, N in review, N rejected, N stuck**, then the single most important next step. Full board only if asked.

## 4. Next steps to suggest (pick the top 3)
- **Rejected** → hand to `/apple-release` mode `rejection-handler`. Past waves: 4.3(a) spam and 5.6 came from bulk submissions.
- **Built, not submitted** → `/apple-release` `asc-release-flow`. **One store submission a week at most**; pick the app with the best sales or conversion (`/sales`).
- **Few territories** → `asc pricing availability create --app APP_ID --all-territories --available true --available-in-new-territories true` (Joshua's yes first).
- **iPhone-only** → offer "iPhone and iPad apps on Apple silicon Macs" and iPad layout; Mac-only → consider the iOS record.
- **Live but unseen** → `/launch` (Product Hunt, HN, Reddit) and the landing's store button.

## Rules
- Never submit, release, cancel, remove from sale, or change availability without Joshua's yes in chat.
- Dad's Mac has Xcode 15.2 and can't upload builds; uploads happen on Joshua's Mac. Say so instead of trying.
- Keep personal details out of this repo (it's public).
