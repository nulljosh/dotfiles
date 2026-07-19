---
name: night
description: End-of-night wrap — refresh the weekly journal with today's work, ingest current project state into the notes wiki, deploy both. Use when the user says /night, /goodnight, /goodbye, or asks to wrap up the night.
---

# /night — nightly wrap

One command to log tonight's work everywhere.

**Run cheap:** delegate the whole wrap to one subagent — Agent tool, `subagent_type: general-purpose`, `model: haiku` — with the Steps below as its prompt. Relay its TLDR to the user. The main session's model is untouched.

**Delta re-runs:** if a wrap agent already ran tonight (this session), don't spawn a fresh agent or redo the full wrap — SendMessage the same agent with only what changed since its run, telling it to update journal/wiki status lines, redeploy, and return a short TLDR.

## Steps

1. **Collect** — from `~/Documents/Code`, for each repo with `.git`:
   `git log --oneline --since="12 hours ago"`. Skip repos with no commits.

2. **Journal** — read `~/.claude/skills/journal/SKILL.md` in full first, especially the Voice section, before writing anything:
   - Update the current week's entry in `~/Documents/Code/journal/_posts/` (one post per week, Friday/Sunday date; verify the weekday of today's date before picking the day section).
   - **Grep the post for the day's existing `##` heading before writing.** If today already has one (from an earlier wrap this same session or an earlier run today), append a new paragraph inside it. Never add a second heading for the same day ("## Friday (evening)", "## Friday (continued)", etc.) — that's the exact bug that caused duplicate/fragmented sections before. One heading per day, full stop.
   - Write first person, like Joshua recapping his day to a friend — not third person, not a changelog. 2-5 sentences, pick what actually mattered, skip commit hashes/bundle IDs/error codes unless the story is genuinely about that error. See journal SKILL.md's Voice section for a bad/good example before writing.
   - Update the apps summary.
   - Commit, deploy via `./scripts/deploy.sh` (never plain git push for deploy), and `git push`.

3. **Wiki** — update `~/Documents/Code/notes/notes/master.md`:
   - Bump the "Updated" date, refresh the Roadmap / Active Projects table and Ship Now list with current state, prune completed `- [x]` items.
   - Bullet style, no frontmatter, no emojis (see notes/CLAUDE.md).
   - Commit + push.

4. **Stale-memory check** — for each repo touched tonight, grep `~/.claude/projects/-Users-joshua/memory/project_*.md` for a matching memory file. If tonight's commits change status the memory records (version bump, submission, ship, fix, or code the memory describes as removed/added that a commit touches again), edit that memory file directly to correct it — update the stale claim, keep the `**Why:**`/`**How to apply:**` structure intact, note what changed. Then list it in the TLDR as "memory fixed: <file>".

5. **TLDR** — end with a short bullet list of what landed in journal and wiki, the count of commits and repos touched tonight, any memory fixes made (or "memory: nothing stale"), plus the journal URL.

6. **Notify** — call the `PushNotification` tool with the TLDR summary so the wrap is visible even if this ran in the background.

## Rules
- Work lean: batch git scans, no subagents.
- Don't invent work — only what git shows tonight.
