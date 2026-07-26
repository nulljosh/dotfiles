---
name: ingest
description: Sweep every note in Apple Notes.app, file each one straight into the target project's roadmap.md or the Obsidian wiki, then delete the note. Never writes or edits code — filing only. Use when the user says "ingest my notes", "/ingest", or wants Notes.app cleared into roadmaps/wiki without any of it being executed.
---

Pure capture pass: read Notes.app, file everything, delete the source. No code is written or edited under any circumstance — not even for items that look trivial. If an item looks actionable, it still gets filed as a task, never banged out.

## Steps

1. **List**: run `~/.claude/skills/ingest/notes-list.sh [folder]` — the folder comes from `$ARGUMENTS` (`/ingest Ideas`), default `Notes`. It prints `<path>\t<noteId>` per note, one plaintext file per note (line 1 = name, rest = body) in a tmp dir.
2. **Empty check**: if the list is empty, say so and stop — nothing else to do.
3. **Classify + file each note** — same three-way split and filing rules as `/work dump` (`~/.claude/commands/work.md` steps 2-3), with its "trivial → banged out and committed" path removed entirely:
   - **task** (actionable, has or implies a target project) → that project's roadmap file under a `## Ingested <today's date>` heading as `- [ ]` lines, reusing that heading if it already exists (create the file with a `# <Repo> Roadmap` header if absent; README.md/CLAUDE.md fallback if no roadmap file exists in that repo)
   - **Dedupe**: before appending, scan the target roadmap/wiki page for the same item already open — skip it (or merge new detail into the existing line) rather than adding a near-duplicate.
   - **Filename case trap**: macOS is case-insensitive by default — `roadmap.md` and `ROADMAP.md` are the *same file*. Before writing, `ls` the repo root and match the existing case exactly (some repos use `ROADMAP.md`). Never `cat file >> OTHERCASE` as a "merge" — on a case-insensitive volume that appends the file to itself. Just append directly to whichever case already exists.
   - **idea** (someday/maybe) or **note** (pure information) → a wiki page in `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/pages/`, appending to an existing topic page over creating a new one
   - Preserve the note's wording — organize, don't rewrite. Carry the full content (numbers, names, blocked-reasons), not a title stub — a stub that drops the source content counts as data loss.
   - Vague items still get filed, with a one-line clarifying question attached — never dropped.
4. **Delete the note** once its content is durably filed: `osascript -e 'tell application "Notes" to delete note id "<noteId>"'`.
5. **Single pass**: process every note captured in step 1's listing before finishing — no need to schedule this across multiple turns, it's headless and fast. If new notes land in Notes.app mid-run, they'll be picked up on the next `/ingest` invocation.
6. **Commit**: `git add`+commit the touched roadmap/README/CLAUDE.md files per repo, one commit per repo. Before staging, `git diff` each file being touched and confirm every hunk is yours from this run — never `git add -A`/blind-stage a repo, and never `git checkout`/`git restore` a file to "clean it up" without diffing it first (a restore silently discards any uncommitted work already sitting there, including work you didn't make and can't recover). The Obsidian wiki vault (`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/`) is iCloud-synced, not a git repo — no commit/push step for it, the file write alone is durable. End with one terse line per repo/page touched — no essay.
