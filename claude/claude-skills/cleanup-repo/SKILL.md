---
name: cleanup-repo
description: Audit a repo's file/directory structure for junk — duplicate/nested copies, checked-in generated artifacts (xcodeproj, build output), orphaned directories, stale roadmap/README items pointing at retired tools, and CI tests left broken by removed features. Use when a repo "feels messy", has "loose files", or is invoked as /cleanup-repo [path]. Distinct from /lint (code quality inside files) — this is repo hygiene, structure and dead weight at the file-tree level.
---

Structure hygiene, not code quality. Work like a lazy senior dev: confirm before deleting, delete more than you add.

## Arguments

Optional: a path to one repo. Default: current repo. For a fleet-wide pass, see `fleet-beautify` instead — this skill is single-repo.

## What to check, in order

1. **Uncommitted work first.** `git status`. If dirty, stop and tell the user — don't clean around in-progress changes.

2. **Duplicate/nested copies.** Look for a subdirectory containing what looks like a second copy of the repo itself (README.md, index.html, CLAUDE.md, roadmap.md all present one level down) — usually the result of an old `git subtree`/merge gone wrong. Grep the rest of the repo (docs, code, CI) for any reference to that path before deleting. If nothing references it, it's dead weight.

3. **Checked-in generated artifacts.** For Apple projects: `git ls-files | grep -E "\.xcodeproj|\.xcworkspace"` — house standard is xcodegen `project.yml` only, the generated project stays local and gitignored. If a `project.yml` sibling exists, the checked-in project is redundant: `git rm -r` it, add `*.xcodeproj/` and `*.xcworkspace/` to `.gitignore`, then regenerate locally (`xcodegen generate --spec <dir>/project.yml --project <dir>`) to confirm nothing breaks. Same idea for other stacks: `node_modules/`, `dist/`, `build/`, `.next/` checked into git instead of ignored.

4. **Orphaned directories.** Any top-level dir not referenced by README, CLAUDE.md, CI workflows, or the app's own code. Don't assume — grep for the directory name across the repo first. A dir that's a legit but small standalone thing is not junk; a dir nothing points to and nothing builds is. Known legit shapes that look like clutter but aren't: a **redirect stub** (single `index.html`/`privacy.html` that meta-refreshes to a real subdomain, e.g. `notes/` → notes.heyitsmejosh.com, `echo/` → echo.heyitsmejosh.com — these exist so the path resolves on GitHub Pages before bouncing); a **retired-themes archive** (old design-token files kept for reference, not loaded by anything current — confirm via grep that nothing `<link>`s them); a **dev-only native wrapper** (`ios/`/`watchos/` companion app that is explicitly not shipping to the App Store — ask if unsure rather than assuming it's dead). Document what you find in CLAUDE.md's Directories section so "what is this folder" stops being a recurring question — that's cheaper than re-investigating it next pass.

5. **Loose root assets that should be grouped.** A single-purpose cluster of files sitting bare in root (PWA manifest + favicon + apple-touch-icon + maskable icons + og-image is the classic case) reads as clutter even when every file is legit. Group them into one subdirectory (e.g. `pwa/`) and update every reference: HTML `<link>`/`<meta>` tags, the manifest's own icon paths, and a service worker's precache list if one exists. Do NOT move: anything a crawler or platform requires at a fixed root path (`robots.txt`, `sitemap.xml`, `CNAME`, `.nojekyll`), a stylesheet other repos consume by absolute URL (check `~/Documents/Code/CLAUDE.md` for a shared token file other sites link to — moving it breaks every consumer), or a file a README image tag points at by relative path. When in doubt, grep for the exact filename across the whole fleet (`~/Documents/Code`), not just the one repo, before relocating.

6. **Stale roadmap/README items.** Read README.md's roadmap section and roadmap.md if present. Flag anything referencing a tool/service the fleet no longer uses (check `~/Documents/Code/CLAUDE.md`'s Stack section for what's current — e.g. Vercel is retired in favor of Cloudflare) or work that's clearly already shipped per git log. Remove or update, don't leave stale asks sitting in the roadmap.

7. **CI health.** If there's a test script or GitHub Actions workflow, run it locally. A failing test after a recent feature-removal commit usually means the test wasn't updated when the feature was cut — check `git log` for what changed right before the test started failing. Fix by updating/removing the stale assertion, never by weakening a test that's catching a real bug. After any file move (step 5), rerun the suite before committing — a test that greps HTML for local hrefs/srcs will catch a missed reference update.

## Rules

- Grep before delete. Never remove a path without confirming nothing references it.
- One commit per logical cleanup (duplicate removal, CI fix, roadmap prune) with a message explaining *why* it was junk, not just what got deleted.
- Push after each repo's cleanup is confirmed working (tests green, or no tests to break).
- Don't invent problems. A clean repo gets a one-line "already clean" and you move on.
- If cleanup touches something the `~/.claude/projects/-Users-joshua/memory/` files describe, note it, but memory updates aren't this skill's job.

## Report

One-liner per finding: what was junk, why it was safe to remove, whether CI passes now, whether pushed. Skip anything not found — no padding.
