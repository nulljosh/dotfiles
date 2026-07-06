---
name: xcode-cleanup
description: Free disk space by clearing Xcode DerivedData and unavailable simulators. Use when the user asks to clean Xcode builds, clear old simulator builds, free dev disk space, or invokes /xcode-cleanup.
---

# Xcode cleanup

1. Show what will be reclaimed:
   ```sh
   df -h / | tail -1
   du -sh ~/Library/Developer/Xcode/DerivedData 2>/dev/null
   ```
2. Clean:
   ```sh
   xcrun simctl delete unavailable
   rm -rf ~/Library/Developer/Xcode/DerivedData
   ```
3. Report space freed (`df -h /` again, diff against step 1).

Notes:
- DerivedData is pure cache — safe to delete anytime; next build just takes longer.
- If the user wants old apps gone from simulator home screens: `xcrun simctl shutdown all; xcrun simctl erase all` (factory-resets every sim — wipes all installed apps and their data).
- Old simulator *runtimes* (multi-GB) must be removed in Xcode → Settings → Platforms, or `xcrun simctl runtime delete <id>`; only do this on request.
