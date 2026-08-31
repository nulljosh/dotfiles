---
name: duolingo
description: Drive duolingo.com in the logged-in Chrome session to complete lessons back to back, then move on to the next unit/course. Use when the user says /duolingo, "do my Duolingo", "finish my Duolingo lessons", or asks to keep a streak going.
---

# Duolingo autopilot

Uses the user's already-logged-in Chrome session. No API, no credentials.

## Setup

1. `tabs_context_mcp {createIfEmpty:true}`, then `navigate` to `https://www.duolingo.com/learn`.
2. Login wall → stop, tell the user to sign in. Never attempt to log in.
3. Load `browser_batch` up front. One question = one batch (clicks + check + continue +
   screenshot). Without it this burns ~3x the round-trips.

## Lesson loop

1. Click the highlighted skill bubble on `/learn`, then **START +N XP** in the popover.
2. Screenshot → answer → `CHECK` → `CONTINUE`. Buttons sit bottom-right at ~(799, 838).
3. End screens (Lesson Complete → streak/chest → Daily Quests) are 3-4 more CONTINUE clicks
   back to `/learn`.
4. Out of hearts → stop and tell the user. Never buy hearts or watch ads.
5. Dismiss Super/Plus offers and notification prompts with X / "No thanks".

## Question types

- **Match the pairs** — click left item, then its right partner. Six clicks, then CONTINUE
  (no CHECK). Grid is left col x=300, right col x=615; rows y=258/450/642.
- **Select the answer / select all** — click option(s), then CHECK.
- **Complete the equation** — tile bank below three or five slots. Click tiles left to right.
  The operator (`•`) tiles often need a **second click** — the first only focuses them.
  Verify with a screenshot before CHECK. `/` tiles are usually distractors.
- **Type the answer** — click the input, `type`, CHECK.
- **Number line** — drag the handle. Compute x: `x0 + (value/max) * (x1 - x0)`, where x0/x1
  are the pixel positions of the 0 and max labels. It snaps, so being a few px off is fine.
- **Speaking / listening** — click "Can't listen now" / "Can't speak now" to skip.

## Math note

Duolingo Math renders quantities as base-ten blocks: a 10x10 flat = 100, a rod = 10, a
single cube = 1. Count them to read the value off an answer tile.

## Course loop

Section complete → **Jump to next section**. Otherwise open the course picker (flag, top
bar) and pick the next course with unfinished progress.

## Cost

One lesson is ~15 questions, ~25 screenshots, roughly 45k tokens. Budget before starting a
long run, and report progress every few lessons. "Finish every course" is hundreds of
lessons — quote the real number to the user rather than starting an open-ended loop.

## Rules

- Never trigger `alert`/`confirm`; never click Delete/Reset/Unsubscribe.
- Never enter payment details or accept a trial.
- 2-3 failed calls on the same element → stop and ask, don't grind.
