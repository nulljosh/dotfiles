---
name: pr-bang
description: Loop through a repo's open pull requests, easiest-to-hardest and most-to-least relevant, and actually review/fix/merge them. Use when the user says "bang out these PRs", "go through open PRs", "clear the PR queue", or /pr-bang <owner/repo>.
---

# pr-bang

Work through a GitHub repo's open PRs, not just the ones on our own fork.

## 1. Scope the queue

```
gh pr list --repo <owner/repo> --state open --limit 100 \
  --json number,title,url,additions,deletions,changedFiles,createdAt,author
```

Rank by:
- **Size** (additions+deletions+changedFiles) — smaller = easier. This is the primary sort.
- **Relevance** — core functionality / bug fixes / high-value features first; cosmetic or niche feature PRs last.
- Skip draft PRs unless asked.

**Default batch size: 1-2 PRs per run, not the whole queue.** Work the top of the ranked list, stop, report, and let the user review before continuing. Increase batch size only once the user has seen a few iterations and says to go bigger.

## 2. Check standing before touching anything

```
gh api user --jq .login
gh pr view <n> --repo <owner/repo> --json author,maintainerCanModify,mergeable,mergeStateStatus,statusCheckRollup
```

If we are not a maintainer/collaborator on the repo, we **cannot merge or push to other people's branches**. In that case "solve" means:
- Check out the PR locally (`gh pr checkout <n> --repo <owner/repo>`), build/test it.
- Fix real bugs, conflicts, or CI failures we find, but land the fix as our own PR (from our fork) or as a review comment/suggestion — never force-push someone else's branch.
- Leave an honest `gh pr review` (approve / request-changes / comment) explaining what's broken or what we fixed.
- If it's clean and small, approve it outright.

If we ARE a maintainer/collaborator, prefer to actually fix-and-merge: checkout, fix, push to the PR branch, merge via `gh pr merge`.

## 3. Loop

For each PR, easiest first:
1. `gh pr checkout <n> --repo <owner/repo>`
2. Build/test (`npm run check`, `cargo test`, etc. — check package.json/Cargo.toml first).
3. Read the diff (`gh pr diff <n>`) for correctness issues.
4. Fix what you can within your access level (see step 2).
5. `gh pr review <n> --repo <owner/repo> --approve|--request-changes|--comment --body "..."`
6. Move to the next PR. Return to main branch between each.

## 4. Report

Keep a running tally: reviewed / approved / fixed / blocked-on-conflicts / skipped-too-large. Report it plainly at the end, no essay.
