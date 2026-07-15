---
name: night
description: End-of-night wrap — refresh the weekly journal with today's work, ingest current project state into the notes wiki, deploy both. Use when the user says /night or asks to wrap up the night.
---

# /night — nightly wrap

One command to log tonight's work everywhere.

**Run cheap:** delegate the whole wrap to one subagent — Agent tool, `subagent_type: general-purpose`, `model: haiku` — with the Steps below as its prompt. Relay its TLDR to the user. The main session's model is untouched.

**Delta re-runs:** if a wrap agent already ran tonight (this session), don't spawn a fresh agent or redo the full wrap — SendMessage the same agent with only what changed since its run, telling it to update journal/wiki status lines, redeploy, and return a short TLDR.

## Steps

1. **Collect** — from `~/Documents/Code`, for each repo with `.git`:
   `git log --oneline --since="12 hours ago"`. Skip repos with no commits.

2. **Journal** — follow `/journal` skill rules (`~/.claude/skills/journal/`):
   - Update the current week's entry in `~/Documents/Code/journal/_posts/` (one post per week, Friday/Sunday date; verify the weekday of today's date before picking the day section).
   - Add or extend today's day section with tonight's highlights in natural English. Update the apps summary.
   - Commit, deploy via `./scripts/deploy.sh` (never plain git push for deploy), and `git push`.

3. **Wiki** — update `~/Documents/Code/notes/notes/master.md`:
   - Bump the "Updated" date, refresh the Roadmap / Active Projects table and Ship Now list with current state, prune completed `- [x]` items.
   - Bullet style, no frontmatter, no emojis (see notes/CLAUDE.md).
   - Commit + push.

4. **Stale-memory check** — for each repo touched tonight, grep `~/.claude/projects/-Users-joshua/memory/project_*.md` for a matching memory file. If tonight's commits look like they change status the memory records (version bump, submission, ship, fix), flag it in the TLDR as "memory may be stale: <file>" — don't edit memory files yourself, just flag.

5. **TLDR** — end with a short bullet list of what landed in journal and wiki, the count of commits and repos touched tonight, any stale-memory flags (or "memory: nothing stale"), plus the journal URL.

6. **Notify** — call the `PushNotification` tool with the TLDR summary so the wrap is visible even if this ran in the background.

## Rules
- Work lean: batch git scans, no subagents.
- Don't invent work — only what git shows tonight.
