---
name: changelog-generator
description: Generate or update a CHANGELOG.md entry from recent git commits in user-facing language. Use when asked to update the changelog, or after a batch of commits before a release/deploy, for any repo under ~/Documents/Code that already maintains CHANGELOG.md.
---

# Changelog generation from commits

Most repos under [[project_codebase_location]] (echo, dose, wiretext, roost,
grapher, nimble, spark, nyc, books, dotfiles, nulljosh.github.io) already keep a
hand-written `CHANGELOG.md`. Use this to draft new entries instead of writing
from scratch.

## Workflow
1. Find the last changelog entry's date/version, then
   `git log --oneline <last-tag-or-date>..HEAD` to scope the diff.
2. Translate commits into user-facing language — skip "fix typo" / "wip" /
   pure refactor commits unless they fixed a visible bug.
3. Group into Added / Changed / Fixed sections matching the existing file's
   heading style (check the file first — don't impose Keep-a-Changelog format
   if the repo uses something simpler).
4. Bump the version number consistent with the repo's existing scheme (check
   package.json / Info.plist / existing changelog headers for precedent).
5. Insert at the top, don't rewrite history.

## What to skip
- Don't invent features that aren't in the commits.
- Don't add a changelog entry for a repo that doesn't already have one unless
  asked — not every project wants one.
