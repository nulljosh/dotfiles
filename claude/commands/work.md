---
description: Manage a work queue across conversations — `/work start [filter]` triages and dispatches pending tasks (PDFs in ~/Downloads, roadmap.md items); `/work stop [filter]` shelves this conversation's unfinished tasks back into roadmap.md. Replaces the old /tasks and /stash commands.
---

Mode: first word of "$ARGUMENTS" must be `start` or `stop`. Filter: the rest of "$ARGUMENTS" (case-insensitive match against filename/task text; empty = all). If neither `start` nor `stop` is given, ask which mode before doing anything.

## start — pick up pending work

1. **Scope**: Gather work from whichever sources exist:
   - PDFs: `ls ~/Downloads/*.pdf`, keep files matching the filter.
   - Roadmap: find `roadmap.md`/`ROADMAP.md` in cwd, then git root, then one level down (`*/roadmap.md`); collect open `- [ ]` (or plain list) items matching the filter.
   If neither source has anything, say so and stop.
2. **Triage**: For PDFs, read page 1 only and infer the task + target project. For roadmap items, read as-is. Order by a two-key sort:
   - **Primary — project priority tier**:
     1. Live-product blockers/bugs (broken app, account recovery, missing asset on an already-shipped version)
     2. Explicit ship/App-Store pushes
     3. Active feature/design work on a project currently being iterated on
     4. Portfolio/meta (site copy, design reviews)
     5. Exploratory/research with no deadline
   - **Secondary — relevancy/actionability/ease**, used to break ties within a tier.
3. **Group**: Cluster by target project/working directory. Within a group, keep tier order (serial — same files/repo). Across groups, independent.
4. **Plan**: Print one line per task — `N. source → task (project, tier) → dispatched to agent` — grouped by project, in execution order.
5. **Track**:
   - PDFs: write a sidecar `<name>.progress.md` next to each file with `- [ ]` checkboxes, checking items off immediately as they complete (one-line note: files touched, verified or not). Resume from an existing sidecar instead of redoing finished tasks.
   - Roadmap items: the roadmap itself is the tracker — check off (`- [x]`) with a one-line note immediately as each completes.
6. **Execute (always async, always forked)**:
   - Launch one `fork` per independent project group, always — even when there's only one group total. If there are 2+ groups, launch all forks in parallel (single message, multiple Agent calls).
   - Each fork owns its group end-to-end: execution, tracking (step 5), cleanup (step 7), and commit (step 8) — fully self-contained, no orchestrator involvement after dispatch.
   - Within any fork: smallest correct diff, batch independent tool calls, one targeted verification per task (not full suites), terse output.
   - Don't poll forks. The orchestrating turn ends immediately after dispatch — report "N group(s) dispatched" and stop; do not wait for completion notifications before ending the turn.
7. **Cleanup (PDFs only, done by each fork for its own group)**: Never leave a PDF/sidecar sitting in Downloads. For any task not fully done+verified, append it as a TODO under `## From <file>.pdf (imported <date>)` in that project's roadmap.md (or README.md/CLAUDE.md if no roadmap) — one line, carrying over the blocked-reason note. Then `rm` the PDF and its sidecar regardless of completion state. Skip deletion only if the task couldn't be matched to any project.
8. **Confirm (done by each fork for its own group)**: `git add`+commit the roadmap/README/CLAUDE.md updates for that group's repo, then end the fork with one terse summary: changes made, verification results, what got imported into the project doc. This summary arrives as that fork's own completion notification — there is no combined end-of-run summary from the orchestrator.

## stop — shelve unfinished work

1. **Scan**: Review this conversation for tasks that were identified but not completed+verified — bugs found, follow-ups noted, things explicitly deferred. Skip anything already finished.
2. **Group**: Cluster by target repo, inferred from file paths/project names discussed.
3. **File**: For each repo, find `roadmap.md` at its root (create with a `# <Repo> Roadmap` header if absent). Append under a `## Stashed <today's date>` heading, one `- [ ]` line per item, carrying over any blocked-reason/context needed to resume cold.
4. **Never execute** — no code changes, no builds, no running tasks. Pure write.
5. **Confirm**: One line per repo touched, terse.
