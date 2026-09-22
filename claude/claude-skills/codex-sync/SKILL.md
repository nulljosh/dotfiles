---
name: codex-sync
description: Sync Claude Code skills into Codex (~/.codex/skills symlinks) and make every AGENTS.md a symlink to its sibling CLAUDE.md (home, ~/.codex, every repo under ~/Documents/Code). Use when the user says /codex-sync, "sync skills with codex", "sync AGENTS.md", or adds a new skill / edits CLAUDE.md and wants Codex to see it.
---

# codex-sync

Run `~/.claude/skills/codex-sync/sync.sh`. Read the output.

- `link`/`relink`: done, nothing to do.
- `skip skill X (real dir in codex)`: Codex has its own copy. Leave it unless the user wants the Claude one to win, then `rm -rf ~/.codex/skills/X` and rerun.
- `DRIFT path`: a real AGENTS.md differs from its CLAUDE.md. Show the diff (`diff AGENTS.md CLAUDE.md`), merge anything Codex-only worth keeping into CLAUDE.md, then rerun with `--force`.

Symlinks mean it stays in sync forever after; rerun only when a new skill or repo appears.
