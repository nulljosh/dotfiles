---
name: graph-run
description: Run a multi-step job as an agent graph instead of one long chat - planner, independent lanes, a separate skeptic, a merge, then Joshua's yes - with every step writing a file and the graph drawn as an SVG. Use when the user says /graph-run, "graph it", "run it as a graph", "graph engineering", or asks for deep research, a go/no-go call, a launch plan, a support or content pipeline, or anything with several sources, checks or a risky final action.
---

# graph-run

Graph engineering, from Greg Isenberg's "Why Graph Engineering will 10x your Claude/Codex"
(youtu.be/JWhICz1QR8M): jobs joined by arrows, with state (what the system knows so far)
handed along. This is his level 2: each job writes a file, so the run leaves a paper trail.
No LangGraph, no n8n. ponytail: add a framework only after the same graph has run by hand
three times and the manual version has clearly paid off.

## Graph it or not

Graph it when the job has several steps, several sources, parallel parts, checks, risk, or
an approval. Ten project names or a short email summary: just answer, no graph.

## The run

1. **One sentence result.** "A one-page call on whether X is worth testing." Write it at the
   top of `plan.md`.
2. **Draw it before running it.** List the jobs a good human would do, then the arrows
   (which job needs which). Render with the architecture-svg renderer to `graph.svg`:
   `kind` core = job, ext = check, gate = Joshua, store = state; `"arrows": true`;
   `"loop"` for a retry edge. 7 jobs max; past that, split the job.
3. **Run folder:** `runs/<yyyy-mm-dd>-<slug>/` in the repo it's about, else the scratchpad.
   Files: `plan.md`, one `<lane>.md` per lane, `review.md`, `result.md`, `graph.svg`.
4. **Lanes run one at a time.** House rule beats the video's "in parallel": lanes are
   independent, so order doesn't matter, but run them sequentially, by the main session or
   one Haiku agent per lane, never a fan-out. Each lane reads `plan.md` and writes only its
   own file, sources cited.
5. **The skeptic is a different agent from the writer.** Fresh context, never the session
   that wrote the lanes; a model grading its own work rates itself a visionary. It writes
   `review.md`: claims with no proof, stale evidence, what's missing, pain mistaken for
   willingness to pay, confident sentences with nothing under them. Cut what fails.
6. **Merge** what survived into `result.md`: the call, the first move, what to test this
   week, and what evidence would change the call.
7. **Joshua's gate.** Stop and show `result.md` with `graph.svg`. Nothing that ships,
   sends, posts, spends, refunds or deploys happens before his yes. An internal memo can be
   a light gate; money, customers, public posts and deploys get a real one.
8. **Stop when it's good enough.** The run folder stays; next time, read the last run
   first so the graph builds memory instead of starting cold.

## Ready-made graphs

- **Research call** (the diamond): plan -> customers / competitors / distribution -> skeptic -> merge -> Joshua.
- **Support reply:** classify -> account history -> docs and policy -> draft -> reviewer -> Joshua on refunds, account changes, angry users, legal.
- **Content:** research -> thesis -> examples -> hook -> script -> reviewer ("does it sound like Joshua?") -> titles / thumbnail.
- **Code:** plan -> edit -> separate review -> tests -> browser or headless check -> Joshua merges. The Joshua Tree loop already runs this; its picture is `joshuatree/docs/loop-graph.svg`.

More agents is not better. Five agents can repeat one wrong idea with confidence. Use the
smallest graph that raises the quality.
