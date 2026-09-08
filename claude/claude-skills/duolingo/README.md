<img src="icon.svg" width="80" style="border-radius:18px">

# pwnlingo

Autopilot for Duolingo Math and Chess, driven through an already-signed-in Chrome tab. Language courses are wired but not yet proven live.

The Claude session never answers questions itself. It injects `scripts/duo.js`
into the page, and that script reads the live widget state, works out the
answer, and clicks. Claude only steps in when a question type appears that the
solver has never seen, writes a new solver for it, and restarts the loop.

## Layout

| Path | What it is |
|------|------------|
| `SKILL.md` | The `/duolingo` skill: how to boot the loop and what to check |
| `scripts/duo.js` | The solver. One file, ~20k lines, families appended over time |
| `scripts/serve.py` | Serves `duo.js` on :8777 so the page can fetch it |
| `scripts/js-chess-engine.js` | Bundled engine for the chess match node |
| `duo.py` | Course/path helpers against the Duolingo API |
| `web/` | Landing page, pwnlingo.heyitsmejosh.com |

## Running it

```sh
python3 scripts/serve.py &     # needs Access-Control-Allow-Private-Network
```

Then, in the lesson tab, evaluate the boot snippet stored in
`localStorage.duoBoot`. It fetches the solver, runs `autoLesson()` in a loop,
and navigates on to the next level when one completes.

## Solver families

Exponentials, transformations, statistics, geometry, trigonometry, probability,
counting, circles and parabolas, and 3D solids (prisms, cylinders, cones,
spheres).

Two widget types ignore synthetic events entirely and need real OS mouse input:
dot plots and spinner wedges. The solver computes the drags and clicks; a human
or the Chrome `computer` tool performs them.

## Chess

Puzzles: the answer ships on the React fiber (`chessPuzzleInfo.correctMoves`, UCI).
The board is a Rive canvas, so only real OS clicks land; `chessNext()` turns the
moves into screenshot coordinates and one `computer` batch plays them.

Matches against the bot: `liveFen()` reads the position off a ref six fibers
above the canvas, js-chess-engine picks a move, `matchTurn()` waits for our turn.
Move choice follows Lasker's rule, "when you see a good move, look for a better
one": the engine answers at the base depth, then again one ply deeper, and the
deeper answer wins when they disagree. First game won in 19 moves.

## Language

`solveLang()` reads `correctIndex`, `correctTokens`, `correctSolutions` and
`pairs` off the challenge fiber and clicks or types the answer. Listen and speak
exercises take the skip Duolingo offers. Written 2026-09-08, not yet run against
a live lesson; expect selector fixes on first contact.

## Gaps

- Language solver unverified live.
- Dot plots and spinner wedges still need a human or the `computer` tool.
- No recovery after a wrong move in a chess match beyond counting it.
- Everything still routes through Chrome, the extension and a Claude session;
  a Playwright runner with CDP clicks would remove all three.
