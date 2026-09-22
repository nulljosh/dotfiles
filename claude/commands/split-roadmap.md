---
description: Split a project's open roadmap items into parallel subagents, routed by the roadmap's own [Model] tags
argument-hint: [optional: repo path (defaults to current dir) and/or max agent count, e.g. "~/Documents/Code/joshuatree 3"]
---

Split this project's open roadmap queue across parallel subagents, one model per tag, the way tonight's Calendar + syscall-ABI split worked for joshuatree.

## 1. Find the roadmap and the legend

Look for `roadmap.md` in $ARGUMENTS (a path) or the current directory. Read it in full, plus `CLAUDE.md` in the same repo if present. Find the model-routing legend if one exists (a paragraph explaining what `[Haiku]`/`[Sonnet]`/`[Fable]`/`[Joshua]`-style tags mean for this specific project — tag names and meanings vary by project, don't assume joshuatree's own legend applies elsewhere). If no legend exists, infer reasonable routing from the item's own description (mechanical/glue work → cheap model; deep/subtle/privilege/protocol/exact-byte-layout work → a stronger reasoning model; a real product/design/scope call with no code shape yet → not a coding task at all) and say so.

## 2. Pick candidates, don't just take every open item

For each open (`- [ ] ...`) roadmap item:
- Skip anything tagged as a pure human/design call (joshuatree calls this `[Joshua]`) — surface these to the user directly in your final summary instead of spawning an agent for them.
- Skip anything that structurally needs a real display, real mouse/keyboard interaction, or physical hardware to verify — note this to the user rather than mis-scoping a remote agent that can't actually verify its own work (this was a real, hard-learned lesson: don't send GUI-dependent work to an isolated remote agent).
- Prefer items that are independent of each other (won't touch the same core files/functions in conflicting ways). If two strong candidates likely touch the same file, say so and pick the safer pairing, or tell the fresh agents explicitly to check `git log`/rebase if they land concurrently (see the prompt template below).

## 3. Respect a real budget

Default to **3 agents running simultaneously** (direct standing approval), unless $ARGUMENTS specifies a different count — but the real ceiling is adaptive, not fixed; see step 4's budget ladder, which governs count too, not just model choice. Before launching, tell the user which items you picked and why, and how many agents, in one short line — don't ask permission with a full question, just state the plan and proceed (matching this user's own "you decide" standing preference), unless something is genuinely ambiguous (e.g. more candidates than the budget allows and no clear way to rank them).

## 4. Model routing: three real tiers, chosen by task nature AND real remaining budget

Direct standing instruction: route to exactly three models, **Sonnet, Opus, and Fable** — Haiku is out of rotation for this command, forgotten on purpose, don't use it here even if a project's own roadmap legend has a Haiku tier. If a project's roadmap tags an item as its own "cheap/mechanical" tier (joshuatree calls this `[Haiku]`), remap it to **Sonnet**, the closest real fit among the three, don't skip the item and don't spawn a fourth model.

By task nature — the starting pick before the budget ladder below can downgrade it:
- **Sonnet**: the general case — real feature work with a clear existing pattern already in the codebase to follow, glue between pieces that already exist, straightforward/mechanical work a project's own legend would call cheap.
- **Opus**: a task that's large or ambiguous enough to need real judgment calls along the way (design decisions with no single obviously-correct shape, a refactor touching many call sites where getting the boundaries right matters more than raw depth on one subtle mechanism) — reach for this when the hard part is *breadth and judgment*, not one deep subtle trap.
- **Fable**: a project's own "subtly wrong, still looks fine, still boots" tier (joshuatree calls this `[Fable]` directly) — privilege/security boundaries, exact wire-protocol or register-frame layouts, memory-model changes, anything where the failure mode is silent and only shows up later. Reach for this when the hard part is *depth on one narrow, easy-to-get-quietly-wrong mechanism*.

If a task doesn't obviously fit one of the three, say which two you're weighing and why you picked the one you did — don't default silently.

**The budget ladder** (direct standing instruction, so `/loop` can run continuously without ever hard-stopping): before every launch, read the session's own usage-hook line (`session X% · weekly_all Y% · weekly_scoped[Fable] Z%`, present in context each turn) and let it downgrade the picks above:
- `weekly_all` **< 60%**: no downgrade, use the task-nature pick as-is, 3 agents fine.
- `weekly_all` **60-80%**: still 3 agents, but only use Opus when the task-nature pick genuinely needs it (not just "would be nice"); Fable stays available for real subtle-risk items.
- `weekly_all` **80-92%**: drop to **2 agents**. Sonnet only — remap anything picked as Opus/Fable to Sonnet, note the downgrade honestly in that item's roadmap entry (this project's own "tags are a starting guess, retag if it turns out harder" convention already covers exactly this). If a task is too subtle to trust to Sonnet at this budget, don't spawn it at all yet — leave it queued rather than risk a wrong-but-confident Fable-shaped answer from a downgraded model.
- `weekly_all` **> 92%**, or `session` **> 90%**: drop to **1 agent**, and this is the one place Haiku comes back into rotation (direct request): route it to **`haiku`**, but ONLY hand it a genuinely mechanical item (a rename, a doc-drift fix, a generated-file refresh, a checkbox tick), never real feature or kernel work at that budget. Nothing mechanical left → spawn nothing, leave the queue for the reset.
- Separately, regardless of `weekly_all`: if `weekly_scoped[Fable]` itself is high (roughly **> 80%** of its own pool), stop routing to Fable specifically even if the general budget has room — remap those items to Opus (preferred, still handles breadth/depth reasonably) or Sonnet, same honest note-the-downgrade rule.
- Re-check the usage line every time this command runs, including every time a completed agent is replaced in the standing "always keep N running" loop — the ladder can move down (or back up, if a weekly window just reset) between one launch and the next.

Use `isolation: "remote"` for every one of these (independent, headlessly-verifiable work is exactly what remote agents are for) unless the item genuinely needs to run on this local machine (say why, and run it yourself inline instead of spawning).

## 5. Write real prompts, not one-liners

A fresh agent has zero context. Each prompt must include, at minimum:
- The repo path and an instruction to read `CLAUDE.md`/`roadmap.md` in full first.
- The exact roadmap item text (quote it), plus a pointer to any other roadmap entries it explicitly depends on or should read for pattern/precedent.
- Concrete file-level guidance: which existing file is the closest pattern to follow (name it, tell the agent to read it in full before writing anything), which files need to change, what NOT to attempt (explicit non-goals keep scope from creeping).
- The project's real verification bar (its own `check.sh`/test script, what "done" actually means here, not "it compiles").
- What to do when finished: version bump if the project uses one, a real changelog/roadmap entry in the project's own house style, commit, push. Tell it explicitly not to deploy/touch anything outside its own scoped task.
- A note that other agents may be working concurrently in the same repo: check `git log` and rebase carefully before finishing if needed.

Launch all agents for this pass in one message (parallel tool calls), not sequentially.

## 6. Report

One short status line per agent launched (what it's building, which model), then hand control back — don't wait on them, don't fabricate progress. When a completion notification arrives later (a separate turn), summarize what actually shipped.

## 7. Retro: the loop improves itself from its own agents' reports

Every completion report is evidence about the loop, not just the feature. Before launching the replacement agent, read the report specifically for friction and drift, and fold real fixes back into the loop's own rules right then, not "later":
- **Environment friction** (the agent had to work around something to even build/test: missing generated files in a fresh sandbox, a sibling repo it couldn't reach, a tool that wasn't installed) → fix the root cause in the repo if possible (real example: `drivers/app_*.h` were gitignored and regenerated from sibling repos that don't exist in a sandbox, so the first agent hand-copied them; fix was to commit them). If it can't be fixed at the root, add it to the prompt template in step 5 so the next agent is told upfront.
- **Rule/practice drift** (the agent notices a documented rule nobody's following: "CLAUDE.md says tag every version, tags stopped at v27") → fix the drift itself (backfill), then decide whether the rule or the practice was wrong and update whichever one is.
- **Prompt gaps** (the agent asked the wrong question, over-scoped, under-scoped, or guessed at something the prompt should have stated) → tighten the step-5 template.
- **Routing signal** (a task tagged for one tier turned out to need another; an agent on Fable did trivially easy work, or one on Sonnet hit a subtle trap) → retag the item class in the project's own legend and adjust step 4's task-nature guidance.
- **Verification gaps** (the agent's own verification was weaker than the project's bar, or it invented a verification method worth keeping, like the Calendar agent's exhaustive date-math harness) → raise the bar in the prompt template, or capture the new method in the project's `CLAUDE.md` so every future agent gets it.

Keep each retro fix small and concrete. The point is a loop that gets tighter every cycle from real evidence, not a growing pile of rules nobody reads.
