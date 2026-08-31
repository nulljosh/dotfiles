---
name: duolingo
description: Drive duolingo.com in the logged-in Chrome session to complete lessons back to back, then move on to the next unit/course. Use when the user says /duolingo, "do my Duolingo", "finish my Duolingo lessons", or asks to keep a streak going.
---

# Duolingo autopilot

Drives the user's already-logged-in Chrome session. No API, no credentials.

## Read this first: cost and scope

Measured on Joshua's account, 2026-08-31, Math course:

- **~8 min and ~$5.30 USD-equivalent per lesson** (~25 tool calls, ~25 screenshots).
- A lesson is 15 questions. A unit is 5-6 lessons. A grade is 16-98 units.
- "Finish all of Math" = ~300 units ≈ 1,500 lessons ≈ **200 hours of wall clock**.

On a subscription the dollar figure is not a bill — the real ceilings are wall
clock and the 5-hour usage blocks. Still quote both to the user before a long
run, and never promise to finish a whole course in a session. Report the number
of lessons you can realistically do (10-15 per 5h block) and let them choose.

## The A/B trap — check this BEFORE grinding

**Web and the iOS app can serve completely different course versions.** On this
account:

| | Web | iOS app |
|---|---|---|
| Grade 3 | 13/13 | 18/18 |
| Grade 4 | 13/16 | **20/20 complete** |

Different totals *and* different unit names — web had "Order of operations,
Rounding, Angle measures"; the app had "Simplify fractions, Multiply fractions".
Web showed units incomplete that do not exist in the app's tree at all.

So: **units you complete on web may not register as progress in the app.** XP,
gems and the streak do carry. Before committing to a grade, ask the user to
check that grade in the app and confirm it's incomplete there too. If a user
says "Duolingo lost my progress", this is almost certainly the cause — not data
loss, and not something a browser agent can fix.

## Setup

1. `tabs_context_mcp {createIfEmpty:true}`, then `navigate` to `https://www.duolingo.com/learn`.
2. Login wall → stop and ask the user to sign in. Never attempt to log in.
3. Load `browser_batch` up front. One question per batch (clicks + CHECK +
   CONTINUE + screenshot). Without it this costs ~3x the round-trips.

## Layout — recalibrate when the window resizes

The viewport changes size mid-session and every coordinate moves. If a batch of
clicks does nothing, screenshot and re-read the layout before retrying.

Two layouts seen so far:

| | narrow (931px) | wide (1568px) |
|---|---|---|
| CHECK / CONTINUE | (799, 838) | (1101, 704) |
| match: left col | x=300 | x=645 |
| match: right col | x=615 | x=910 |
| match: rows | y=258/450/642 | y=217/379/541 |
| 2-option: left/right | (305/609, 549) | (649/904, 461) |
| 3-option list | y=495/566/638 | y=415/475/536 |

## Question types

- **Match the pairs** — click left item then its right partner, six clicks, then
  CONTINUE (no CHECK).
- **Select the answer / Select all that match** — click option(s), then CHECK.
- **Follow the pattern** — 3-row table, compute the third row.
- **Complete the equation** — tile bank fills slots **left to right, top-down**;
  you cannot choose a slot by clicking it first. To fix a misplaced tile, click
  the placed tile to return it, then re-place in order.
- **Multiply/Divide to fill in the blank** — factor tree. Two-level trees fill
  top-down too: the *root* takes the first tile, not the middle node.
- **Type the answer** — click input, `type`, CHECK.
- **Number line** — drag the handle. `x = x0 + (value/max)·(x1−x0)` where x0/x1
  are the pixel positions of the 0 and max labels. It snaps; a few px off is fine.
- **Speaking / listening** — click "Can't listen now" / "Can't speak now".

### The operator-tile quirk (costs the most time)

`•`, `/`, `+`, `−` tiles frequently need **two clicks** — the first only focuses
them. Worse, after each placement the tray **reflows**, so coordinates captured
before the batch go stale and later clicks land on empty space. Place operators
one at a time with a screenshot after each, or accept re-clicks. Number tiles
place on the first click and do not have this problem.

## Math notes

Duolingo Math draws quantities as base-ten blocks: a 10x10 flat = 100, a rod =
10, a cube = 1. Count them to read an answer tile's value. When two options are
ambiguous, identify the two you're sure of and take the third by elimination.

## Course / unit navigation

- The section banner's back arrow opens `/sections` — the full grade list with
  per-unit ✓ / `>` status. This is the fastest way to find what's actually
  incomplete. Scroll up inside it for the grade headers and X/Y totals.
- After finishing a unit, "UP NEXT … CONTINUE" scrolls to the next unit but can
  land on a greyed tree. Reload `/learn` to snap back to the live node.
- Unit-end trophy node is a **Review** lesson (+40 XP). Chests give ~5 gems and
  need a click on the "OPEN" label, not the chest art.
- End-of-lesson is 3-4 CONTINUE clicks (Lesson Complete → streak/chest → Daily
  Quests → tree).

## Rules

- Never trigger `alert`/`confirm`; never click Delete/Reset/Unsubscribe.
- Never enter payment details, buy hearts, or accept a trial.
- Out of hearts → stop and tell the user.
- 2-3 failed calls on the same element → screenshot, re-read the layout, and if
  it still fails, stop and ask. Do not grind.
- Automated play is against Duolingo's ToS and the XP ranks the user against
  real people in their league. Say so once, then respect their decision.
