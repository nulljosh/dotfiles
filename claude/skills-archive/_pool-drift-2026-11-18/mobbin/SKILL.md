---
name: mobbin
description: Compare an app against the best similar apps from their real screens, list the gaps, and loop until the UI is A+. Works without a Mobbin login by pulling App Store screenshots through Apple's public API. Use for /mobbin, "scan mobbin", "compare with similar apps", "what are competitors doing", or a UI gap pass.
---

# /mobbin

Look at what the best apps in the category actually ship, then close the gaps one release at a time until nothing on the
list is left and every screen holds up next to theirs.

## 1. Gather the screens (no login)
Mobbin needs an account and Joshua's login is his step, so do not try it. App Store screenshots are public and show
each app's best screens:

```sh
python3 ~/.Codex/skills/mobbin/fetch.py <scratchpad>/comp "App One" "App Two" ...
```

Pick 8 to 12 apps: the direct rivals, the category leader, and one or two indie favourites known for design (for a news
reader: Ground News, Particle, SmartNews, Yahoo News, Flipboard, Feedly, Inoreader, Reeder, NetNewsWire, Unread; for
podcasts: Pocket Casts, Overcast). If Joshua is logged in to Mobbin in Chrome, its flows are a bonus, not a requirement.

## 2. Read every sheet
Open each `sheet-*.jpg` with Read. Note per app what a screen does that ours does not: features, layout, controls,
density, empty states, onboarding, settings. Skip what needs data we cannot have, ads, social networks and paywalls.

## 3. Write the gap matrix
Add a section to the repo's `roadmap.md`: one row per gap with the apps that have it, the size (S, M, L), and status.
Order: what users touch every day first, polish before novelty, on-device over cloud. Each row is one minor version.

## 4. Loop until A+
`/loop` over the matrix. Each tick: build one row on every platform the app ships (apps and web together), QA it with
screenshots in light and dark, put our screen beside the competitor's sheet and fix whatever looks worse (spacing,
type, hierarchy, controls), then bump the minor version, commit, tag, push and deploy. When the matrix is empty, run the
`apple` skill's checks over every screen; the next major ships when both are clean.

## Rules
- Our own design system wins over copying: borrow the idea, never the brand, colours or wording.
- No sound from QA (simulator audio plays on the Mac), no account creation, never type Joshua's passwords.
- Report progress in one line per release as you go.
