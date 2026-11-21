---
name: qwen-overnight
description: Run qwen2.5-coder (via opencode) through a scoped task list overnight on an isolated branch, gated by build/tests. Use when the user asks to run the overnight local-model loop, or invokes /qwen-overnight.
---

# /qwen-overnight — free local-model overnight loop

Pilot repo: `~/Documents/Code/bank` (simple npm project, low stakes). Do not point this at Epiphany/Talli/Echo/Lexly/Healstack/Spark or any shipping app without the user explicitly re-approving — those are out of scope by default.

## Safety rails (non-negotiable)
- Only ever commits to a `qwen-overnight` branch. Never touch `main`/`master`, never `git push`.
- Never edit `.env*`, secrets, CI/deploy configs, or `.github/workflows`. Exclude these paths from every task prompt sent to opencode.
- Abort at start if: on battery power (`pmset -g batt | grep -q 'AC Power'` fails), or disk free < 5 GB (`df / `).
- Hard cap total runtime (default 6.5 hours) via `timeout`; hard cap per-task runtime (default 20 min) via `timeout`.

## Steps

1. **Setup**: `cd <repo>`, `git fetch`, create/reset `qwen-overnight` branch from current main tip (`git checkout -B qwen-overnight main`).

2. **Task list**: scan `roadmap.md`/`ROADMAP.md`/`README.md`/`TODO` markers in the repo (same grep pattern as the `progress` skill — `- [ ]` lines and `TODO`/`FIXME` comments). Pick 5-8 small, concrete tasks. Skip vague or large ones (leave those for Claude). If a repo has no explicit TODOs (e.g. `bank` today), fall back to a short manual seed list agreed with the user, or skip the run and report "nothing scoped."

3. **Loop**, for each task:
   - `timeout 1200 opencode run "<task, plus: never touch .env/secrets/CI files>"` in the repo dir.
   - Run the repo's test/build command (`npm test`, `npm run build`, `xcodebuild ...`, or whatever the repo already uses — detect from `package.json`/existing CI config, don't invent a new one).
   - Pass → `git add -A && git commit -m "[qwen] <task>"`.
   - Fail → `git checkout -- . && git clean -fd` (only within repo, never outside it), log failure, move on.
   - Append one line per task to `qwen-overnight.log` in the repo root: timestamp, task, pass/fail, commit hash if any.

4. Wrap the whole loop in `timeout 23400` (6.5h) so it can't run past morning regardless.

5. On completion (or timeout), print a short summary: tasks attempted, passed, failed, log file path, branch name. Do not merge or push — that's `/overnight-review`'s job.

## Usage awareness
This is already the zero-Claude-usage path (qwen2.5-coder via opencode does the work, not the Claude session) — that's the point of running it overnight instead of live. Keep it that way: don't add Claude subagent calls into the per-task loop, and check on progress via the log file, not by re-running the loop live.
