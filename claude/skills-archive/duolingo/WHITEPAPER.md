# Pwnlingo Technical Whitepaper

**v2.0.0** | September 2026

Pwnlingo is a personal Duolingo autopilot. It plays language, math, chess and
music tracks back to back, reading answers straight out of the client-side
grader instead of guessing at pixels. One Playwright runner drives everything:
its own persistent Chromium profile, real trusted mouse clicks, no browser
extension, no operator once started. A native iOS/macOS app shows live
progress without keeping a session open.

## The grading problem

Duolingo's challenge data lives on a React fiber, not in the DOM. `chal()`
walks up from the mounted challenge element until it finds
`memoizedProps.challenge` — the same object the grader itself reads. Chess
puzzles carry `chessPuzzleInfo.correctMoves` and, more reliably,
`moveEvaluationsForPositions` keyed by live FEN, since `correctMoves` alone
mixes steps and alternatives. The chess board is a Rive canvas: synthetic
pointer events do nothing, so every click is a real, held (down/90ms/up)
Playwright mouse click, ~550ms apart.

## Solver by track

- **Language** (`solver.js`) — one field-driven dispatch over the fiber's
  `challenge` object: word bank, typed translate, cloze, match-the-pairs,
  tap-complete. Listen/speak always skip, never guesses audio.
- **Math** (`math.js`, pruned from a 21k-line legacy file by an instrumented
  hit-trace) — driven through `autoLesson()`; drag widgets get a real
  Playwright mouse, since Duolingo's token-bank/slider widgets never respond
  to synthetic events.
- **Chess** (`solver.js` + bundled `js-chess-engine`) — puzzles via
  `moveEvaluationsForPositions`; bot matches via a one-ply-deeper "Lasker"
  search over `liveFen()`, the only position that isn't stale.
- **Music** — unimplemented. No known challenge shapes yet; the runner logs
  and skips until one shows up.

## Runner

`scripts/run.mjs <track>` launches Chromium, injects the solver, and loops:
solve, click through end screens, handle stories, skip DuoRadio, reopen.
Writes a heartbeat to `state.json` on every loop tick, so a hung browser
session shows a stalled timestamp instead of looking identical to normal idle
time. Also serves `state.json`/`log.jsonl` over a small stdlib HTTP endpoint
(`:8737`) for the companion app to poll over LAN.

## Status app

`app/` is a shared SwiftUI codebase (xcodegen, no checked-in `.xcodeproj`)
building both a macOS window and an iOS app off the same `ContentView.swift`.
Polls `/state` every three seconds: track, puzzles, misses, matches, XP
delta. Red warning if the heartbeat goes stale.

## Ethics note

Automated play is against Duolingo's ToS, and the XP still ranks against real
people in a league. This exists for personal use on one account, not
distribution.

## License

MIT 2026, Joshua Trommel
