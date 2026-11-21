---
name: claude-md-refresh
description: Refresh a repo's CLAUDE.md (or ~/Documents/Code/CLAUDE.md) so it reflects current reality — prune stale status lines, fold in recent changes, keep it short. Use when asked to refresh/clean up CLAUDE.md or when its "Last updated" is weeks old.
---

# CLAUDE.md refresh

Target: the CLAUDE.md of the current repo, or `~/Documents/Code/CLAUDE.md` if run from the codebase root. Never touch `~/CLAUDE.md` (machine config) unless asked.

1. Read the file, note its "Last updated" date.
2. Gather reality: `git log --oneline --since="<last updated>"`, current roadmap.md, version in package.json/project.yml.
3. Edit in place:
   - Update stale statuses (versions, "next:" lines, submission states) to match git/roadmap.
   - Delete sections describing work that shipped and needs no ongoing guidance (old changelog prose belongs in git history, keep last 2-3 entries max).
   - Keep rules/conventions sections untouched unless provably wrong.
   - Bump "Last updated" to today.
4. Aim shorter than before, never longer without new rules. No emojis.
5. Commit `docs: refresh CLAUDE.md` and push if repo auto-push applies.

## Usage awareness
Single-file, single-repo edit — no subagents needed. When run against the codebase root, only pull `git log` since the file's own last-updated date, not full history, to keep the read small.
