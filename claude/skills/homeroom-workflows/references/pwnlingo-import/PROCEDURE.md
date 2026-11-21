---
name: pwnlingo-import
description: Import real captured Duolingo exercises from pwnlingo's scripts/lessons.jsonl into new or existing Lexly course files. Use when the user asks to feed pwnlingo data into Lexly, refresh Lexly's language courses from pwnlingo logs, or invokes /pwnlingo-import.
---

# pwnlingo-import

pwnlingo (~/Documents/Code/cruise) farms Duolingo and logs every exercise it
solves to `scripts/lessons.jsonl` (prompt/answer/choices/type per row). Lexly
(~/Documents/Code/tonchi) is our own Duolingo clone with hand-authored course
JSON at `content/courses/*.json` + `content/catalog.json`. This skill moves
real exercise data from the former into the latter.

## Run it

```
node ~/Documents/Code/tonchi/scripts/import-pwnlingo-exercises.mjs
node ~/Documents/Code/tonchi/tools/validate-catalog.js
```

The importer:
- reads `pwnlingo/scripts/lessons.archive.jsonl` then `lessons.jsonl`
- maps each row's `course` (pwnlingo track code: ja, ko, hi, ar, fr...) to a Lexly course id
- match rows become `match` (pairs, or parsed from old "x is y" narration); rows with choices
  become `translation` (or `cloze` when the prompt has ___); multi-word typed answers become
  `sentence` with two same-script distractor chips
- dedupes, caps at 500 per course, skips courses with under 10 drills
- appends units with ids `pw1..` to the EXISTING hand-written course; a re-run replaces only `pw*` units

## After running

- Drop any course with too few exercises to be useful (fewer than ~1 lesson's
  worth) — remove its `content/courses/<id>.json` and its `catalog.json` entry.
- Re-run the validator; it warns (not fails) on answer-equals-question rows,
  which is expected noise from single-word exercises.
- Review a diff before committing — this only ever adds new course files /
  catalog entries, never edits existing hand-authored courses.
