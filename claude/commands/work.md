---
description: Manage a work queue across conversations — `/work dump [text]` ingests pasted brain dumps into roadmaps/wiki then starts working them; `/work start [filter]` triages and dispatches pending tasks (PDFs in ~/Downloads, roadmap.md items); `/work stop [filter]` shelves this conversation's unfinished tasks back into roadmap.md. Replaces the old /tasks, /stash, and /braindump commands.
---

**Always run in lean mode**: go straight for the most-likely file via targeted grep/find, batch independent tool calls, no broad exploration, no recap at end. Each fork inherits this lean posture.

Mode: first word of "$ARGUMENTS" must be `start`, `stop`, or `dump`. For `start`/`stop`, the rest of "$ARGUMENTS" is a filter (case-insensitive substring match against filename/task text; empty = all). For `dump`, the rest is the braindump text itself, not a filter. If no valid mode is given, ask which mode before doing anything.

**With a filter**: work on that one matched group only — one fork, no parallel blast. Use this to limit scope: `/work start epiphany`, `/work start invoice.pdf`, `/work start spark`. If the filter matches more than one group, pick the highest-priority match and say so — don't silently expand scope.

**Where things land**: (1) genuinely trivial → banged out and committed immediately, never filed. (2) actionable but not done → target repo's `roadmap.md` (default bucket). (3) no `roadmap.md` in that repo → `README.md`/`CLAUDE.md` as fallback. (4) not actionable / no project owner (ideas, notes, personal info, open-ended research) → wiki (`wiki/pages/`), or the repo's roadmap.md under `## Someday / Explore` if it's project-scoped but not ready.

## dump — ingest a braindump, then start

1. **Collect**: If no dump text came with the command, ask the user to paste it. Multiple pastes are fine — keep collecting until they say done / "that's all".
2. **Organize**: Split the dump into discrete items and classify each:
   - **task** — actionable now (has a target project, or is standalone)
   - **idea** — someday/maybe, not actionable yet
   - **note** — pure information, no action
   Group tasks by project (match against repos under `~/Documents/Code`). Dedupe against existing roadmap.md and wiki entries. Vague items get filed as ideas with a one-line clarifying question attached — never dropped, never blocking. Don't lose anything: every line ends up as a task, idea, or note somewhere findable.
3. **File**: Tasks → the target project's roadmap.md as `- [ ]` lines under `## Braindump <today's date>` (create the file with a `# <Repo> Roadmap` header if absent). Ideas/notes → wiki pages in `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/pages/`, appending to existing pages over creating new ones, one note per topic cluster. Preserve the user's wording — organize, don't rewrite. Commit + deploy the wiki (same push+open behavior as journal updates).
4. **Kick off**: Run the `start` flow below on the just-ingested items only (scope to their projects) — triage, group, and dispatch forks as usual.

## start — pick up pending work

0. **Export Notes**: run `~/.claude/skills/notes-inbox/notes-export.sh Notes ~/Downloads --delete-source` — headlessly (osascript read + `chrome --headless --print-to-pdf`, no UI automation) dumps every Apple Note as a PDF into `~/Downloads` and deletes the source note once its PDF is written. They flow through the normal PDF pipeline below (triaged, banged out or filed to a roadmap, then cleaned up) — no separate notes flow.
1. **Scope**: Gather work from whichever sources exist:
   - PDFs: `find ~/Downloads -iname "*.pdf"` (recurses into subfolders like `misc/` — a flat `ls ~/Downloads/*.pdf` misses those), keep files matching the filter.
   - Roadmap: find `roadmap.md`/`ROADMAP.md` in cwd, then git root, then one level down (`*/roadmap.md`); collect open `- [ ]` (or plain list) items matching the filter.
   - README/CLAUDE.md: same search pattern (cwd, git root, one level down); collect open `- [ ]` items or an explicit TODO/Roadmap section matching the filter.
   - Wiki (Obsidian vault): check `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/pages/` for open `- [ ]` items in entity/concept pages matching the filter. Also check `wiki/pages/security.md` for urgent items.
   If none of the above have anything, say so and stop.
2. **Triage**: For PDFs, read the whole file (all pages, not just page 1 — a single page misses tasks/context further in) and infer the task + target project. For roadmap items, read as-is. Order by a two-key sort:
   - **Primary — project priority tier**:
     1. Live-product blockers/bugs (broken app, account recovery, missing asset on an already-shipped version)
     2. Explicit ship/App-Store pushes
     3. Active feature/design work on a project currently being iterated on
     4. Portfolio/meta (site copy, design reviews)
     5. Exploratory/research with no deadline
   - **Secondary — relevancy/actionability/ease**, used to break ties within a tier.
   - **Not a discrete action** (open-ended research, "explore X", "think about Y", no concrete next step): don't dispatch a fork for these. File them straight to the wiki (`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/pages/`, topic-appropriate page) as a note, or to the target project's roadmap.md under a `## Someday / Explore` heading if it's project-scoped but not actionable yet. Then treat as done for this run (checked off / PDF cleaned up per step 8) — shelving IS the completion for these.
3. **Group**: Cluster by target project/working directory. Within a group, keep tier order (serial — same files/repo). Across groups, independent.
4. **Check usage**: run `~/.claude/scripts/usage.sh` (real plan-limit percentages from the OAuth usage endpoint). If it fails, skip silently — don't block the rest of `/work` on it.
5. **Plan**: Print one line per task — `N. source → task (project, tier) → dispatched to agent` — grouped by project, in execution order — followed by the usage line verbatim, e.g. `Usage: session 8% | weekly_all 50% | weekly_scoped[Fable] 83% WARNING`, or `Usage: unknown` if the script failed. If any limit is ≥90% or severity is not normal on the session limit, warn before dispatching and prefer a single fork over a parallel blast.
6. **Track**:
   - PDFs: write a sidecar `<name>.progress.md` next to each file with `- [ ]` checkboxes, checking items off immediately as they complete (one-line note: files touched, verified or not). Resume from an existing sidecar instead of redoing finished tasks.
   - Roadmap items: the roadmap itself is the tracker — check off (`- [x]`) with a one-line note immediately as each completes.
7. **Execute (always async, always forked)**:
   - **With a filter**: launch exactly one fork for the single matched group. Stop there — do not expand to other groups.
   - **Without a filter (all)**: launch one `fork` per independent project group. If there are 2+ groups, launch all forks in parallel (single message, multiple Agent calls).
   - Each fork owns its group end-to-end: execution, tracking (step 6), cleanup (step 8), and commit (step 9) — fully self-contained, no orchestrator involvement after dispatch.
   - Within any fork: smallest correct diff, batch independent tool calls, one targeted verification per task (not full suites), terse output.
   - Usage watch: after finishing each task, re-run `~/.claude/scripts/usage.sh` (cheap — once per task, not more often). If the session limit hits ≥90%, or any limit reports severity WARNING and is rising fast, stop dispatching further tasks in this group after the current one, skip to step 8 for everything still queued (deferred note: "usage limit near cap: <usage line>"), and end the fork early rather than continuing through the rest of the group's queue.
   - Don't poll forks. The orchestrating turn ends immediately after dispatch — report "N group(s) dispatched" and stop; do not wait for completion notifications before ending the turn.
8. **Cleanup (PDFs only, done by each fork for its own group)**: Never leave a PDF/sidecar sitting in Downloads. For any task not fully done+verified, append it as a TODO under `## From <file>.pdf (imported <date>)` in that project's roadmap.md (or README.md/CLAUDE.md if no roadmap) — carry over enough of the PDF's actual content (not just a title) that the item is resumable cold: key details, numbers, names, blocked-reason. A one-line stub that drops the source content counts as data loss, not shelving. Then `rm` the PDF and its sidecar regardless of completion state. Skip deletion only if the task couldn't be matched to any project.
9. **Confirm (done by each fork for its own group)**: `git add`+commit the roadmap/README/CLAUDE.md updates for that group's repo, then end the fork with one terse summary: changes made, verification results, what got imported into the project doc. This summary arrives as that fork's own completion notification — there is no combined end-of-run summary from the orchestrator.

## stop — shelve unfinished work

1. **Scan**: Review this conversation for tasks that were identified but not completed+verified — bugs found, follow-ups noted, things explicitly deferred. Skip anything already finished.
2. **Group**: Cluster by target repo, inferred from file paths/project names discussed.
3. **File**: For each repo, find `roadmap.md` at its root (create with a `# <Repo> Roadmap` header if absent). Append under a `## Stashed <today's date>` heading, one `- [ ]` line per item, carrying over any blocked-reason/context needed to resume cold.
4. **Never execute** — no code changes, no builds, no running tasks. Pure write.
5. **Confirm**: One line per repo touched, terse.
