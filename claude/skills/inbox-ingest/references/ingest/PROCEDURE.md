---
name: ingest
description: Sweep every note in Apple Notes.app and actionable mail in macOS Mail, file each one straight into the target project's roadmap.md or the Obsidian wiki, then delete the note. Never writes or edits code — filing only. Use when the user says "ingest my notes", "/ingest", or wants Notes.app cleared into roadmaps/wiki without any of it being executed.
---

Pure capture pass: read Notes.app, file everything, delete the source. No code is written or edited under any circumstance — not even for items that look trivial. If an item looks actionable, it still gets filed as a task, never banged out.

## Steps

1. **Snapshot**: `/Users/joshua/Documents/Code/dotfiles/claude/skills/inbox-ingest/references/ingest/notes-list.sh [folder] [outdir] > list.tsv`. No folder = every account and folder except Recently Deleted (three accounts each have a "Notes" folder; scoping by name alone is ambiguous). Per note it writes `<pk>.txt` (line 1 = name, rest = plaintext) and `<pk>.html` (body HTML, the only place link URLs survive), and prints `<txt>\t<noteId>`. Locked notes print `skip` on stderr; list them in the final report, never delete them.
2. **Attachments**: `/Users/joshua/Documents/Code/dotfiles/claude/skills/inbox-ingest/references/ingest/notes-attachments.sh ~/Documents/Code/notes/attachments/<today>` once, before any deletion. Files are `<pk>-<n>.png` (non-images keep their extension), so they map to the note by the same pk. Rerun-safe. Read every image and file what it says, citing the path. Compare `￼` markers in each `.txt` against that pk's exports; link previews export nothing, so take their URL from the `.html`. A `MISSING` line means the media isn't downloaded: that note stays in Notes.
3. **Empty check**: empty list means sweep Mail (step 6) and stop.
4. **Classify and file** in batches of about 10 notes, same split as `/work dump` (`~/.claude/commands/work.md` steps 2-3) minus its "trivial, just do it" path:
   - **task** → the project's roadmap under `## Ingested <today>` as `- [ ]` lines, reusing that heading. Create `# <Repo> Roadmap` if absent; README.md/CLAUDE.md fallback.
   - **idea** or **note** → a wiki page in `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/pages/`, appending to an existing topic page over a new one.
   - **Dedupe**: scan the target for the same open item; merge detail into it instead of a near-duplicate.
   - **Case trap**: macOS is case-insensitive, `roadmap.md` and `ROADMAP.md` are one file. `ls` the root and use the existing case. Never `cat a >> A`.
   - Preserve wording and full content (numbers, names, links, blocked-reasons). A title stub is data loss. Vague items get filed with a one-line question, never dropped.
5. **Delete that batch** once its text is on disk: `/Users/joshua/Documents/Code/dotfiles/claude/skills/inbox-ingest/references/ingest/notes-delete.sh <noteId>...`. You run it, in the main thread, never a fork. It prints `remaining_in_Notes=N` counted across every active folder. Then the next batch. Batching keeps a crash or context reset from leaving filed notes undeleted or deleted notes unfiled; the snapshot dir is the resume point.
6. **Mail sweep** once, after the last batch: the `mail-ingest` skill. Do it before deciding a note is still open (2026-11-06: mail showed a refund had already landed).
7. **Verify**: N must be 0, or exactly the locked/MISSING notes named in the report. New notes that landed mid-run: run step 1 again and keep going.
8. **Commit** per repo: `git diff` each touched file, stage only your paths, never `git add -A`, never `git checkout`/`restore` to tidy. The vault is iCloud, not git; the write is durable.
9. **Quit the apps**, no asking: `/usr/bin/osascript -e 'quit app "Notes"' -e 'quit app "Mail"'`. One terse line per repo/page touched.

Under `/loop`: one tick = steps 4-5 for as many batches as fit, then re-arm. Stop the loop (`stop: true`) only when step 7 holds. Never empty Recently Deleted; it is the safety net.

## Learned
- A title can be an old name. Grep the repo CLAUDE.md files before filing (Curbfind is Scrounger).
- labs is public. Money, family and school details go in the vault; the public roadmap gets a pointer.
- Repos with no root roadmap: joshuatree uses `docs/ROADMAP.md`. Others get a new `roadmap.md`.
- Some repos reject a roadmap over 5,000 tokens at pre-commit. Move a finished section to `docs/` rather than skip the check. Run the commit before deleting notes only if the text is not already on disk.
- iPhone "not available in your country or region" on an app with a live Mac version usually means iOS is not live. Check `asc versions list` before touching territories.

## Usage awareness
This is a single-thread filing pass by design (step 5 forbids delegating deletion) — don't spawn subagents per note or per project even when the note count is large. If usage is tight, finish the current batch through deletion before stopping; the cost here is small reads/writes, not fanout.
