---
name: wrapup
description: Session wrap — refresh the journal with this session's work, ingest current project state into the notes wiki, deploy both. Use when the user says /wrapup, /wrap-up, /goodnight, /goodbye, or asks to wrap up.
---

# /wrapup — session wrap

One command to log this session's work everywhere.

**Run cheap:** delegate the whole wrap to one subagent — Agent tool, `subagent_type: general-purpose`, `model: haiku` — with the Steps below as its prompt. Relay its TLDR to the user. The main session's model is untouched.

**Delta re-runs:** if a wrap agent already ran in this session, don't spawn a fresh agent or redo the full wrap — SendMessage the same agent with only what changed since its run, telling it to update journal/wiki status lines, redeploy, and return a short TLDR.

## Steps

1. **Collect** — from `~/Documents/Code`, for each repo with `.git`:
   `git log --oneline --since="12 hours ago"`. Skip repos with no commits.

2. **Journal** — read `~/.claude/skills/journal/SKILL.md` in full first, especially the Voice section, before writing anything:
   - Update the current entry in `~/Documents/Code/journal/_posts/` (blog split from `inkpress` into its own repo 2026-07-21 — `inkpress` is now the RSS-reader iOS app only; one post per month by default; verify the weekday of today's date before picking the day section). **Before appending, check the latest post's frontmatter `date:`** — if it's more than ~10 days old, or the file is over ~20KB, start a NEW post instead of appending (see `journal/CLAUDE.md`'s size/staleness exception, added 2026-07-21 after 2026-07-03-june-july.md silently grew to 157KB/18 days stale).
   - **Grep the post for the day's existing `##` heading before writing.** If today already has one (from an earlier wrap this same session or an earlier run today), append a new paragraph inside it. Never add a second heading for the same day ("## Friday (evening)", "## Friday (continued)", etc.) — that's the exact bug that caused duplicate/fragmented sections before. One heading per day, full stop.
   - Write first person, like Joshua recapping his day to a friend — not third person, not a changelog. 2-5 sentences, pick what actually mattered, skip commit hashes/bundle IDs/error codes unless the story is genuinely about that error. See journal SKILL.md's Voice section for a bad/good example before writing.
   - Update the apps summary.
   - **Run `python3 scripts/lint-posts.py` and fix every violation before committing.** It caps length, bans commit hashes, version and build numbers, em dashes and lists inside day sections, and rejects a second heading for the same weekday. `deploy.sh` runs it too and will refuse to publish. The session dump you were handed is long; the entry is not. Compress it, do not transcribe it.
   - Commit, deploy via `./scripts/deploy.sh` (never plain git push for deploy), and `git push`.

3. **Wiki** — update `~/Documents/Code/notes/notes/master.md` AND the Obsidian wiki vault:
   - `master.md`: bump the "Updated" date, refresh the Roadmap / Active Projects table and Ship Now list with current state, prune completed `- [x]` items.
   - Obsidian vault (`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/`): ingest this session's work per `wiki/CLAUDE.md`'s ingest workflow — update/create the touched apps' entity pages in `wiki/pages/`, then refresh `wiki/index.md` and `wiki/pages/_overview.md` so they match what the entity pages now say. This is the actual "Wiki Index" surface people read — don't skip it just because master.md got updated.
   - Run `~/.claude/skills/wiki-refresh/SKILL.md` (read it in full) across all three surfaces it covers (Obsidian vault, master.md, `~/Documents/Code/CLAUDE.md`): catch stale app names in index/current-state sections left over from any rename. Only touch current-state/index lines, never past wrap-log entries or entity-page changelog/history sections.
   - **Roadmap sweep**: for each repo touched this session, `grep -c "^- \[ \]"` its `roadmap.md`/`ROADMAP.md` and spot-check open items against this session's commits/memory files — check off (`- [x]`) anything actually shipped, don't just leave it stale. Small drift check, not a full re-audit.
   - **Roadmap prune**: after the sweep above, run the `roadmap-prune` skill on each repo touched this session (`python3 ~/.claude/skills/roadmap-prune/scripts/prune.py <repo>/roadmap.md`) to strip the `- [x]` items back out — history lives in git log, the roadmap file should only ever show what's still open. Commit the prune as part of that repo's wiki-wrap commit.
   - Bullet style, no frontmatter, no emojis (see notes/CLAUDE.md).
   - Commit + push.

4. **Stale-memory check** — for each repo touched this session, grep `~/.claude/projects/-Users-joshua/memory/project_*.md` for a matching memory file. If this session's commits change status the memory records (version bump, submission, ship, fix, or code the memory describes as removed/added that a commit touches again), edit that memory file directly to correct it — update the stale claim, keep the `**Why:**`/`**How to apply:**` structure intact, note what changed. Then list it in the TLDR as "memory fixed: <file>".

5. **TLDR** — end with a short bullet list of what landed in journal and wiki, the count of commits and repos touched, any memory fixes made (or "memory: nothing stale"), plus the journal URL.

6. **Notify** — call the `PushNotification` tool with the TLDR summary so the wrap is visible even if this ran in the background.

## Rules
- Work lean: batch git scans, no subagents.
- Don't invent work — only what git shows for this window.
