---
name: money
description: Walk the current project line by line and rate each function by actual user-facing value (high/medium/low/none). Use when the user wants a value audit, wants to find dead/low-value code, or invokes /money.
---

Scan the project rooted at the current working directory and produce a value audit. If the user passes a path/glob argument (e.g. `/money src/components`), scope the whole scan to that instead of the full repo — keeps large-repo runs cheap.

Steps:
1. Identify the scan root: the argument path if given, otherwise the project root (cwd). Skip node_modules, vendor, build/dist output, lockfiles, test/spec/fixture files, and anything in .gitignore.
2. Find functions/methods across source files (Grep for common declaration patterns per language: `function`, `def `, `func `, arrow functions assigned to consts, class methods, etc.). Don't use subagents — read files directly, batched, to keep this lean.
3. For each function, read enough surrounding context to judge: does a real user ever notice this function's effect (renders UI, changes output, changes behavior they experience) vs is it pure internal plumbing, boilerplate, config, dead code, or unused exports?
4. Output one line per function:
   `path/to/file.ext:LINE — functionName — value: high|medium|low|none — one-sentence why`
   - high: directly drives a feature/output the user sees or depends on
   - medium: supports a high-value path (helper, validation, formatting) but isn't itself the feature
   - low: internal scaffolding, rarely-exercised edge case, redundant wrapper
   - none: appears unused/dead, or duplicates another function
   When a function would otherwise be `none`/`low` but is large or complex (rough size/branching), bump it up one notch in the callout urgency — bigger dead weight matters more than a 3-line unused helper.
5. Before flagging anything `none`/`low`, check this project's `.money-keep` file (plain list of `path:functionName` lines) in the project root if it exists — skip flagging anything listed there, since the user already reviewed and intentionally kept it. If the user declines a suggested deletion during this run, append it to `.money-keep` so future runs don't re-flag it.
6. Group output by file. Keep each "why" to one sentence — no padding.
7. End with a short summary: total functions scanned, count at each value tier, and a callout list of `none`/`low` candidates worth removing or consolidating.
8. Before touching files, create/checkout a git branch named `money-audit-<date>` (skip if not a git repo — fall back to annotating in place with a warning that there's no branch safety net).
9. Annotate each flagged function in place: insert a one-line comment directly above the function signature using the language's native comment syntax, e.g. `// money: none — unused export, duplicates formatHeader()` or `# money: low — rarely-exercised edge case`. Only annotate `low` and `none` tier — don't clutter code that's already pulling its weight.
10. Show the user `git diff --stat` plus the chat summary, then ask whether to also delete the `none`-tier functions now. If approved, delete them, remove now-dead imports/exports, and re-run a quick build/typecheck if the project has one. If declined, append the declined items to `.money-keep`.
11. Leave everything on the `money-audit-<date>` branch — never auto-merge into main/master.

Keep the whole pass efficient: prefer Grep to enumerate candidates before reading file bodies, and avoid re-reading files already read.

## Usage awareness
This runs against one project at a time, not a fleet sweep — no subagents needed regardless of budget. If usage is tight and the user passed no scope, ask/default to a subdirectory (e.g. `src/`) rather than auditing the whole repo function-by-function in one pass.
