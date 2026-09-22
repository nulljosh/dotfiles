---
name: pwnlingo-import
description: Import real captured Duolingo exercises from pwnlingo's scripts/lessons.jsonl into new or existing Lexly course files. Use when the user asks to feed pwnlingo data into Lexly, refresh Lexly's language courses from pwnlingo logs, or invokes /pwnlingo-import.
---

# pwnlingo-import

pwnlingo (~/Documents/Code/pwnlingo) farms Duolingo and logs every exercise it
solves to `scripts/lessons.jsonl` (prompt/answer/choices/type per row). Lexly
(~/Documents/Code/lexly) is our own Duolingo clone with hand-authored course
JSON at `content/courses/*.json` + `content/catalog.json`. This skill moves
real exercise data from the former into the latter.

## Run it

```
node ~/Documents/Code/lexly/scripts/import-pwnlingo-exercises.mjs
node ~/Documents/Code/lexly/tools/validate-catalog.js
```

The importer:
- reads `pwnlingo/scripts/lessons.jsonl`
- keeps only `translate` / `select` / `assist` rows with non-empty
  prompt+answer+choices (other types — `gapFill`, `completeReverseTranslation`,
  `character*` — are frequently empty in the source log; not worth cleaning)
- dedupes by prompt+answer
- chunks into lessons of 10 / units of 5 lessons, matching Lexly's course shape
- writes `content/courses/<track>.json` and adds/updates the entry in
  `content/catalog.json` under the `languages` category

Track code → course mapping lives in the `TRACKS` const at the top of the
script (currently `tlh`→Klingon, `yi`→Yiddish, `id`→Indonesian). Add a new
entry there when pwnlingo starts farming a language Lexly doesn't have yet.

## After running

- Drop any course with too few exercises to be useful (fewer than ~1 lesson's
  worth) — remove its `content/courses/<id>.json` and its `catalog.json` entry.
- Re-run the validator; it warns (not fails) on answer-equals-question rows,
  which is expected noise from single-word exercises.
- Review a diff before committing — this only ever adds new course files /
  catalog entries, never edits existing hand-authored courses.
