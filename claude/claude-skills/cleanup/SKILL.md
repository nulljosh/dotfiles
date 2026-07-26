---
name: cleanup
description: Free disk space hard — mole deep clean + Xcode/dev cache purge. Use when disk is low or the user invokes /cleanup.
---

# /cleanup — reclaim disk space

Run steps in order, report GB freed after each (`df -h /` before/after overall).

1. **Baseline**: `df -h /`.
2. **Mole deep clean** (installed via brew, repo at ~/Documents/Code/_external/mole):
   `mole clean --yes` (non-interactive). If flag unsupported, check `mole clean --help` first. Never `mole uninstall` anything without asking.
3. **Xcode**: `rm -rf ~/Library/Developer/Xcode/DerivedData/*` and `xcrun simctl delete unavailable`. Ask before touching `~/Library/Developer/Xcode/Archives` (contains shipped app archives).
4. **Package caches**: `brew cleanup --prune=all -s`; `npm cache clean --force`; `uv cache clean`; `pod cache clean --all` if present.
5. **Logs/temp**: `rm -rf ~/Library/Logs/*`; empty Trash (`rm -rf ~/.Trash/*`).
6. **Ollama**: `ollama list` — flag models unused >30 days to the user, don't auto-delete.
7. **Report**: final `df -h /`, total freed, and the top 5 remaining space hogs (`mole analyze` or `du -xh -d2 ~ 2>/dev/null | sort -hr | head`).

Never delete: user documents, ~/Documents/Code, iCloud data, App archives without asking.
