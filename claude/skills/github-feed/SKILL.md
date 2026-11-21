---
name: github-feed
description: Pull the user's recent GitHub activity feed — new PRs, merges, releases, issues across repos they own/watch/collaborate on — and summarize each briefly. Use when the user says "check github", "what's new on github", "github feed", or /github-feed.
---

# GitHub Feed

## Steps

1. `gh api /users/<login>/received_events --paginate=false --jq '.[:20] | .[] | {type,repo:.repo.name,created_at,actor:.actor.login}'` for the raw activity stream (received_events = activity from repos/people they follow; use `/users/<login>/events` for their own actions instead if that's what's wanted — ask if ambiguous, otherwise default to received_events).
2. For repos the user owns directly under `~/Documents/Code`, also check recent PRs/releases with `gh pr list --repo <owner/repo> --state all --limit 5` and `gh release list --repo <owner/repo> --limit 3`.
3. Dedupe by repo, group by type (PR, release, issue, push).

## Report

TLDR only unless asked for depth: one line per item — `repo — what happened — one clause on why it matters`. No raw JSON, no per-commit detail. If nothing new, say so in one line.
