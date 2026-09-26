---
name: codex-sync
description: Sync Codex skills into Codex (~/.codex/skills symlinks) and make every AGENTS.md a symlink to its sibling AGENTS.md (home, ~/.codex, every repo under ~/Documents/Code). Use when the user says /codex-sync, "sync skills with codex", "sync AGENTS.md", or adds a new skill / edits AGENTS.md and wants Codex to see it.
---

# codex-sync

Run `~/.Codex/skills/codex-sync/sync.sh`. Read the output.

- `link`/`relink`: done, nothing to do.
- `skip skill X (real dir in codex)`: Codex has its own copy. Leave it unless the user wants the Codex one to win, then `rm -rf ~/.codex/skills/X` and rerun.
- `DRIFT path`: a real AGENTS.md differs from its AGENTS.md. Show the diff (`diff AGENTS.md AGENTS.md`), merge anything Codex-only worth keeping into AGENTS.md, then rerun with `--force`.

Symlinks mean it stays in sync forever after; rerun only when a new skill or repo appears.
