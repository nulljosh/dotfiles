---
name: quotestreak
description: Drive quotestreak.heyitsmejosh.com (nulljosh/quotestreak, our own project) in Chrome to play the game forever, answering every question correctly for max score. Use when the user says /quotestreak, "play quotestreak", "farm quotestreak points", "run the quotestreak loop", or wants the high score maxed out.
---

# Quotestreak autopilot

Own project, own game, no ToS to worry about (unlike [[duolingo]]). There's
no leaderboard to game against real people — `quotestreak_high_score` is a
local `localStorage` value in whichever browser plays it.

## Why this isn't blind clicking

Quotestreak exposes its whole game loop on `window`, for WebMCP
(`webmcp.js` registers `get_high_score`, `get_game_state`, `start_game`,
`answer_question`, `next_question` — see `docs/API.md` in the repo). The
underlying functions (`window.quotableStartGame`, `quotableChoose`,
`quotableNextQuestion`, `quotableGetState`, `quotableGetHighScore`) are the
same ones the UI buttons call, exported at the bottom of `game.js`.

The one thing `quotableGetState()` deliberately withholds is the *answer*
to the current question — the WebMCP tool doc even notes the HTTP API ships
the answer with the question "on purpose," since `quotes.json` is public
anyway. So: fetch `/quotes.json` yourself and match by `quote` + `type` to
get `answer`, rather than trying to parse it out of the DOM.

## The loop

A single game session is not infinite — `pool` is a shuffled copy of
`quotes.json` (272 entries for genre `all`), `nextQuestion()` does
`pool.pop()`, and an empty pool calls `endGame()`. "Forever" means:
detect game-over and call `start_game` again, indefinitely.

Score also resets to 0 every `start_game` call — only the high score
persists across restarts (`endGame()` maxes it into `localStorage`). So a
big number in one sitting means *not restarting* until the pool empties on
its own (272 questions), not spamming restarts.

Speed round (`mode: "timed"`) scores `10 * max(1, ceil(secondsLeft))` per
correct answer — answering near-instantly gets the max ~10x bonus every
time, vs. flat `+10` in normal mode. Always use timed mode for a high
score run.

1. `tabs_context_mcp`, `navigate` to `https://quotestreak.heyitsmejosh.com/play.html`
   (or `quotable.heyitsmejosh.com/play.html` — same site, old CNAME kept
   live deliberately per the project's CLAUDE.md, both resolve).
2. `javascript_tool` — paste `scripts/loop.js` in full. It fetches
   `quotes.json`, starts a `timed`/`all` game, and polls every 250ms:
   if the current question's quote text differs from the last one it
   answered, it calls `quotableChoose(correctAnswer)` once; if
   `inProgress` goes false it calls `quotableStartGame` again. State lives
   in `window.__quotestreakLoop` (the interval id) and `window.__qsLog`
   (restart history with timestamps).
3. The loop now runs **inside the page**, independent of this session —
   it survives after you stop calling tools, as long as the tab stays
   open. Don't close the tab (`tabs_close_mcp`'s "clean up your tabs"
   default doesn't apply here — the point is to leave it running).
4. To check progress without disturbing it, re-run `javascript_tool` with
   just a read: `({state: window.quotableGetState(), highScore:
   window.quotableGetHighScore(), log: window.__qsLog})`. This is a pure
   read, safe to call anytime.
5. To stop: `clearInterval(window.__quotestreakLoop)`.

## Gotcha already hit once

Don't poll-and-answer on a fixed timer without gating on question
identity. `choose()` internally does `setTimeout(nextQuestion, 1100)`, so
if your poll interval fires twice against the same question (drift, slow
tab, whatever), the second `quotableChoose` call re-scores an *already
answered* question — double-counts score/streak and fires a second
`nextQuestion`, which desyncs the auto-advance from the pool and can
`pool.pop()` past a quote you never saw. `loop.js` tracks `lastQuote` and
only answers when the shown quote text changes.

## Usage awareness
The loop runs inside the page's own JS once started — it costs nothing further in tool calls. Don't poll for progress on a tight timer; check in only when the user asks, spaced minutes apart, not back-to-back `javascript_tool` reads.
