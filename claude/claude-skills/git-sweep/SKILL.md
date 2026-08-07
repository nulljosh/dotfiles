---
name: git-sweep
description: Sweep every git repo under ~/Documents/Code for unpushed commits or uncommitted changes, and fix them (push, or diff+commit+push). Use when asked to check the codebase for stale/unpushed work, or invokes /git-sweep.
---

# /git-sweep — repo-wide git hygiene

1. **Scan**: loop every repo under `~/Documents/Code`, for each report `git status --porcelain` (dirty) and `git rev-list --count @{u}..HEAD` (ahead of upstream). Fish note: don't name a var `$status`, it's read-only — use `st`.

2. **Push ahead-only repos** immediately, no confirmation (per standing auto-push preference). If a push fails (e.g. "Repository not found"), flag it — don't dig further, that's a real problem for the user (renamed/deleted remote).

3. **Dirty repos**: for each, `git diff` to see the actual change before touching anything.
   - Untracked build/artifact junk (`.build/`, `.asc/`, `DerivedData`, screenshots, xcarchive) — leave alone, don't commit.
   - Real tracked changes (roadmap.md updates, config/signing tweaks, etc.) — stage the specific changed files (never `-A`), commit with a message describing the actual diff, push.
   - Anything touching `.env`/credentials — flag, don't commit.

4. **Verify**: re-run the scan loop, confirm clean except intentionally-skipped untracked artifacts.

5. **Report**: short TLDR — what got pushed, what got committed+pushed, what's still broken (e.g. dead remote) needing the user's attention.
