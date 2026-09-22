# Brief: write docs/ARCHITECTURE.md for each repo in your list

Repos live under ~/Documents/Code/<repo>. Reference for format and voice: ~/Documents/Code/joshuatree/docs/ARCHITECTURE.md (read its first 60 lines once).

For EACH repo in your list:
1. Run `python3 ~/Documents/Code/scripts/doc-digest.py ~/Documents/Code/<repo>` FIRST. It prints every code file with its leading comment and top-level names. Work from the digest. Read in full only the 3-6 entry points (server/app entry, router, main view, core service) and any file whose digest line is not enough to describe it honestly. Do NOT read every file, that is the slow expensive path. Never guess from a filename alone.
2. Write `<repo>/docs/ARCHITECTURE.md`:
   - `# Architecture` + 2-3 sentence intro: what the thing is and how it runs (stack, deploy target).
   - `## How it runs`: the real flow end to end (request/boot/launch path), naming files in backticks.
   - One or more `| File | What it owns |` tables grouped by area, one row per source file with a concrete sentence about what it owns (not "handles X logic"). Related files can share a row (`a.js` + `a.test.js`). A directory of many near-identical files (locales, generated assets, per-page content) gets ONE row named with a trailing slash like `locales/`, which covers everything under it.
   - Short closing sections only when real: data/storage, external services, gotchas found in the code.
   - If docs/ARCHITECTURE.md already exists, extend it, do not clobber.
3. Run `python3 ~/Documents/Code/scripts/progress-svg.py ~/Documents/Code/<repo>` and read the "% documented". Coverage = tracked code files whose basename (or a parent dir with trailing slash) appears in the doc. Keep going until it is >= 95%. Do NOT game it: no bare filename dumps, every name needs a real description.
4. `cd <repo> && git add docs/ARCHITECTURE.md progress.svg && git commit -m "docs: architecture map" && git push`. Commit ONLY those two files; leave any other dirty state alone. If push fails, note it and move on.

Readability (hard): this gets published on a public docs page for normal people to browse. Open with what the product does for its user in plain words before any stack talk. Short sentences. Explain a term the first time it shows up. Table cells are one or two plain sentences, not a wall. Use `##` headings a reader can scan.

Style rules (hard): plain natural English, no em dashes anywhere, no emojis, no AI voice ("leverage", "seamlessly", "robust"), no marketing. Do not edit any code. Do not launch apps, simulators, or browsers.

Final reply: one line per repo: `<repo>: <pct>% documented, pushed|push failed|skipped (why)`.
