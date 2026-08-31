---
name: duolingo
description: Drive duolingo.com in the logged-in Chrome session to complete lessons back to back across any course - Math, Chess, or a language - then move on to the next unit/course. Use when the user says /duolingo, "do my Duolingo", "finish my Duolingo lessons", "do my chess", "do my Spanish", or asks to keep a streak going.
---

# Duolingo autopilot

Drives the user's already-logged-in Chrome session. No API, no credentials.

## Read this first: cost and scope

Measured on Joshua's account, 2026-08-31, Math course. Chess and language
lessons are shorter (fewer questions, less computation per question), so
assume roughly **half** the per-lesson cost until measured:

- **~8 min and ~$5.30 USD-equivalent per lesson** — that was the old
  screenshot-per-question approach. The DOM-selector path below cuts it to
  ~4 screenshots a lesson; re-measure before quoting a number.
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

1. `tabs_context_mcp {createIfEmpty:true}`, then `navigate` to
   `https://www.duolingo.com/lesson` — this starts the next lesson directly, no
   tree-clicking needed.
2. Login wall → stop and ask the user to sign in. Never attempt to log in.
3. Inject `scripts/duo.js` once per tab with `javascript_tool`. Everything below
   goes through it. Re-inject after any `navigate`.

## Read the DOM, do not read pixels

**Verified working 2026-08-31 on the Math course.** The whole question is
readable as text and every control is clickable by selector, so a lesson costs
~4 screenshots instead of ~25. Do not go back to coordinates — they drift on
resize, and the tile bank reflows after every placement, which is what used to
eat the most time.

`__duo.read()` returns the current question. The selectors behind it:

| What | Selector |
|---|---|
| challenge wrapper + type | `[data-test^="challenge "]` → `challenge challenge-<type>` |
| prompt | `[data-test="challenge-header"]` |
| multiple-choice options | `[data-test="challenge-choice"]`, selected via `aria-checked` |
| match-the-pairs tiles | `[data-test$="challenge-tap-token"]` |
| text input | `[data-test="challenge-text-input"]` |
| CHECK / CONTINUE | `[data-test="player-next"]` (`.disabled` = answer incomplete) |
| right/wrong feedback | `[data-test^="blame"]` → `blame-correct` / `blame-incorrect` |
| quit | `[data-test="quit-button"]` |

Actions: `__duo.choose(...i)`, `__duo.pair(...i)`, `__duo.type(v)`,
`__duo.place(...vals)`, `__duo.key(label)`, `__duo.go()`.

### Two traps that will cost you a lesson if you miss them

**Math renders in a same-origin iframe.** Tile banks, sliders, number lines,
shapes and geometry all live in `document.querySelector('iframe').contentDocument`,
invisible to top-level selectors. `__duo.frame()` picks the right document.
Inside it: `.token-bank .token` (tiles), `.token-slot` (answer slots),
`.drop-target-*`, `.shape`, `.polygon`, `.number-line`, `.slider1d-*`,
`.slider2d-*`, `.fraction-*`, `.decimal-*`, `.box-plot_*`, `.angle-fill`.

**`innerText` garbles every equation.** `17 + 6 − 2 = ▢ − 2` reads back as
`17+6−2=−2`, silently dropping the blank — you will compute the wrong answer and
lose a heart. Read `annotation` elements instead: they carry the LaTeX source,
with the blank marked as `\duoblank{}`. `read().latex` does this. Never answer a
math question off `innerText`.

**`\duoblank{N}` contains a placeholder, not the answer.** `19 + 5 - 6 =
\duoblank{1} - 6` means `19 + 5 - 6 = ▢ - 6` (answer 24), not `= 1 - 6`. Strip
the braces' contents; treat it purely as a blank marker.

### Verified working (2026-08-31, Math)

Match-the-pairs, select-all, type-the-answer and number-line drag all solved
correctly with zero screenshots, reading `latex` for the question and clicking
by selector. `blame-correct` confirmed each one.

**Still unverified: tile-bank placement** (`__duo.place`). The bank reads fine
(`.token-bank .token`) but no run has yet confirmed a click drops a tile into a
`.token-slot`. Screenshot once the first time you hit one, and update this line.

### Drag targets come from the DOM too — do not screenshot to find them

Verified on a number-line question. The iframe's SVG carries labelled ticks, so
you can compute exact viewport pixels without ever looking at an image:

```js
const f = document.querySelector('iframe'), d = f.contentDocument;
const fr = f.getBoundingClientRect();
const R = e => { const r = e.getBoundingClientRect();
  return [fr.left + r.left + r.width/2, fr.top + r.top + r.height/2]; };
[...d.querySelectorAll('.number-line-label')].map(e => [e.textContent, R(e)]);
[...d.querySelectorAll('.slider1d-thumb')].map(R);
```

That returns e.g. `0→x794, 6→x854 … 36→x1154` and the thumb at `x794,y520`, so
the px-per-unit and the target x fall straight out. Then one `left_click_drag`.
`player-next.disabled` flipping to `false` confirms the drag registered — check
that instead of screenshotting the result. Same trick applies to the area
slider (`.slider1d-*`, `.slider2d-*`) and shape handles (`.draggable-points`).

### Still needs a screenshot

Only base-ten blocks, chess boards, select-the-image, and geometry figures
whose shape you must actually see. Everything else — multiple choice,
select-all, match, type-the-answer, tile bank, word bank, keypad, and now
sliders and number lines — is readable as text or DOM geometry.

### The calculator keypad

"Complete the equation" sometimes shows a keypad instead of a tile bank. Its
buttons are unlabelled by `data-test` but carry `aria-label` (`7`, `+`, `×`,
`Backspace`, `Clear`, …). Click by label via `__duo.key()`.

## Question types

- **Match the pairs** — `__duo.pair(l1,r1,l2,r2,l3,r3)`, then CONTINUE (no CHECK).
- **Select the answer / Select all that match** — click option(s), then CHECK.
- **Follow the pattern** — 3-row table, compute the third row.
- **Complete the equation** — tile bank fills slots **left to right, top-down**;
  you cannot choose a slot by clicking it first. To fix a misplaced tile, click
  the placed tile to return it, then re-place in order.
- **Multiply/Divide to fill in the blank** — factor tree. Two-level trees fill
  top-down too: the *root* takes the first tile, not the middle node.
- **Type the answer** — `__duo.type(v)` then `go()`. A plain `.value =` assignment
  is ignored by React; `__duo.type` uses the native setter.
- **Number line** — drag the handle. `x = x0 + (value/max)·(x1−x0)` where x0/x1
  are the pixel positions of the 0 and max labels. It snaps; a few px off is fine.
- **Speaking / listening** — click "Can't listen now" / "Can't speak now".
- **"Create a <shape> with area = N"** — a value slider under the figure. Arrow
  keys do **nothing**; you must `left_click_drag` the handle (the param is
  `start_coordinate`, not `startCoordinate`). Do not assume the slider's range:
  it varies per question (min 1, max 6/7/9 all seen in one lesson). Read the
  current value and handle x, drag once, screenshot, then correct by the
  px-per-unit you just measured. Two drags is normal and costs nothing — a
  wrong CHECK costs a heart.
- **"Create the shapes: two right triangles"** — a rectangle with a cut line and
  two round handles. Drag each handle to *opposite corners* so the cut is a true
  diagonal; the default vertical cut yields two rectangles, not triangles.

### The operator-tile quirk — solved by selectors

Historically `•`, `/`, `+`, `−` tiles needed two clicks and the tray reflowed
after every placement, staling any coordinates captured up front. Both problems
were coordinate problems. `__duo.place('14','+','6','-','4')` re-queries the
bank between placements and matches by value, so reflow is harmless. If a
placement reports `{fail: v, have: [...]}`, the bank genuinely lacks that tile —
recheck your arithmetic rather than re-clicking.

## Math notes (course: Math)

Geometry answers that recur in Grade 6 "Polygon area": triangle ½bh,
parallelogram bh (no ÷2 — the distractor is always the ÷2 version), trapezoid
((b₁+b₂)/2)·h. "Select the area of the whole rectangle" around a triangle wants
the *rectangle*'s bh, not the triangle's.

Duolingo Math draws quantities as base-ten blocks: a 10x10 flat = 100, a rod =
10, a cube = 1. Count them to read an answer tile's value. When two options are
ambiguous, identify the two you're sure of and take the third by elimination.

## Chess notes (course: Chess)

Chess lessons are a board, not a tile bank, so most of the layout table above
does not apply. Recalibrate every lesson: screenshot, find the board's corner
pixels, and derive the square size as `(x_h1 - x_a1) / 7`. Squares are square,
so the same size works vertically.

- **Make the move** — click the piece, then the destination square. Legal
  destinations are highlighted with dots after the first click; screenshot to
  confirm the highlight before the second click rather than trusting your
  coordinate math. A click on an illegal square deselects, costing nothing.
- **Puzzles are forced lines.** The answer is a check, a capture, or a piece
  that hangs after the move. Look for checks first, then captures. If nothing
  is forcing, you have misread the board — re-screenshot and re-read the
  pieces rather than guessing.
- **Read the board from the screenshot, not from memory.** Piece art is small;
  bishops and pawns are easy to confuse at low zoom. When unsure of a piece,
  zoom by resizing the window rather than assuming.
- **Multi-move puzzles** play the opponent's reply automatically. Wait for the
  animation (one screenshot) before the next move — clicking during it drops.
- **Lesson types**: "Play the move", multiple-choice ("Which piece is
  attacked?"), and short match-the-pairs exercises reusing the layout above.
- Board orientation flips when you play Black. Confirm which side is at the
  bottom before computing coordinates.

## Language notes (courses: Spanish, French, etc.)

Language lessons are mostly text and audio, and are the cheapest to automate.

- **Translate (word bank)** — tiles fill the answer slot left to right, same as
  the math tile bank, including the two-click focus quirk on small tiles. To
  remove a tile, click it in the answer row.
- **Translate (type the answer)** — click the input, `type`, CHECK. Type the
  accented characters directly (`á`, `ñ`, `ü`); the input accepts them and the
  on-screen accent buttons are not needed.
- **Listening ("Type what you hear")** — audio only, nothing to read. Click
  **"CAN'T LISTEN NOW"** and take the skip. Do not guess.
- **Speaking** — click "CAN'T SPEAK NOW". Same rule.
- **Select the image / select the missing word** — read the tiles, click, CHECK.
- **Story / conversation exercises** — CONTINUE-driven with occasional
  fill-in-the-blank. Mostly clicks on the same CONTINUE coordinate.
- Duolingo accepts several correct translations and will often mark a stiff but
  literal answer right. Prefer the literal one over a natural-sounding guess.
- A wrong answer costs a heart in every course, so the heart rule below applies
  unchanged.

## Course / unit navigation

- **Switching courses is unsolved on web — verified 2026-08-31, three failed
  attempts.** What is now known:
  - `/settings/courses` lists every enrolled course (this account: Math,
    Spanish, Chess, Indonesian, Swedish, Italian, Greek, German, Japanese,
    Hebrew, Korean, Chinese). Clicking a course row there does **not** switch
    the active course — `/learn` still loads the previous one. Do not click
    the red REMOVE link at the right of each row.
  - The top-bar course icon (the leftmost of the four icons, ~x=1027 at
    1568px) takes focus but opens no dropdown on click.
  - The `MORE` sidebar item is `ref_8` in the accessibility tree; the top-bar
    buttons are ref_9-ref_11 and none of them opened a course menu.
  **Most likely cause (user, 2026-08-31): another Duolingo tab was open and
  active.** Two tabs share one server-side session, so the other tab keeps
  resetting the active course. Check for other Duolingo tabs with
  `tabs_context_mcp` and ask the user to close them before switching courses.
  Next thing to try: the mobile app or a hard reload after the settings click,
  or watch the network tab for the course-switch request and whether the web
  client sends it at all. Until this is solved, only the currently active
  course can be automated, and on this account that is Math.
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
