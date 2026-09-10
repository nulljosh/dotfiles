# Working on this solver

## Live track switch (2026-09-09)

`run.mjs`'s HTTP server (port 8737) takes `POST /switch?track=<x>` in
addition to `GET /state`/`GET /log`. It sets a `pendingTrack` module var;
the outer `while (true)` loop picks it up at the top, PATCHes
`currentCourseId` via the (now-extracted) `setCourse()` helper, flips the
mutable `track`/`isMath`/`isChessTrack` bindings, and lets the existing
`inject()` logic load the right script set on the next `openLesson()`. No
process restart — the Chromium/profile/cookies stay put. The status app's
icon row calls this. If you add a track, add it to the app's `tracks`
array too (`app/App/ContentView.swift`).

## Layout (2026-09-09 rewrite)

One Playwright runner, `scripts/run.mjs <track>`, replaces the three
overlapping loops (`boot.js` in-page, `langBoot.js` in-page, `chessRunner.mjs`
Playwright) plus the Chrome-extension injection path (`ext.js`,
`autostart.js`, `manifest.json`) and the plain-file server (`serve.py`). All
deleted — `run.mjs` owns the browser directly, so there is nothing left to
inject into.

- `scripts/solver.js` — the browser-side solver for language, chess, and
  music. Loaded via `page.addScriptTag`. Self-contained: does not depend on
  `math.js`.
- `scripts/math.js` — former `duo.js` / `math-legacy.js`, pruned 2026-09-09
  by an instrumented hit-trace: every function body got a `__hit(id)` call,
  a Playwright run drove `math` for real (autoLesson(), not the generic
  `run(15)` fallback — that one only hits the bail path), and every
  `const base = D.foo; D.foo = wrap(base)` wrapper layer whose body never
  fired got deleted (this is safe without touching anything else — each
  wrapper reads `window.__duo.foo` fresh, so removing a dead layer just
  makes the next surviving one capture its base one link further back; the
  final/active layer for every name is never deleted by this pass). 21,624
  lines -> 19,142. Grader-extraction + geometry pipeline (transformations,
  trig, statistics, widget-family solvers) mostly survived intact — the
  trace only exercised arithmetic-drill and token-slot-algebra content, so
  untouched families (geometry/SVG diagram reading, stats, trig,
  transformations) still have exactly one definition each, just unverified
  by this particular run. `compile()`'s hand-rolled LaTeX expression
  evaluator was replaced with `math.evaluate()`/`math.parse()` from
  `scripts/mathjs.min.js` (a local UMD bundle, copied from
  `curvely/node_modules/mathjs/lib/browser/math.js` — no network
  dependency); the LaTeX normaliser (`\frac`, `\sqrt`, `\pi`, `\cdot`,
  implicit multiplication) stays, it just hands `math.js` a plain algebraic
  string instead of building one for `new Function()`. If you touch math
  logic, this is the file — the same "never stack another wrapper" rule
  below still applies inside it.
- `scripts/mathjs.min.js` — mathjs UMD bundle, math track only. Loaded
  before `math.js` so `math` is defined at solver-script-eval time.
- `scripts/js-chess-engine.js` — bundled js-chess-engine 2.4.6, used for bot
  matches (`chal().match`) only, not puzzles.
- `scripts/solver.test.mjs` — pure-function tests (`node --test`), no
  browser: tile-text normalisation, `puzzleBest()`'s FEN-key lookup, chess
  board/promotion geometry.

## Math track: real mouse for drags, autoLesson() not run(15)

`run.mjs`'s math branch drives `__duo.autoLesson()` (12-min watchdog race,
mirroring the old `boot.js`), not `__duo.run(15)` — `run(15)` is a generic
fallback loop that halts `{stop:'manual'}` on the first widget it can't
click and never actually solves anything. When `autoLesson()` bails with
`needdrag`, `__duo.pendingDrag()` exposes the plan's `{from, to}` (page CSS
px — `plan()` already resolves iframe-local rects to page space) and
`run.mjs` performs a real held Playwright drag, then calls `autoLesson()`
again (up to 3 times). Duolingo's token-bank/slider widgets never worked
with synthetic pointer events (`dragSynth()`/`dragXY()` — still true, still
a dead end, don't re-try it); a real mouse does. One shape it still can't
answer: `kind:'tokenslots'` (`from`/`to` both `[0,0]`) is a sentinel for a
*multi*-token drag sequence `autoDrag()` drives internally via `dragXY()` —
that's the same broken synthetic-event path, just called from inside the
solver instead of by the runner, so a single external drag can't help it.
After 3 failed drags (or 3 stuck strikes on a non-drag widget), `run.mjs`
skips the question and, if the level is still stuck, jumps to a different
level via the `/lesson` tree-walker (`localStorage.treeCursor`) instead of
re-opening the same one.

## The one rule that matters: don't stack wrappers

This is exactly how `duo.js` (now `math.js`) grew to 21k+ lines with
only a fraction actually live. If a fix "doesn't take", or two behaviours
both fire and undo each other, an OLDER version of that function is still in
the chain somewhere above your new one. **Delete the stale block. Never
layer another one on top of it.** This is a git repo — delete freely,
history is recoverable.

`solver.js` has no wrapper chains by design: one definition per function.
Keep it that way — edit the function in place, don't shadow it.

## Traps that keep costing time (language / chess / stories — solver.js)

- Choice `innerText` is doubled ("eștiești"). `strip()` removes a leading
  shortcut digit and compares by exact match — never `includes()` (a bare
  "e" false-matches inside "ești").
- Word-bank tiles in language challenges are real `<button>`s and DO take a
  native `.click()` — this is NOT true of Math's token bank (a different,
  synthetic-event-hostile widget in `math.js`; `run.mjs` now drives its
  drags with a real Playwright mouse instead, see above). Don't port a fix
  from one to the other.
- The chess board is a Rive **canvas**. Synthetic pointer events do nothing.
  A click needs a real held mouse-down (90ms) then up, and two clicks need
  ~550ms between them or the second is swallowed.
- `chal().match.boardFen` and `challengeState.guess.moveHistory` both lag the
  bot's actual reply. `liveFen()` (a `useRef` found by walking fiber
  `memoizedState` a few frames above the board canvas) is the only live
  position — always plan from it, never from those two.
- `computer`/Playwright-mouse coordinates from `chessPlan()`/`chessSquares()`
  are in **screenshot space** (1568px wide), not CSS px — scale by
  `1568/innerWidth` going in, and back by the inverse before calling
  `page.mouse`. `run.mjs` already does this; don't double-apply it.
- Promotion picker geometry (`promo()`) is inset from the board rect by
  measured constants (9.75%/10%/80% for the board, 0.8s/2.2s for the queen
  icon) — if Duolingo resizes the board these need re-measuring against a
  screenshot, not guessed.
- `solveLang()` returns `null` on any shape it doesn't recognise —
  `run.mjs` then skips via `player-skip` and logs the challenge's
  `correct*`/`solution*`/`choices`/`pairs` keys to `log.jsonl`. Check that
  log before writing a new branch, don't guess the shape.

## Testing a change

```bash
node --check scripts/solver.js && node --check scripts/run.mjs && node --check scripts/math.js
node --test scripts/solver.test.mjs
```

For a live check, run `node run.mjs <track>` — it launches its own Chromium,
no separate reload step needed (edit the file, Ctrl-C, rerun).
