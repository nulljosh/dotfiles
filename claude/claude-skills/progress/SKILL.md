---
name: progress
description: Scan every project under ~/Documents/Code (READMEs, roadmap.md, TODO/FIXME markers, CLAUDE.md) and estimate how long and how expensive it is to finish all remaining features and bugs. Use when the user asks "how long to finish everything", "what's left across projects", or invokes /progress.
---

# Estimate

1. List projects: top-level dirs in `~/Documents/Code` (skip hidden, node_modules).
2. For each project, read (if present): `README.md`, `roadmap.md`, `ROADMAP.md`, `TODO.md`, `CLAUDE.md`. Grep source for `TODO|FIXME|HACK` counts (one grep per project, not per file).
3. Also read `~/Documents/Code/roadmap.md` (global work queue) if present.
4. Extract remaining features/bugs per project. Ignore completed/checked items.
5. For each item assign a t-shirt size and convert:
   - S = 0.5h, M = 2h, L = 6h, XL = 16h (agent-assisted hours)
6. Cost model: assume Claude Code agent-assisted work; use user's plan (Pro/Max flat) → cost is mostly time, but report token-equivalent: ~$3–6/hr of active agent work as API-equivalent.
7. Output one table: project | open items | est. hours | est. cost, then totals and top 3 biggest-ticket items. Keep it one screen. No per-item essays.
