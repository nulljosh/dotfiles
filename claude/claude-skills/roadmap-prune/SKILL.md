---
name: roadmap-prune
description: Strip checked-off (- [x]) items out of a repo's roadmap.md/ROADMAP.md, dropping any heading section left empty, so the roadmap only shows what's still open. History lives in git log, not the roadmap. Use when a roadmap.md has grown long with completed items, or as part of /wrapup.
---

# Roadmap Prune

Roadmaps accumulate `- [x]` items forever if nothing removes them — the file
becomes a changelog instead of a todo list. This skill prunes done items out,
since `git log`/commit messages are the actual record of what happened.

## Usage

Run the script directly — no LLM edits needed, it's a mechanical pass:

```bash
python3 ~/.claude/skills/roadmap-prune/scripts/prune.py <path/to/roadmap.md> [more paths...]
```

To sweep every repo under `~/Documents/Code`:

```bash
find ~/Documents/Code -maxdepth 2 \( -iname "roadmap.md" -o -iname "ROADMAP.md" \) -not -path "*/node_modules/*" \
  -exec python3 ~/.claude/skills/roadmap-prune/scripts/prune.py {} +
```

It only touches files that actually change, and prints `path: N -> M lines`
for each one it prunes.

## What it does
- Removes every `- [x] ...` bullet and its indented continuation lines
  (multi-line bullet bodies), keeping open `- [ ]` items untouched.
- Drops any `## heading` section that has nothing left under it.
- Collapses runs of blank lines down to one.

## What it does NOT do
- Never touches `- [ ]` (open) items — those are the whole point of the file.
- Never rewrites wording or reorganizes surviving items — pure removal only.
- Doesn't touch anything outside `roadmap.md`/`ROADMAP.md` (not README/CLAUDE.md).

## After running
Review the diff (`git diff roadmap.md`) before committing if anything looks
off — the continuation-line heuristic (indented lines with no bullet prefix)
covers the common case but isn't foolproof for oddly-formatted entries.
Commit the prune as its own small commit, e.g.
`git commit -m "roadmap: prune checked-off items"`.

## Wired into /wrapup
`/wrapup`'s wiki step runs this across every repo it touched, right
before the wiki refresh, so roadmaps never grow unbounded across sessions.
