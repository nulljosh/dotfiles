---
name: money
description: Lay out the money plan for the current project (price, rail, cost, next step, million/billion/trillion tiers), update its MONEY.md and the GTM.md row, and grill Joshua on anything unknown. `/money audit` runs the old function-by-function value audit instead.
---

# /money, the money plan for this project

Default job: say how THIS project makes money, write it down, and ask about what is still a guess. Not a code audit. For the old function audit, run `/money audit [path]` (its steps are at the bottom).

## Steps

1. **Find the project.** Root of the cwd repo. Read its `MONEY.md`, `README.md`, `CLAUDE.md`, `roadmap.md`, and its row in `~/Documents/Code/GTM.md` (grep the name in the app table, the pricing table and the ASC ledger).
2. **Check the real state, never memory.** App Store price: `asc pricing current --app <ASC id>`. Web rail: grep for Stripe in the repo. Running costs: grep for paid APIs (ElevenLabs, Workers AI, Resend, Anthropic) and any caps on them. Hardware: only for Joshua Tree, see `/jt-monetization`.
3. **Write the plan** in this shape, short, house voice, no em dashes, no emojis:
   - **Price and rail**: what a customer pays and where. House rule: every app is free or $1. Stripe $1 on web, App Store $0.99 on iPhone and Mac, paid upfront is a full unlock, no IAP on top, no tips, subscriptions or tiers.
   - **What is actually sold**: the one thing the dollar pays for. If it is content someone else owns, say so and name the risk.
   - **Cost to serve**: per-user and monthly worst case, and the cap that bounds it.
   - **Where we are**: dated lines of what shipped that moves money.
   - **Next**: the single next money step.
   - **Million, billion, trillion**: three tiers, each one concrete sentence, no invented user counts or revenue ("no number yet" beats a made-up one).
4. **Update the files as you go.** Write `MONEY.md` in the repo (create it if missing), fix the project's row in `GTM.md` (price, rail, status, why), commit each by exact path and push. Keep both in sync; the ledger and the repo must not disagree.
5. **Grill, don't guess.** Anything you could not verify, or any call that is Joshua's (price, what is sold, a new rail, a copyright or privacy risk, a conflict with the $1 rule), becomes a question. Use AskUserQuestion, 1 to 4 questions, one recommended option first, only the ones whose answer changes what you write. If everything is verified and consistent, skip the grill and say so in one line. Never ask what a probe can answer.
6. **Report** in under 8 lines: price, rail, what is sold, cost cap, next step, what you asked or changed.

## Don'ts
- Don't change a live price or touch Stripe or App Store Connect without Joshua saying so in chat. Laying out the plan is free; flipping it is not.
- Don't propose tiers, tips, subscriptions or anything above $1.
- Don't invent numbers.

## `/money audit [path]` (the old function audit)

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
