---
name: overnight-review
description: Review the qwen-overnight branch after an overnight local-model run — walk each commit, keep/fix/discard, merge good work into main. Use when the user asks to review last night's qwen run, or invokes /overnight-review.
---

# /overnight-review — morning cleanup after qwen-overnight

1. **Find the run**: default repo is `~/Documents/Code/bank` unless the user names another. Confirm the `qwen-overnight` branch exists and read `qwen-overnight.log` in full.

2. **Walk the diff**: `git log main..qwen-overnight --oneline`, then review each `[qwen]` commit's diff individually (`git show <hash>`). For each:
   - **Keep as-is** if correct and clean.
   - **Fix** if the idea is right but the code is sloppy/wrong in a fixable way — amend it yourself.
   - **Discard** (`git revert` or drop via rebase) if it's junk, duplicate, or not worth keeping.

3. **Merge**: fast-forward or squash-merge the kept/fixed commits into `main` (ask the user which they prefer if unclear — squash is usually cleaner for a batch of small qwen commits). Never force-push.

4. **Report a TLDR**: tasks attempted overnight (from the log), how many kept/fixed/discarded, and what's now on main. Delete the `qwen-overnight` branch only after a successful merge and with the user's go-ahead.

5. If the log shows 0 tasks passed or the branch doesn't exist, just say so — don't invent results.
