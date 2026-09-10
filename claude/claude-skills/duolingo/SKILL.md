---
name: duolingo
description: Drive duolingo.com to complete lessons back to back across any course - a language, Math, Chess, or Music - via a standalone Playwright runner. Use when the user says /duolingo, "do my Duolingo", "finish my Duolingo lessons", "do my chess", "do my Spanish", or asks to keep a streak going.
---

# Duolingo autopilot (pwnlingo)

Automated play is against Duolingo's ToS, and reading answers out of the
client-side grader is answer extraction, not learning — the XP still ranks
the user against real people in their league. Say that once, then respect
the answer.

One Playwright runner drives everything: its own persistent Chromium
profile, real trusted mouse clicks (needed for the chess board), no Chrome
extension, no operator once started.

## Run it

```bash
cd scripts && npm install   # once, installs playwright
echo '<jwt_token cookie value>' > scripts/jwt.txt   # gitignored
node run.mjs es      # any language code: es, el, zu, fr, ...
node run.mjs math
node run.mjs chess
node run.mjs music
```

Get the cookie value from an already-logged-in browser's devtools
(Application → Cookies → duolingo.com → `jwt_token`).

Runs forever until killed (Ctrl-C). Status: `cat scripts/state.json`.
Full event trace: `scripts/log.jsonl`. Language study ledger (prompt +
answer per question): `scripts/lessons.jsonl`.

## What each track does

- **Language** (`es`, `el`, `zu`, any code) — loads `scripts/solver.js`,
  which reads the answer straight off the fiber's `challenge` object
  (`correctIndex`/`correctIndices`/`correctTokens`/`correctSolutions`/`pairs`)
  and clicks/types it. Handles word-bank translate, typed translate, cloze
  (contenteditable), match-the-pairs (incl. `characterMatch`), tap-complete.
  Listen/speak always skip — never guesses audio. Stories (`storyStep`) are
  answered the same way from `storyElement` on the fiber. DuoRadio nodes have
  no challenge at all — quit and move on. When the tree stalls (nothing new
  to open), it PATCHes to the least-XP enrolled language and continues.
- **Math** — loads `scripts/mathjs.min.js` then `scripts/math.js` (former
  `duo.js`, pruned 2026-09-09 by hit-trace — see CLAUDE.md) and drives it
  through `__duo.autoLesson()`. Drag widgets (`needdrag`) get a real
  Playwright mouse via `__duo.pendingDrag()`; a `tokenslots`-kind plan is a
  multi-drag sequence the solver can't hand off to a single external drag
  (documented dead end, see CLAUDE.md) and gets skipped.
- **Chess** — `solver.js` + `js-chess-engine.js`. Puzzles: the key ships on
  `chal().chessPuzzleInfo` (`correctMoves`, `moveEvaluationsForPositions`
  keyed by live FEN — `puzzleBest()` prefers this). Bot matches
  (`chal().match`): `matchTurn()` plans from `liveFen()` with a one-ply-deeper
  "Lasker" search (`lasker()`). All clicks are real, held (down/90ms/up),
  550ms apart, verified by watching the live FEN change — synthetic events
  do nothing on the Rive canvas board.
- **Music** — no known challenge shapes yet. `solveLang()` returns `null` on
  anything it doesn't recognise; `run.mjs` logs the challenge type + which
  `correct*`/`solution*`/`choices`/`pairs` keys are present to `log.jsonl`
  and clicks `player-skip`. Add a branch to `solveLang()` once a shape shows
  up in the log.

## Ledger

Every language answer `run.mjs` submits is appended to `scripts/lessons.jsonl`
as `{at, course, type, prompt, answer, via, href}` — a private study record,
not used by the solver itself.

## Dead ends — do not re-litigate

- **Synthetic `.click()`/`PointerEvent`s on tile-bank tokens, sliders,
  draggable points, or the chess board.** `math.js`'s own `dragSynth()`/
  `dragXY()` never work on these — that's still true, don't re-fix it
  in-page. What works: `run.mjs` driving a *real* Playwright mouse from
  outside (`__duo.pendingDrag()` for math's single-point plans, held
  down/move/up for chess). One shape even a real mouse can't answer from
  the runner: `pendingDrag()`'s `kind:'tokenslots'` is a sentinel for a
  multi-token sequence `autoDrag()` drives internally via the same broken
  `dragXY()` — skip it, don't try to single-drag it. Language word-bank
  tiles are real `<button>`s and DO take a native click — different DOM,
  don't conflate them. Chess needs a *held* click (down, wait, up) —
  instant down/up is ignored by the Rive canvas.
- **The web UI's course switcher** (`/settings/courses`). Use the API:
  `__duo.course(code)` PATCHes `currentCourseId` server-side. IDs are
  `DUOLINGO_<LANG>_EN`, `MATH_BT`, `CHESS_CH`, `MUSIC_MU`. The active course
  is per-account, not per-tab — never run two tracks in parallel.
- **`chal().match.boardFen` / `challengeState.guess.moveHistory` as "the
  current position"** — both lag. `liveFen()` (a `useRef` a few fibers above
  the board canvas) is the only live truth.

## Traps that keep costing time

- Choice `innerText` is doubled ("kitekite"/"eștiești"). `solveLang` strips a
  leading shortcut digit and exact-matches — never `includes()`.
- Guided lessons leave earlier questions' iframes/fibers in the DOM; always
  read off the currently-mounted challenge element, not a cached reference.
- Chess promotion: the picker is a canvas popup under the target square,
  clamped to the board's left edge, queen leftmost at `left + 0.8s`,
  `y + 2.2s` (`s` = one square width). Re-derive if the board size changes.
- `computer`-style clicks are in **screenshot pixels** (1568 wide), not CSS —
  `chessPlan()`/`chessSquares()` scale by `1568/innerWidth`. `run.mjs`
  un-scales back to CSS px before calling Playwright's mouse (which IS CSS).
- A lesson costs about one Playwright round trip per challenge this way, not
  a screenshot-driven approach — read the DOM/fiber, don't guess from pixels.

## Rules

- Never trigger `alert`/`confirm`; never click Delete/Reset/Unsubscribe.
- Never enter payment details, buy hearts, or accept a trial.
- Out of hearts → the runner exits; tell the user.
- Login wall → stop and ask the user to sign in. Never attempt to log in.
