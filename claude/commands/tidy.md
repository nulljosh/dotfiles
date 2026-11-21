---
description: Tidy a repo's root so GitHub shows a short clean file list. Loose markdown and stray files go into folders, links get fixed, one commit. `/tidy [repo]`
---

Tidy the repo named in `$ARGUMENTS` (a folder under `~/Documents/Code`), or the current repo if none is named. Do it yourself, no subagents.

**The shape**
- Root keeps only: `README.md`, `CLAUDE.md` (and the `AGENTS.md` symlink to it), `LICENSE`, `roadmap.md` (`/work` reads it there), `icon.svg`, build and deploy config that tools need at the root (`wrangler.toml`, `package.json`, `project.yml`, `Makefile` and the like), and the code entry points the README tells people to run.
- `SECURITY.md` goes to `.github/`. GitHub still finds it there.
- Every other markdown file goes to `docs/` (WHITEPAPER, PRIVACY, MONEY, GTM, handoffs, notes).
- Loose images go to `screenshots/` or `brand/`, loose scripts to `scripts/`, launch post drafts to `launch/`.
- Delete what is dead: duplicate icon bundles the build does not use, old exports, empty files. Look at a file before deleting it and never delete data.

**Steps**
1. `git status` must be clean first. If it is not, stop and say what is uncommitted.
2. `git ls-files | grep -v /` lists the tracked root files. Move each one that does not belong with `git mv`.
3. Grep the whole repo (docs, code, CI workflows, the landing page) for every moved name and fix each path. A broken link is a failed tidy.
4. Run the repo's tests from its CLAUDE.md.
5. Add one line to the repo's CLAUDE.md saying where docs live, if it does not say so already.
6. One commit, `Tidy: loose files into folders`, then push.

Report in two lines: what moved and what was deleted.
