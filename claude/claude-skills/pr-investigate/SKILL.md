---
name: pr-investigate
description: Investigate a GitHub pull request end to end — what problem it fixes, how, and whether the fix is good — using gh CLI. Use when the user pastes a PR URL/number and wants it explained, summarized, or reviewed for learning purposes (e.g. "look at this PR", "what did this fix", "how do I write PRs like this").
---

# PR Investigate

Learn from someone else's PR: what broke, how they fixed it, is the fix actually good.

## Steps

1. `gh pr view <url-or-number> --repo <owner/repo> --json title,body,author,state,additions,deletions,files,commits` — get the shape of it.
2. `gh pr diff <url-or-number> --repo <owner/repo>` — read the actual patch.
3. If the PR references an issue, `gh issue view <n> --repo <owner/repo>` for the original bug report/symptom.
4. Read the touched files' surrounding context if the diff alone doesn't explain the "why" (`gh api` or just clone/fetch if repo is local under `~/Documents/Code`).

## Report

Keep it short, in this shape:
- **Problem**: what was broken, in plain terms (symptom + root cause if visible).
- **Fix**: what changed, file by file if more than one file, one line each.
- **Why it works**: the mechanism, not a restatement of the diff.
- **Worth copying?**: one line — is this a pattern worth reusing elsewhere, or a one-off.

No line-by-line diff narration. If asked to also fix something similar in another repo, do that as a separate follow-up, not bundled into the summary.
