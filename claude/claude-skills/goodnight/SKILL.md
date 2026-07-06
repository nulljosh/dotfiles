---
name: goodnight
description: End-of-night wrap — refresh the weekly journal with today's work, ingest current project state into the notes wiki, deploy both. Alias for /night — same nightly wrap. Use when the user says /goodnight, /night, or asks to wrap up the night.
---

# /goodnight — nightly wrap (alias for /night)

One command to log tonight's work everywhere.

**Run cheap:** delegate the whole wrap to one subagent — Agent tool, `subagent_type: general-purpose`, `model: haiku` — with the Steps below as its prompt. Relay its TLDR to the user. The main session's model is untouched.

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

4. **TLDR** — end with a short bullet list of what landed in journal and wiki, plus the journal URL.

## Rules
- Work lean: batch git scans, no subagents.
- Don't invent work — only what git shows tonight.
