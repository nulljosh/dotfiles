---
name: wiki-roadmap-tidy
description: Tidy the Obsidian wiki vault and every roadmap under ~/Documents/Code. Use for /wiki-roadmap-tidy, "clean up the wiki", "organize roadmaps", "tidy notes and roadmaps".
---

# Wiki and roadmap tidy

No subagents. Do it inline, small commands. Never `rm -rf` or bulk `rm`: the auto-mode classifier blocks it. Move junk to `~/.Trash`, and ask Joshua before deleting a folder or hundreds of files.

## Vault (real one only)
`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code` (wiki/index.md, wiki/log.md, wiki/pages/). Schema in `wiki/CLAUDE.md`.

1. Impostor check: `~/Library/Mobile Documents/com~apple~CloudDocs/Documents/Code` must not exist as a real folder. If it does (it holds commit-stub Inbox files and its own .obsidian), move any real notes out, then ask before removing it. The vault `Inbox/` commit stubs are junk too.
2. Stray files in vault root and `wiki/pages/`: `.bak`, `.txt`, `Untitled.md`, a second `log.md`. Merge useful content into the right page (pages/log.md goes onto wiki/log.md), trash the rest, rename `.txt` to `.md` kebab-case.
3. Names: page filenames must be the app's CURRENT name (check `ls ~/Documents/Code` and MEMORY.md renames). Stale ones get renamed with `aliases: [old names]` in frontmatter and an H1 like `Name (ex-Old)`. Apps merged into another (Evidna into Noema, Rainjack into Vancouver Vice, Cruise into Duke) get folded into the successor under `## History: ...`, old page to Trash. Rewrite every `[[old]]` to `[[new]]` (in log.md and src-/syn- pages use `[[new|old]]`). Do it with one Python script: tar backup of `wiki/` first, then rename, merge, link rewrite, dead-link check (a past run took 22 renames and 9 merges in one pass).
4. Dead check: every `[[link]]` resolves, every page is in index.md, no empty pages. `*-readme.md` snapshots: delete ones whose repo folder is gone, regenerate the rest from the repo README.
5. index.md: one line per page, NO version numbers or review states (they rot, status lives on the page). `_overview.md` is structure and standing rules only, never a dated running log; archive any long old one to `wiki/raw/`.
6. Known leftover: `~/.git-hooks/post-commit` writes commit stubs into the iCloud CloudDocs `Code/Inbox`, which recreates the impostor folder. Nothing reads the stubs. Remove that part (needs Joshua's OK to edit).
7. Append one line to `wiki/log.md`: `## [date] tidy | what changed`. No emojis in vault files.

## Roadmaps
`find ~/Documents/Code -maxdepth 3 -iname 'roadmap.md'` (skip node_modules, joshuatree unless asked).

1. Title line uses the app's current name (check memory renames). Fix stale ones.
2. One roadmap per project. If both `roadmap.md` and `docs/ROADMAP.md` exist, fold into the one the other apps in that repo use and `git rm` the extra.
3. Identical copies (`journal/_site`, `vault/plan` vs `plan`) are build or mirror artifacts, leave unless tracked twice.
4. Finished or closed sections: collapse to one line or move to the repo's CHANGELOG. Cross-repo `~/Documents/Code/roadmap.md`: prune DONE sections, keep Blocked on Joshua current.
5. Stray roadmap-like items found in the vault (`Misc`, `notes/`, impostor `roadmap.md`) go into the right roadmap, not left behind.

## Finish
Commit and push each touched repo (separate repos, one commit each, with the Co-Authored-By trailer). Report in under 8 lines: what moved, what was trashed, what needs Joshua's yes. Then run `/save`.
