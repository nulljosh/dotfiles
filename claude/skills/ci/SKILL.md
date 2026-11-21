---
name: ci
description: Make a repo's CI as fast as possible without letting it lie. Audits the last 150 GitHub Actions runs into waiting/setup/running at p50/p95, then works toward a PR result in under 1 minute (p50) and 2 minutes (p95). The tools are a merge queue, Blacksmith runners, baked images, warm caches, bun install/lint/fmt/test, TypeScript 7, balanced shards, diff-based test selection, hk git hooks and per-job time budgets, with one measured PR per change. Use for /ci, "speed up CI", "CI is slow", "checks take forever", "flaky CI", "CI audit", "CI cost", "merge queue", "Blacksmith", "move to bun", "shard the tests", "test selection", "pre-commit/pre-push hooks", or whenever a GitHub Actions pipeline's speed, cost or honesty comes up, even if the user only says the checks take too long.
---

# Fast, honest CI

Joshua's CI brief, transcribed 2026-11-21, is below word for word. It is the spec. The notes after it explain how to carry it out, and where the two disagree, the brief wins. A repo's own AGENTS.md or CLAUDE.md wins over both on process, such as who merges.

## The brief

> Make this repo's CI as fast as possible without letting it lie. Target: a PR gets its result in under 1 minute at the median and under 2 at p95.
>
> Three rules outrank speed:
> - The full suite runs before anything reaches main, in a merge queue. Selection only narrows PR feedback.
> - Never hide failures. No retries, wider timeouts or skipped tests. A check that needs a retry has a bug; find it.
> - Never check less. Lint rules and required checks only stay or grow.
>
> First, audit. Pull the last 150 runs and split every job into waiting, setup and running, at p50 and p95. Fix the biggest bucket first.
>
> Then hit these budgets:
> - Waiting, under 5 seconds: move every job off GitHub's hosted runners to Blacksmith and keep machines warm. Cancel a branch's in-progress run when a new commit lands.
> - Setup, under 15 seconds: bake the toolchain into the runner image. Get PR cache hits above 95% by seeding caches from main, and cache node_modules itself. Use a blobless clone (`filter: blob:none`).
> - Slowest job, under 35 seconds. No required job waits on another.
> - Lint, under 1 second: `bun lint`. It reads the existing `.oxlintrc.json`. Turn on every rule you can.
> - Format, under 1 second: `bun fmt`.
> - Typecheck, under 5 seconds: `bun check` on TypeScript 7.
> - Tests, under 30 seconds per shard: `bun test`. Test files keep their `vitest` imports. Isolate modules, not processes, reset state after every file, and run in random order to flush out leaks.
> - Install and scripts: bun. Delete npm, yarn, pnpm, Prettier, ESLint, oxlint, Vitest and Jest. If a tool only exists in a canary, pin that exact canary.
> - Shards: buy cores before shards, match workers to cores, and give each shard its own throwaway database. Split any test file over 20 seconds. Balance shards from file times that main records on every full run, and prove the shards together ran every file.
> - Fewer tests, on evidence: for two weeks, log every test failure you fix as a caught regression or a change detector. Delete the files that only detect change and ban their patterns in AGENTS.md. Never delete tests for authorization, privacy, migrations or concurrency.
> - Shape: run lint, typecheck, build and tests in parallel. Fold the small checks into one job that lists every failure.
> - Selection: on PRs, run only the tests the diff can reach, and list the inputs that rerun everything. Then hide a real change from it on purpose and confirm CI goes red.
> - Local, under 9 seconds: hk hooks. Pre-commit formats and lints staged files; pre-push runs the same check as CI. A hook, not a line in AGENTS.md, because agents skip steps.
> - Keep it fast: fail any job that exceeds its budget.
>
> The tools above are defaults; you need a measured reason to keep an old one. Before each switch, run old and new side by side and list anything the new one misses.
>
> One small PR per change, with before and after numbers from real runs. Do everything you can without me first; bring anything that needs an account, a secret or a bigger bill as one list with expected monthly cost. End with total CI time and cost, before and after.

## How to carry it out

### 0. Get your bearings (no changes yet)

- Find the repo (`gh repo view`), its default branch, its GitHub plan, and whether this account is an admin. Merge queues and rulesets depend on both the plan and admin rights.
- Read AGENTS.md, CLAUDE.md, every file in `.github/workflows/`, the package manifests and lockfiles, and the test config. Workflow comments often explain why something is odd. Respect that history, but measure it again before you keep it.
- **Stack check.** The named tools (bun, TypeScript 7, oxlint config, Vitest imports) are for JS/TS. In a Swift, Python, C or QEMU repo, keep the three rules, the audit, the waiting, setup, shape, shards, selection, hooks and budget bullets. For each JS tool, choose the stack's fastest equivalent, measured side by side the same way.
- Tell the user the ETA in one line. The audit takes about 1 minute; the whole job is many PRs over days, and the test log runs for two weeks.

### 1. Audit and hunt for lies

```bash
mkdir -p ~/.claude/ci-audits/<owner>__<repo>
python3 ~/.claude/skills/ci/scripts/audit.py --runs 150 \
  --json ~/.claude/ci-audits/<owner>__<repo>/before-$(date +%F).json
```

The script prints PR time-to-result, the critical path (the last job to finish in each run) split into waiting, setup and running, a per-job table (`!` marks jobs over the 35 s budget), re-run attempts, and billable runner minutes per 30 days. Keep the JSON: it holds the "before" numbers for every later PR and for the final report. If step names hide the setup, for example a repo whose real work is named "setup-…", pass `--setup-pattern`.

Then grep the workflows and test config for anything that hides failures: retry actions or flags (`nick-fields/retry`, `retry:`, `retryTimes`, `--retry`), `continue-on-error`, `|| true`, `if: always()` on a step that should gate, `--passWithNoTests`, `.skip`/`.only`/`xit`/`test.todo`, raised `timeout-minutes`, and `paths-ignore` on required workflows. Each finding counts as a bug, so list it. Removing a retry can turn CI red. That red is the truth showing up: fix the flake underneath it.

Rule 1 check: does anything run the full suite before main? If PRs use path filters or selection and main only gets a deploy, nothing does yet. The merge queue fixes that.

### 2. One change at a time, biggest bucket first

For each change:

1. Branch `ci/<change>`. Keep the names of required checks stable. Branch protection matches on job names, so renaming a required job blocks every merge.
2. **Switching tools:** run old and new on the same commit and diff the results (see the table below). In the PR, list what the new tool misses. If it misses a lint rule or a check, either keep the old tool scoped to only what it uniquely covers, or find an equivalent. Never drop it, because checks only stay or grow.
3. Push and measure real runs: `audit.py --branch ci/<change> --runs 10 --compare <before.json>`. Five or more runs give a believable p50. Get p95 from main after the change lands. A re-run for measurement is fine. A re-run to turn red into green is a retry, so don't do it.
4. The PR body says what changed, which bucket it targets, a before/after table from real runs, what the new tool misses, and anything deferred to the list.
5. Landing: if the repo's AGENTS.md says PRs need approval (joshuatree's does), stop at the open PR and stack the next one on it. Otherwise follow Joshua's always-ship rule: merge once green, through the merge queue once it exists, then measure again before the next change.

| Switch | Compare on the same commit |
|---|---|
| npm/yarn/pnpm → bun | Resolved versions in the old lock vs `bun.lock` (bun migrates the old lockfile), lifecycle scripts bun blocks (`trustedDependencies`), and that the app actually builds and runs |
| ESLint/oxlint → `bun lint` | Diagnostics as file:line:rule sets. Every rule the old tool enforced that bun lint can't is a measured reason to keep that rule |
| Prettier → `bun fmt` | Check mode on both, the diff of formatted output, and file types Prettier covered that bun fmt doesn't (md, yaml, css…) |
| tsc → TypeScript 7 | Error lists on a clean commit and on a commit with a known type error |
| Vitest/Jest → `bun test` | Counts of passing, failing and skipped tests per file, and total test count (must be equal). List unsupported mock, timer, snapshot and coverage APIs |

Verify the tools exist before you plan around them. Run `bun lint --help`, `bun fmt --help` and `bun test --help`, first on stable and then on the latest canary. Install the canary into a throwaway `BUN_INSTALL` directory so the user's global bun doesn't change. Look for the exact flags for module isolation, random order and seed, worker count, and changed-file selection. When something exists only in a canary, pin that exact version string everywhere: `packageManager`, the CI setup step and the runner image. If a command exists nowhere, that is a measured reason to keep the old tool. Say so.

### 3. Notes on the budgets

- **Waiting.** Blacksmith needs its GitHub app installed and billing set up, so it goes on the list. Prepare the `runs-on` change in a PR, but don't merge it until the app is installed, or jobs will queue forever. Use cancel-in-progress for PRs only. Merge-queue and main runs are the source of truth and must finish:
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: ${{ github.event_name == 'pull_request' }}
  ```
- **Setup.** Bake the toolchain (pinned bun, TypeScript, hk, QEMU, Xcode, whatever the stack needs) into the runner or container image, and check what Blacksmith supports today. PRs can read caches saved on the base branch, so save caches on push to main and on a nightly schedule (caches expire after a week unused). Key `node_modules` on `hashFiles('bun.lock')`, the bun version and the OS/arch, and skip `bun install` on a hit. Measure the hit rate from logs, for example `gh run view <id> --log | grep -cE 'Cache restored|Cache not found'` across PR runs. For checkout, use `filter: blob:none`, plus `fetch-depth: 0` when selection needs the merge base.
- **Shape.** Required jobs have no `needs:` between them. Run one `checks` job that runs every small check to the end, prints every failure, then exits non-zero if any failed. Build and test shards run as their own parallel jobs.
- **Tests.** Print the random seed so any order-dependent failure can be reproduced. Otherwise random order turns into flakiness by design. Reset mocks, timers, env and DB state in a shared after-each-file hook.
- **Shards.** Buy cores before shards: use bigger runners first and set worker count to core count. Give each shard its own throwaway DB (a service container per job, or `CREATE DATABASE … TEMPLATE` per worker). On every full main run, save per-file timings as a JUnit report in the cache or artifacts. Plan shards greedily, longest file first, from the latest main timings, and give unknown files the median time. Split any file over 20 s. Proving full coverage needs no waiting job: the planner is deterministic, so each shard checks that the union of all shards' assignments equals the full file list, and that its own reporter output lists exactly the files it was assigned.
- **Fewer tests.** Start a log in the repo on day one. Use `.ci/test-failures.csv` with the columns `date, file, test, pr, verdict (regression|change-detector), why`. Save the review date (today + 14 days) in memory as an open thread. On that date, delete files that only ever detected change, add their patterns to a banned list in AGENTS.md, and never touch authorization, privacy, migration or concurrency tests.
- **Selection.** Selection applies only to `pull_request`. Use `merge_group` and pushes to main to run everything. Use the runner's native changed-file mode if it has one. Otherwise, walk the import graph backwards from the changed files to the test files. Keep the list of rerun-everything inputs in the repo, for example `.ci/full-run-inputs`. It covers lockfiles, manifests, toolchain pins, tsconfig, test setup and preload files, workflow files, the selection script itself, fixtures, env files, migrations and schema, codegen inputs, and anything loaded dynamically. Then run the honesty drill: on a scratch branch, break something for real through a path the graph can't see (a dynamic import, a JSON fixture, an env var or a SQL file) and confirm CI goes red. If it doesn't, fix the selection and run the drill again. Record the drill in the PR.
- **Local hooks.** Use hk (`hk init` → `hk.pkl`), and pin its version (mise if the repo uses it). Install it automatically from the `prepare` script. Pre-commit runs fmt and lint with fixes on staged files. Pre-push runs the same script CI runs. Time it with `time hk run pre-push` and keep it under 9 s.
- **Budget gate.** Wrap each check so that it fails with `::error::<check> took Xs, budget Ys` when it goes over. For the whole job, record `date +%s` into `$GITHUB_ENV` in the first step and compare it in the last step. This is a failure, not a timeout. Don't raise any `timeout-minutes`. Turn each gate on as soon as its job meets its budget, and never loosen it afterward. Turning every gate on at once in a repo far over budget would only block every merge. When a job is over budget, the fix is a faster job, not a looser budget.

### 4. The list and the final report

- **The list** (anything that needs Joshua): one line per item, saying what it is, why, its expected monthly cost and what it unblocks. Typical items are the Blacksmith app and billing, the merge-queue ruleset and required checks (admin or plan), secrets, and bigger runners. Compute the cost as monthly minutes from the audit × the current per-minute price. Look prices up at run time, not from memory.
- **The report:** the full numbers go in the PR bodies and in `~/.claude/ci-audits/<owner>__<repo>/report-<date>.md`. In chat, Joshua wants one line: `PR result p50 Xs→Ys, p95 Xs→Ys · CI N→M min/mo, $A→$B/mo · K PRs`, followed by the list.
