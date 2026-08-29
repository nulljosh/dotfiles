---
name: architecture-svg
description: Generate or refresh a repo's architecture.svg in the house Apple node-and-line style. Use when a repo is missing architecture.svg, when its structure changed enough that the diagram is stale, or when refreshing the diagrams across the whole codebase.
---

# architecture-svg

Every repo under `~/Documents/Code` needs an `architecture.svg` at the repo root, referenced
from its README. Not 200x200 (that's icons) — these are ~640 wide, height follows row count,
white background, inline styles only, Apple node-and-line look.

## Workflow

1. **Read the repo, don't guess.** README head + `git ls-files | awk -F/ ...` for the top-level
   shape, plus whether it has `ios/`, `macos/`, `functions/`, `worker.js`, `supabase/`.
   Hosting is Cloudflare everywhere since the 2026-08-28 migration — a leftover `vercel.json`
   is not evidence.
2. **Write a spec by hand** (see below). The content is per-repo judgment; only the layout is
   automated. ponytail: no codegen that infers architecture from file names.
3. **Render:** `echo '<spec json>' | python3 render.py` — writes the file, prints the path.
4. **Reference it from the README** if it isn't already: `<img src="architecture.svg" width="600">`
   under an `## Architecture` heading.
5. Open it once to check nothing overlaps.

## Spec format

```json
{"out":"~/Documents/Code/<repo>/architecture.svg",
 "title":"<Repo> Architecture",
 "accent":"#1f6fb2",
 "rows":[
   {"kind":"client","cells":["Web","iOS","macOS"]},
   {"kind":"core","cells":["worker.js|the module doing the real work"]},
   {"kind":"ext","cells":["Some API","Another API"]},
   {"kind":"store","cells":["Supabase|row-level security"]}]}
```

- Rows run top-to-bottom: `client` -> `core` -> `ext` -> `store`. Skip rows that don't apply,
  repeat a kind if the repo needs it. 2-4 rows, 1-4 cells per row.
- `|` splits a cell into stacked lines (label on top, detail under). Text shrinks to fit.
- `kind` picks the styling: `client` neutral grey, `core`/`store` accent at 15% opacity,
  `ext` small muted chip.
- `accent`: pick per repo. **Never purple or teal** (house rule).

`reference/specs.example.json` holds the real specs for all 30 repos as of 2026-08-28 — copy
the entry for a repo and edit rather than starting cold. `reference/template.svg` is the raw
hand-authored shape if you need to do something the renderer can't.

## Refreshing everything

```sh
python3 -c "import json,subprocess
for s in json.load(open('reference/specs.example.json')):
    subprocess.run(['python3','render.py'],input=json.dumps(s),text=True)"
```

Staleness check across the codebase — svg date vs commits since:

```sh
cd ~/Documents/Code && for d in */; do d=${d%/}; [ -d "$d/.git" ] || continue
  sd=$(git -C "$d" log -1 --format=%cs -- architecture.svg)
  echo "$d svg=${sd:-MISSING} since=$(git -C "$d" log --oneline --since="${sd:-2020-01-01}" | wc -l)"
done
```
