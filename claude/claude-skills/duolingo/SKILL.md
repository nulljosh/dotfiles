---
name: duolingo
description: Drive duolingo.com in the logged-in Chrome session to complete lessons back to back across any course - Math, Chess, or a language - then move on to the next unit/course. Use when the user says /duolingo, "do my Duolingo", "finish my Duolingo lessons", "do my chess", "do my Spanish", or asks to keep a streak going.
---

# Duolingo autopilot

Drives the user's already-logged-in Chrome session. No API, no credentials.

## The loop

0. `duo.py <username>` — if `today: done` and the user only wanted the
   streak, stop here. Zero browser, zero tokens.
1. `tabs_context_mcp` (close other Duolingo tabs), `navigate` to `/lesson`.
2. Inject `scripts/duo.js`. Re-inject after every `navigate`.
3. `await __duo.run(15)` — one call does the whole lesson. It returns
   `{trail, halted}`.
4. `halted` is how it hands back:
   - `manual` → the question needs real mouse input. Solve it with `computer`
     at **CSS coordinates** (see below), then `run()` again.
   - `wrong` / `no hearts` / `choice match failed` → read the payload, fix,
     resume. Never guess: a handback is free, a wrong CHECK is a heart.
5. End of lesson is 3-4 CONTINUE clicks (`__duo.go()`), then `/lesson` again.
6. `duo.py <username>` to confirm the XP landed.

Everything below is why each of those steps looks the way it does.

## What is verified, and what is not

| Technique | Status | Evidence |
|---|---|---|
| Grader extraction (`__duo.answer()`) | **VERIFIED** 2026-08-31 | returns the answer verbatim, Math |
| Multiple choice / select-all by text match | **VERIFIED** 2026-08-31 | `blame-correct` |
| Type-the-answer via native setter | **VERIFIED** 2026-08-31 | `blame-correct` |
| Match-the-pairs | **VERIFIED** 2026-08-31 | `blame-correct` |
| Tile bank via real `computer` clicks, CSS coords | **VERIFIED** 2026-08-31 | `16 = 19 - 5 + 2` |
| Number-line via `left_click_drag`, CSS coords | **VERIFIED** 2026-08-31 | `12 - 4 + 5` |
| `__duo.place()` (synthetic `.click()`) | **DEAD** | reports `fail:null`, CHECK enables, slots stay empty |
| Synthetic `PointerEvent` on sliders | **DEAD** | widget ignores them; arrow keys too |
| `__duo.solve()` / `run()` | **UNVERIFIED** — written 2026-08-31, never run live | exercise on one lesson before trusting a long run |
| Chess / language graders | **UNVERIFIED** | never probed |
| Course switching on web | **UNSOLVED** | three failed attempts, see Navigation |

Anything marked DEAD stays dead — do not re-litigate it mid-lesson.

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
   The tool's params are `action:"javascript_exec"`, `tabId`, and **`text`**
   (not `code`). It has REPL semantics — top-level `await` works and the last
   expression is returned, so end with `JSON.stringify(...)`.

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

Number-line drag re-verified 2026-08-31 via CSS coordinates (see the CSS-pixel
section above) — `12 - 4 + 5` solved with one drag and zero screenshots.

**RESOLVED 2026-08-31: `__duo.place` does NOT work — synthetic `.click()` is
ignored by the tile bank.** It reports `fail:null` and CHECK even goes enabled,
but the slots stay empty and CHECK is still greyed in the DOM. Same root cause
as the slider: this widget only responds to real input events.

Place tiles with real `computer` clicks at **CSS coordinates**, one tile at a
time, re-reading the bank between every click because it reflows:

```js
const f=document.querySelector('iframe'), d=f.contentDocument, fr=f.getBoundingClientRect();
const V=e=>{const r=e.getBoundingClientRect();
  return [Math.round(fr.left+r.left+r.width/2), Math.round(fr.top+r.top+r.height/2)];};
[...d.querySelectorAll('.token-bank .token')].map(e=>[e.textContent.trim(), V(e)]);
```

Click the tile you want, re-read, click the next. A placed tile disappears from
`.token-bank .token`, so the shrinking list is your confirmation that the click
landed — no screenshot needed after the first one. Verified on
`16 = 19 - 5 + 2` (5 tiles, one click each, `blame-correct`).

Note `.token-slot` returns the *bank*, not the answer row, so it cannot be used
to verify placement. Use the shrinking bank instead.

### CRITICAL: the computer tool takes CSS pixels, screenshots are scaled

**Verified 2026-08-31 after three failed drags.** `computer` click/drag
coordinates are **CSS pixels** (`getBoundingClientRect()` space), *not*
screenshot pixels. At 931px wide the screenshot came back 932x907 while
`innerHeight` was only 382 — a ~1.42x vertical scale. Coordinates read off a
screenshot are therefore wrong by hundreds of pixels vertically, and every
drag silently misses: the thumb snaps back and CHECK stays dead.

Never read a coordinate off a screenshot. Always compute it:

```js
const f=document.querySelector('iframe'), d=f.contentDocument, fr=f.getBoundingClientRect();
const V=e=>{const r=e.getBoundingClientRect();
  return [Math.round(fr.left+r.left+r.width/2), Math.round(fr.top+r.top+r.height/2)];};
V(d.querySelector('.slider1d-thumb'));               // -> [278, 297]
[...d.querySelectorAll('.number-line-label')].map(V); // -> 0:[278,230] 13:[338,230]
```

Then `left_click_drag` from the thumb's CSS point to the target's CSS x at the
thumb's CSS y. One drag, lands exactly, `blame-correct`.

**ALWAYS verify the landing before CHECK — the user resizes the window mid-run.**
Coordinates read even a few seconds earlier can be stale: a resize reflows the
whole number line, the drag lands on the wrong tick, and CHECK burns a heart on
arithmetic that was actually correct (observed 2026-08-31: answer 20, dragged to
a stale x, marked wrong). After every drag, re-read and compare, and only then
submit:

```js
const d=document.querySelector('iframe').contentDocument;
const gx=e=>{const r=e.getBoundingClientRect();return Math.round(r.left+r.width/2);};
const want=[...d.querySelectorAll('.number-line-label')].find(e=>e.textContent.trim()===String(ANS));
Math.abs(gx(d.querySelector('.slider1d-thumb')) - gx(want)) <= 3   // must be true
```

If it is false, re-read the CSS coordinates fresh and drag again. Re-dragging is
free; a wrong CHECK is not. Synthetic
PointerEvents on the thumb do **not** work (the widget ignores them), and
arrow keys do **not** work. The real drag at real CSS coordinates is the only
method that moves these sliders.

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

## The grader ships to the client and will tell you the answer

**Verified 2026-08-31, Math.** Duolingo grades math challenges client-side, and
the grading function arrives as JavaScript source on the challenge object. Call
it with no user selection and its feedback string contains the correct answer.

```js
// challenge object hangs off the React fiber of the challenge node
const el = document.querySelector('[data-test^="challenge "]');
let f = el[Object.keys(el).find(k => k.startsWith('__reactFiber$'))], d = 0, blob;
while (f && d++ < 10) { if (f.memoizedProps?.challenge) { blob = f.memoizedProps.challenge.challengeBlob; break; } f = f.return; }

const grade = new Function('return (' + blob.grading_function + ')')();
grade(blob);   // → [false, {value: "\\text{Correct Answer: }\\mathbf{22}"}]
```

`blob` also holds the ordered button list (under a per-question key — the names
are randomised, e.g. `pants`, `shirt`; find the array whose items are
`{type:'button'}`), the prompt, and the layout. `__duo.answer()` wraps the call
and pulls the value out of `\mathbf{...}`; multi-answer questions come back
comma-separated.

This removes arithmetic from the job entirely: no solving, no LaTeX parsing, no
mis-read blanks, and it extends to any challenge type the grader covers rather
than just the ones you can compute.

### Three traps, all of which cost a heart when I hit them

1. **Display order is shuffled — never map blob index to DOM index.** Observed:
   blob `[13+6-5, 18+2-6, 15+3-4, 15+300-4]` rendered as
   `[13+6-5, 15+300-4, 15+3-4, 18+2-6]`. Clicking blob indices selects the
   distractor. Match by normalised **text**, then click that DOM node.
2. **`innerText` is doubled.** A choice reads `13+6−513+6−5`. If the string is
   an exact repetition of its own first half, take the half.
3. **The minus is U+2212 (`−`), not ASCII `-`.** The grader emits ASCII. Any
   text comparison must normalise both.

`__duo.norm()` handles 2 and 3; use it on both sides of every comparison.

### Sliders without the computer tool: there is no such thing

Synthetic `PointerEvent`s on `.slider1d-thumb` were tried and abandoned. One
run appeared to enable CHECK, but the call timed out before the landed value
could be read back, so it never confirmed anything — and arrow keys do nothing
at all. Use `left_click_drag` at CSS coordinates. It is one call and it works.

### One honest note before using this

Reading the answer out of the grader is no longer "automating the lessons" — it
is answer extraction, which is the same thing as the XP-faking API endpoint this
skill declines to use, just via a different door. Nothing is being learned and
the XP still ranks the user against real people in their league. Say that once,
then respect the answer.

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

### The operator-tile quirk

`•`, `/`, `+`, `−` tiles historically needed two clicks and the tray reflows
after every placement, staling any coordinates captured up front. Both were
coordinate problems, and the fix is the real-click recipe above: re-read the
bank between every click and let the shrinking list confirm the landing.
`__duo.place()` is DEAD — it looks like it works and does not.

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

- **Switching courses: SOLVED via the API — 2026-09-01.** The UI is a dead end
  (`/settings/courses` rows and the top-bar icon do nothing), but one PATCH works:

  ```js
  const uid = JSON.parse(atob(document.cookie.split('; ')
    .find(c=>c.startsWith('jwt_token=')).split('=')[1].split('.')[1])).sub;
  await fetch(`/2017-06-30/users/${uid}?fields=currentCourseId`, {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({currentCourseId:'DUOLINGO_ES_EN'})});
  ```
  Then reload `/learn`. Course IDs come from
  `GET /2017-06-30/users/${uid}?fields=courses,currentCourseId` — `DUOLINGO_<LANG>_EN`
  for languages, `MATH_BT` for Math, `CHESS_CH` for Chess. Guessed IDs return
  `400 {"details":"invalid course"}`, so always read the list first.
  For a course not yet enrolled, navigate to `/enroll/<lang>/<from>` (the href on
  the course card at `/courses`, e.g. `/enroll/chess/ch`) — it enrolls AND switches
  in one navigation.
- **Only one course can be active at a time, and it is server-side state.**
  `currentCourseId` lives on the user record, so a second tab does not get its own
  course — switching in one tab switches both. **There is no per-tab or per-session
  course.** Never try to run two courses in parallel; run them sequentially,
  switching with the PATCH above between them.
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

### The reflection line drawn on a graph IS in the DOM (2026-08-31)

"Select the distance between the point and the line" shows the line only as a
drawing, with nothing in the LaTeX. It is a **`.bedrock` element**, shaped
tall-and-narrow for a vertical line, wide-and-short for a horizontal one.
Filter out `grid-line` / `axis` / `label` / `arrow--` / `numberline-arrow`
first or the grid drowns it. Convert its centre to a grid coordinate with the
same axis-label scaling `pts()` uses — see `__duo.drawnLine()`, chained into
`axisLine()` as a fallback. This removes the last screenshot-per-question type.

Dead ends already tried, do not repeat: `.math-diagram__arrow--reference-line`
and `.math-diagram__numberline-arrow__image` are zero-size, and the raw SVG
`line`/`path` attributes are marker definitions only.

### "Reflect the point" still needs a real drag

Synthetic `pointerdown/pointermove/pointerup` on `.draggable-point__dot-path`
does nothing — verified again 2026-08-31, the handle does not move. These
questions require `computer` `left_click_drag` at CSS coordinates, so they
cannot run unattended if drag permission is declined. Everything else in the
loop is synthetic-event driven and needs no approval.

### Reflections across y = x and y = -x (2026-08-31)

`y=x` swaps coordinates, `y=-x` swaps and negates both. The old solver only
knew `y=k` / `x=k` and got two wrong before this was caught. `reflectPt()`
covers all four.

**Axis scaling was silently broken.** Duolingo renders positive and negative
axis labels in *different* rows and columns (negatives at one y, positives at
another). Clustering labels by "shared coordinate" therefore split them and
produced a garbage y-mapping. `scale()` now clusters by spread and fits from
the min and max label instead.

### The 2D slider is the point control

Some reflect questions expose no draggable point. Instead a `role="slider"`
thumb (`.slider2d-thumb`, `aria-valuenow` / `valuemin` / `valuemax`) sits below
the graph and is the ONLY focusable element. **Value 0 is the original point,
and each notch moves it one unit perpendicular to the mirror line**, so the
answer's notch is just the distance between the point and its reflection —
which is always `valuemax`. `notch()` computes it; `plan()` returns either a
`point` drag or a `slider` drag so callers need one code path.

Keyboard does NOT work on it: `.focus()` succeeds and `document.activeElement`
becomes the thumb, but real arrow keys go to the top document and synthetic
`KeyboardEvent`s are ignored. Only a real `left_click_drag` along the track
moves it.

### Three more answer sources, all cheaper than a screenshot

- `\duodisplay{A}{B}` — **A is the correct answer, B is the current state.**
  Solving is just dragging until they match.
- "Select the line of reflection" — the ghost shape IS the reflected copy.
  Compare the two centroids and name the transform (`solveLineOfReflection`).
- `\phantom{}` fill-in-the-blank — already known to hold the answer, but the
  choice text is **doubled**, so compare with `norm(ascii(x))` on BOTH sides or
  it silently misses.

### Loop gate

The stock `run()`/`auto()` rejects `mathChallengeBlob` before any solver sees
it, so these all came back as `manual:choice`. `run2()` inverts it: try every
solver, and stop only when `plan()` says a real drag is genuinely needed.

### Rotations (unit 126) — 2026-08-31

The same slider widget means two different things. Check `aria-valuemax`:

- **max is small (5, 6, 7)** — notches along the path to a reflection; the answer
  is the distance between point and image, i.e. always `valuemax`.
- **max is 360** — it is an ANGLE in degrees. The value is simply the angle in
  the prompt (negated to `360-a` for plain "clockwise"), or, when a
  `\duodisplay` is present, `atan2(want) - atan2(current)` normalised to 0-360.

`target()` returns where a point must end up for either a reflection or a
rotation, so `plan()` handles both with one code path.

**Ghost is the PRE-image, solid is the image.** Getting this backwards silently
produces a plausible wrong answer — it only showed up on a centre-of-rotation
question, because reflections and 180° rotations are symmetric enough to work
either way. `solveCenterChoice` now tries both orders.

**Centre of rotation: test the candidates, don't invert the matrix.** For each
offered centre c, check `rotate(source - c) + c == image`. One line, any angle.

### Solver dispatch: gate every solver on its own prompt

With several reflection/rotation solvers loaded, an eager one answers a question
that belongs to another and gets it wrong (this cost a heart on a
"select the point rotated" question that `solveCenterChoice` grabbed first).
`__duo.RULES` pairs each solver with the prompt regex that owns it, and
`solveChoices()` walks it **looking solvers up by name** — capture them in a
closure and later fixes silently never take effect.

### Three more traps

- `\duoblank{X}` holds the answer, exactly like `\phantom{X}`.
- `\,` is a thin space: strip it BEFORE removing backslashes, or `(6,\,0)`
  becomes `(6,,0)` and every coordinate regex misses. Same for `\text{}` —
  put `textbf` before `text` in the alternation.
- **Latex includes the CHOICE labels**, so a coordinate appearing among the
  choices is never the question's source point. Fall back to the highlighted
  point on the diagram.

### Keep the injected solver in localStorage, not sessionStorage

And cache the **source text**, never `String(fn)` of the live functions —
re-stringifying methods produced `functionfunction(){...}` and corrupted the
cache, costing a full re-injection. Direct URL navigation
(`/lesson/unit/<N>/level/<M>`) works and is far cheaper than clicking the tree,
but it is a full page load, so the solver must be re-injected from storage.

### CORRECTION: `\duodisplay{A}{B}` — A is NOT the answer

Earlier notes in this file claimed A is the correct answer. **It is not.** On a
"Rotate the point 90° clockwise" question with `(1,2)`, the prompt's own maths
gives `(2,-1)`, while `\duodisplay` showed `(-1,-2)` (a 180° turn). Submitting
the duodisplay value was marked **incorrect**; the prompt's value was correct.

It read as reliable at first only because reflections and 180° rotations are
symmetric enough that A coincided with the right answer. Treat **B as the
current widget state** — that part holds, and it is what makes
"drag until it matches" verifiable — and always compute the answer from the
prompt.

### The angle slider counts CLOCKWISE degrees

Verified by dragging to 270 and reading the point back: it landed on the 90°
**counter**clockwise image. So the slider value is `a` for a clockwise prompt
and `360-a` for a counterclockwise one — the opposite of the maths convention
used in `target()`, which stays CCW-positive. Two different conventions in the
same question; keep `sliderDeg()` and `target()` separate.

**Read the widget back before every CHECK.** Both of the above were caught that
way, and it is the only reason the second one cost nothing.

### CORRECTION 2: the angle slider is the rotation MAGNITUDE

The note above ("slider counts clockwise degrees, use 360-a for CCW") is wrong —
it came from one reading taken mid-animation. Submitting 270 on a
"90° counterclockwise" question was marked **incorrect**, while 90 on a
"90° clockwise" one was correct, and 90 on the CCW retry was correct.

**The widget already turns in the direction the prompt states; the slider is
just how far.** So `sliderDeg()` is the bare number in the prompt, no direction
maths at all.

The lesson worth keeping: don't generalise a widget's convention from one
observation. Verify against the resulting POINT — `after()` now checks
`pts()` against `target()` rather than trusting the slider's own number,
because the point is ground truth and the slider's meaning was twice not what
it looked like.

### Text inputs need the same solver chain as choices

`run2` sent every `input` question straight to the grader, skipping
`\duoblank` / `\phantom` entirely. `typeAnswer()` tries those first, then falls
back to the grader.

### Guided lessons: gate on the CHOICES, not the prompt text

Multi-step "Use alternate exterior angles" lessons keep every step's LaTeX in
the annotation list, so `tex()` still contains *"Select the equation…"* long
after that step is answered. A solver gated on a prompt regex therefore fires
on a later question and answers it with nonsense — this produced **five wrong
answers in a row** before I caught it.

Gate on the shape of what is on screen instead: the equation solver requires
every choice to contain `=`; the relationship-name solver requires every choice
to end in "angles". That always describes the question actually being asked.

`run2()` now also **halts after 2 wrong in a row**. A mis-gated solver is
confident and fast, and without the guard it will spend a whole lesson.

### Angle diagrams are fully readable

The angle labels AND the given degree value are `<text>` in the iframe — an
over-tight filter (letters only) hid them. Group by y into the two
intersections, assign quadrants 0=UL 1=UR 2=LR 3=LL, then everything follows
from parity: quadrants differing by an EVEN number are equal, ODD are
supplementary. That single rule covers corresponding, vertical, alternate,
co-interior and "measure of angle X". No degree label at all means right-angle
markers, so every angle is 90.

Note `ascii()` maps the math-italic CAPITAL block to lowercase, so uppercase
before matching a label. And `\degree` vs `°` must both be stripped.

### Transversal problems: one rule, and read the line's real endpoints

Two marked angles on a transversal reduce to `s = (above XOR right)`:
**equal s means congruent, different s means supplementary.** That single
expression covers vertical, corresponding, both alternates and co-interior —
no need to classify the relationship by name at all.

But `above`/`right` must be computed in the SVG's own coordinate space. A
bounding box cannot distinguish a `\` transversal from a `/` one, and guessing
the lean silently flipped `right`, which cost two answers. The `<line>` element
carries real `x1,y1,x2,y2` and the `<svg>` a `viewBox` — convert the label
centres into that space and interpolate the transversal's x at the label's y.

One label and no number on the diagram means right-angle markers, so the angle
is 90.

### Direct URL navigation works — but the tree gates on chests

`/lesson/unit/<N>/level/<M>` loads any lesson directly and it completes
normally (XP, quests, "Lesson Complete"), which is far cheaper than clicking
the tree. But the visible tree does NOT advance past an unopened chest node, so
after a URL-driven run the map can still show an earlier unit. Clicking the
chest did not open it (gems unchanged) — treat chests as a known gap.

### Guided lessons: the traps that actually cost answers

- **They stack iframes.** Every step's iframe stays in the DOM (8 by the end)
  and the last one is EMPTY. `querySelector('iframe')` returns a stale table,
  so every lookup silently answers a previous question. Use the lowest iframe
  that still has content (`frameEl()`).
- **`latex[0]` is the LESSON TITLE**, not the question. The live step is the
  last `\text{}` instruction — and `read().latex` also contains the CHOICES'
  annotations, so `prompt()` must exclude anything inside a
  `challenge-choice`, or it returns an answer option as the question.
- **`tex()` concatenates the choices**, so `x = 4` followed by choices 2,1,0
  parses as `x = 4210`, and `y = 8x - 4` becomes `-4524804`. Parse the prompt
  line alone, or scan latex entries one at a time.

### Two-way tables

Some are a real `<table>`, others are positioned text. For the latter, cluster
cells by coordinate into a grid so EMPTY cells survive — a ragged row-by-row
parse shifts every value left and quietly corrupts the lookup. If the table
already has a Total row, READ it rather than summing (double-counting it gave
33 where the answer was 19). Header "9th" vs prompt "Grade 9" needs a
digit-based fallback match.

Relative frequency: **joint = cell/grand, marginal = margin/grand (also over
the grand total), conditional = cell/margin.** Treating "not joint" as "not
over the grand total" cost two answers. Choices arrive simplified (40/64 shown
as 5/8) and may be fractions, decimals or percentages — compare by VALUE.

### Timed match-the-pairs

Pairs **auto-advance** when all are matched: there is no CHECK and no blame, so
the normal loop bails with "noblame". They are also genuinely timed — the
default ~350ms sleeps solved 20 pairs and still ran out. `runPairs()` uses
90/130ms taps and took the level from 0 to 3 stars.

## Loading the solver (2026-09-01)

`scripts/duo.js` is now **self-contained and authoritative** — it is the whole solver
(~7,100 lines), not a mirror of something living in the browser. Load it into the page
in one call:

```bash
cd ~/.claude/skills/duolingo/scripts && (nohup python3 serve.py 8777 >/dev/null 2>&1 &)
```

```js
const src = await (await fetch('http://127.0.0.1:8777/duo.js', {cache:'no-store'})).text();
localStorage.setItem('duoSrc', src); localStorage.removeItem('duoPatch');
(0, eval)(src);
```

Two things make that fetch work, and both are easy to lose:

- Chrome blocks an https page from fetching `http://127.0.0.1` **with no error at all —
  it just hangs** — unless the server answers the Private Network Access handshake with
  `Access-Control-Allow-Private-Network: true`. `serve.py` sends it.
- Every appended block ends `;'__duo ready';`. A bare `'__duo ready'` followed by a block
  starting `(function(){...})()` is parsed as *calling a string*, which breaks the whole
  file. Keep the semicolons.

History note: the solver used to live only in `localStorage` as `duoSrc` + `duoPatch`,
with this file a partial copy. Clearing the cached patch once destroyed ~4,000 lines that
existed nowhere else, and `ascii()`/`tap()` turned out never to have been in the file at
all. Edit `duo.js`, re-fetch, never hand-patch the page.

## Running

```js
window.__auto = {running:true, out:[]};
(async () => { for (let k = 0; k < 40; k++) {
  if (!__auto.running) break;
  const r = await __duo.autoLesson(); __auto.out.push(r);
  if (r.ok) { const st = JSON.parse(localStorage.getItem('duoAuto'));
    location.href = '/lesson/unit/' + st.unit + '/level/' + st.level; return; }
  if (!r.done) break;
} __auto.running = false; })();
```

Launch it **detached and poll** — a lesson often runs longer than the 45 s CDP call limit,
and awaiting it makes the call look like a frozen renderer. `duoAuto` in localStorage
carries unit/level across the navigation.

## Known blocker: the table-cell widget

"Complete the table" puts its answer cells in the diagram iframe and its maths keypad at
about y=1400, while the viewport is 907 tall. The document does not scroll
(`body.scrollHeight` is 24), `resize_window` cannot grow the viewport past the display,
zoom shortcuts are unavailable, and CSS zoom does not help because the keypad is
positioned in viewport units. Synthetic clicks and synthetic KeyboardEvents are both
ignored by this widget. **Give Chrome a taller window (~1500px of viewport) and these
lessons work** — `solveTableFill` is already written.

## The diagram iframe exposes its own instance (2026-09-01)

`iframe.contentWindow.mathDiagram` is the LIVE widget. This is the single most
useful handle in the whole skill — prefer it over measuring pixels:

- **Table** (`M.rows`, `M.tokens`, `M.cellElements`): filled by DRAGGING tokens.
  `M.handleCellDrop(row, col, value, tokenEl)` is the real drop path;
  `M.setCellValue` alone is reverted by `recalculateComputedCells()`.
- **Grid2D** (`M.components.components`): each component reports its position in
  GRID units (`P.x`, `P.y`), and a draggable one has `_targetX`. Drag its
  `P.element`, then read `P.x`/`P.y` back and calibrate pixels-per-unit from what
  actually moved. No axis-label fitting, which fails outright on graphs with no
  labels.
- Do **not** call `endDrag()` without a real drag in progress — it nulls the
  position and leaves the widget wedged until the lesson is reloaded.

**A correction to an earlier note:** the "unreachable maths keypad" was a
misdiagnosis. That element is a closed drawer translated down by exactly the
viewport height; it opens for challenge types that use it. The table questions
never wanted a keypad at all — they are token drags. Window height was never the
problem.

**Tap tokens are real `<button>`s: use the native `el.click()`.** The synthetic
pointer+mouse sequence is ignored on some screens, and where both register the
token toggles twice and nets out — the cause of the endless `p1,p1,p1...` pairs
loops. `tap()` now calls `.click()` for buttons and keeps the synthetic path for
everything else.
