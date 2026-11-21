---
name: docs
description: Bring one repo's documentation to 100 percent and keep it there: every markdown file in docs/ (except README, CLAUDE.md, AGENTS.md symlink), stale numbers refreshed, WHITEPAPER and roadmap current, docstring coverage 100, links valid, CI green, 0 issues, 0 stale branches, PRs merged. Use for /docs, "refresh the docs", "documentation 100%", "tidy the markdown".
---

# /docs

Runs on one repo at a time (the cwd, or the one named). Smallest slice that leaves it clean; no new doc files unless one is missing from the list below.

## 1. Layout
- Markdown lives in `docs/` (results and notes in subfolders). Root keeps only `README.md`, `CLAUDE.md`, and `AGENTS.md` as a symlink to CLAUDE.md. `SKILL.md` stays where its skill needs it.
- Moving a file means fixing every reference in the same pass: `grep -rIn` the old name across code, scripts, CI, hooks, web and other docs; update stats/coverage checks that look for the path.

## 2. Content
- Refresh stale numbers from the code, never from memory: version (`VERSION`/tags), tool or feature counts, test counts, scores. Grep each across README, CLAUDE.md, WHITEPAPER, roadmap, FAQ, HF/store cards, ARCHITECTURE.
- WHITEPAPER: how it works in one page, matches what ships today. Roadmap: header paragraph current, shipped items checked off or pruned, next major named. ARCHITECTURE: a row for every source file and every doc.
- House voice: plain English, no em dashes, no AI words, no emojis, no bullet walls where a sentence works.

## 3. Checks
- The repo's docs-coverage gate (docstrings) at 100, links resolve, the fast gate passes.
- Commit by exact path, push, then `gh run list`: test, release and deploy green. A red run is fixed before anything else.

## 4. Hygiene
- `gh issue list`: 0 open. Issues that only mirror roadmap items are closed with a comment pointing at docs/roadmap.md; real bugs get fixed or stay.
- `gh pr list`: 0 open. Green PRs merge, stale drafts get closed with a reason.
- Remote branches: delete the merged and the superseded; list any unmerged branch with unique commits for Joshua instead of deleting it.
- Tag/release current with VERSION.

## Rules
Never print a token. Never delete data or an unmerged branch without saying so. Report in two lines: what changed, what is left.
