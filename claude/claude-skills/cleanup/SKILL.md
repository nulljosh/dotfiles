---
name: cleanup
description: Free disk space hard — mole deep clean + Xcode/dev cache purge. Use when disk is low, the user asks for a quick cleanup, or invokes /cleanup.
---

# /cleanup — reclaim disk space

## Quick mode (default, "quick cleanup" / low disk)

One backgrounded command, ~10 GB in under 2 min (measured 2026-09-06: 11 → 21 GB free). Run `df -h /` before and after; it's the only report that matters.

```
rm -rf ~/Library/Developer/Xcode/DerivedData/*
brew cleanup --prune=all -q; rm -rf ~/Library/Caches/Homebrew/*
npm cache clean --force
rm -rf ~/Library/Caches/pip ~/Library/Caches/Yarn ~/Library/Caches/com.apple.dt.Xcode
xcrun simctl delete unavailable
rm -rf ~/.Trash/*      # fish: may say "no matches found" when already empty, harmless
```

Wins by size on this machine: DerivedData (6 GB), brew cache + prune (2.4 GB + 2.3 GB), npm cache (1.6 GB). Everything else is noise; skip it in quick mode.

Run it with `run_in_background` and a 300 s timeout so `brew cleanup` doesn't stall the turn.

## Full mode (only when quick mode isn't enough)

1. **Mole deep clean** (brew, repo at ~/Documents/Code/_external/mole): `mole clean --dry-run` to preview. NO `--yes` flag, NO headless mode — it blocks on a TTY prompt. Tell the user to run it in a terminal themselves.
2. **Simulators**: `du` on ~/Library/Developer/CoreSimulator/Devices reports 40+ GB but that's APFS clones; erasing every simulator reclaims ~1 GB. Not worth it.
3. **Package caches**: `uv cache clean`; `pod cache clean --all` if present.
4. **Logs**: `rm -rf ~/Library/Logs/*`.
5. **Ollama**: `ollama list` — flag models unused >30 days, don't auto-delete.
6. **Report**: top 5 remaining hogs via `du -xh -d2 ~ 2>/dev/null | sort -hr | head`.

## Never delete
User documents, ~/Documents/Code, iCloud data. `~/Library/Developer/Xcode/Archives` holds shipped app archives — ask first (it was wiped without asking on 2026-09-06; don't repeat that).
