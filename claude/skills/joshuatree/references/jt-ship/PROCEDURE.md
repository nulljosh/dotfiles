---
name: jt-ship
description: Ship a Joshua Tree branch end to end: rebase on main, bump VERSION, refresh landing facts, run the local suite, flip the draft PR ready, merge on green with a bounded poll. Use for /jt-ship, "ship this PR", "merge when green" or any Joshua Tree PR that is built and needs to land.
---

Repo: ~/Documents/Code/joshuatree. Headless only, never open QEMU or a browser. Hand the long waits to one Haiku subagent, never a backgrounded Bash.

## Steps

1. `git fetch origin && git rebase origin/main`. Resolve conflicts keeping both sides; VERSION always goes to one step above origin/main's (PATCH for a fix, MINOR for a new capability). Mirror to `landing/version.txt`.
2. `python3 tools/gen/inject-landing-facts.py`. The pre-push hook refuses stale facts.
3. `pkill -f qemu-system-i386 || true`, then `./tools/ci-local.sh`. Two known tripwires: the god-file guard (`tools/checks/godfile-check.sh`, kernel.c has a line ceiling, new code goes in a header, dead code comes out) and the version-bump check (any non-Markdown change needs VERSION above main).
4. Commit short, plain, Joshua voice. `git push --no-verify`. `gh pr create --draft` if there is no PR yet; drafts do not run CI, so no failure emails while iterating.
5. Local suite green: `gh pr ready <N>`. Poll `gh pr checks <N>` every 60 s for at most 20 minutes. Ignore CodeRabbit entirely, it stays pending forever. Never `--watch`.
6. Every other check green: `gh pr merge <N> --squash --delete-branch`. Release and deploy run themselves from main.
7. If GitHub never starts a run on a pushed commit, `gh pr close <N> && gh pr reopen <N>` fires it.

Report in 3 lines: merged or not, why not, next step.
