---
name: project-sync
description: Sync the portfolio Work list (nulljosh.github.io/index.html) with actual project state under ~/Documents/Code. Use when asked to refresh/sync portfolio projects, or after shipping/renaming/retiring an app.
---

# project-sync

Keep the `#work` section of `~/Documents/Code/nulljosh.github.io/index.html` truthful against the codebase.

## Steps
1. Read the current `<section class="list" id="work">` list in `index.html`.
2. Build the ground truth: for each repo under `~/Documents/Code` (skip `_external`, `dotfiles`, `labs`, `scripts`, experiments), determine from its CLAUDE.md/README:
   - Is it live (deployed web URL and/or on the App Store)? Only live projects belong on the list — the intro says "everything below is live".
   - Current display name (watch for renames: brief→Casewright, journal→Inkpress, dose→Healstack, lingo/parlay→Lexly).
   - Platforms actually shipped (Web / iOS / macOS / watchOS) — cross-check subdirs (`ios/`, `macos/`, `watchos/`) and App Store status; don't list a platform that isn't shipped.
   - Live URL (`<name>.heyitsmejosh.com` convention; verify with a quick `curl -sI`).
3. Diff and apply: add missing live projects (keep the existing `<li>` markup pattern and year-marker convention — `<span class="year">` only on the first entry of each year), remove dead/retired ones, fix names/platforms/URLs.
4. Keep edits minimal — this page has no build step; deploy is push to `main`.
5. Commit + push (auto-push authorized). One-line summary of adds/removes/edits.
