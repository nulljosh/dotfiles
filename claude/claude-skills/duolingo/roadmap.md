# Roadmap

## Open
- [ ] Music track: no known challenge shapes yet. `solveLang()` returns null
  and `run.mjs` skips + logs to `log.jsonl` — check that log for real shapes
  before writing a branch, don't guess.
- [ ] Bot chess matches (`chal().match`) lose at engine level 3 — `lasker()`
  only searches one extra ply past `jsChessEngine.aiMove`, capped at level 4
  (level 5 can take >10s in-page). A stronger search is a real fix, not yet
  attempted.
- [ ] `run.mjs`'s orchestration (drag retries, story loop, tree-walk
  fallback) has no test coverage — only `solver.js`'s pure functions do
  (`solver.test.mjs`).

## Done
- 2026-09-09: full engine rewrite — one Playwright runner (`scripts/run.mjs
  <track>`) replaces the Chrome-extension + boot.js/langBoot.js/serve.py
  stack (all deleted). See CLAUDE.md for the current architecture.
- 2026-09-09: `run.mjs` now writes a heartbeat to `state.json` every loop
  iteration (not just on solved events), so a hung browser session (stuck
  navigation, dead CDP connection) shows a stalled `at` timestamp instead of
  looking identical to "working, just between puzzles."
- 2026-09-08/09: chess puzzles solved via `chessPuzzleInfo` +
  `moveEvaluationsForPositions`; ~1,700 puzzles overnight, 0 misses.
  Language solver verified live (Spanish, Greek). Math pruned from 21.6k to
  19.1k lines by hit-trace, `mathjs.min.js` replaces the hand-rolled LaTeX
  evaluator.
