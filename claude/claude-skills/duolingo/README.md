# duolingo-solver

Autopilot for Duolingo Math, driven through an already-signed-in Chrome tab.

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
| `duo.py` | Course/path helpers against the Duolingo API |

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
