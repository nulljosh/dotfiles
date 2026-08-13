---
description: Manage a work queue across conversations — `/work <project> [task]` targets one repo under ~/Documents/Code and starts on it (optionally on one named task); `/work start [filter]` triages and dispatches pending tasks (PDFs in ~/Downloads, roadmap.md items); `/work stop [filter]` shelves this conversation's unfinished tasks back into roadmap.md; `/work dump [text]` ingests pasted brain dumps into roadmaps/wiki then starts working them. Replaces the old /tasks, /stash, and /braindump commands.
---

**Always run in lean mode**: go straight for the most-likely file via targeted grep/find, batch independent tool calls, no broad exploration, no recap at end. Each fork inherits this lean posture.

Mode: if the first word of "$ARGUMENTS" is `start`, `stop`, or `dump`, that's the mode and the rest is a filter (`start`/`stop`: case-insensitive substring match against filename/task text; empty = all) or the braindump text itself (`dump`). **Anything else → mode is `start` and the whole of "$ARGUMENTS" is the target spec** (see Target resolution) — never ask which mode. Empty "$ARGUMENTS" → `start` with no filter.

**With a filter**: work on that one matched group only — one fork, no parallel blast. Use this to limit scope: `/work epiphany`, `/work start invoice.pdf`, `/work spark`. If a *text* filter matches more than one group, pick the highest-priority match and say so — don't silently expand scope. (An ambiguous *project name* is different: ask, per Target resolution #4.)

## Target resolution (applies to `start` and `stop`)

1. Take the first word of the target spec and match it against directories in `~/Documents/Code`: exact → case-insensitive → substring.
2. No dir match → grep the project table in `~/Documents/Code/CLAUDE.md` for the word and use the repo named there. That file is the alias source (its canonical repo list + rename notes cover `portfolio`→`nulljosh.github.io`, `spark`→`sparkjar`, `books`→`spine`, `root`→`etyma`, `brief`/`casewright`→`litigate`) — don't keep a hardcoded map here, it goes stale.
3. Still nothing → treat the whole spec as a plain text filter (old behavior) and say so in the plan line.
4. Multiple substring matches → ask via AskUserQuestion. Never silently pick.
5. On a match, **that repo root is the working dir and the entire scope**: it replaces step 1's cwd/git-root/one-level-down search with `<repo>/roadmap.md`, `<repo>/README.md`, `<repo>/CLAUDE.md`, that project's wiki pages (`<project>.md`, `<project>-readme.md`), and only `~/Downloads` PDFs/notes whose name or content maps to that project. One fork, per the filter rule above.
6. **Inline task text** — if words remain after the project token, they are the task: skip triage/ordering (steps 2–3) and go straight to one fork on that repo with that task; tracking (6), cleanup (8), and commit (10) still apply. If the text closely matches an existing `- [ ]` roadmap line, work *that* line so it gets checked off instead of duplicated. Example: `/work epiphany fix the refresh spinner`.

**Where things land**: (1) genuinely trivial → banged out and committed immediately, never filed. (2) actionable but not done → target repo's `roadmap.md` (default bucket). (3) no `roadmap.md` in that repo → `README.md`/`CLAUDE.md` as fallback. (4) not actionable / no project owner (ideas, notes, personal info, open-ended research) → wiki (`wiki/pages/`), or the repo's roadmap.md under `## Someday / Explore` if it's project-scoped but not ready.

## dump — ingest a braindump, then start

1. **Collect**: If no dump text came with the command, ask the user to paste it. Multiple pastes are fine — keep collecting until they say done / "that's all".
2. **Organize**: Split the dump into discrete items and classify each:
   - **task** — actionable now (has a target project, or is standalone)
   - **idea** — someday/maybe, not actionable yet
   - **note** — pure information, no action
   Group tasks by project (match against repos under `~/Documents/Code`). Dedupe against existing roadmap.md and wiki entries. Vague items get filed as ideas with a one-line clarifying question attached — never dropped, never blocking. Don't lose anything: every line ends up as a task, idea, or note somewhere findable.
3. **File**: Tasks → the target project's roadmap file as `- [ ]` lines under `## Braindump <today's date>`, reusing that heading if it exists and matching the file's existing case (see step 8's case trap + heading rules; create the file with a `# <Repo> Roadmap` header if absent). Ideas/notes → wiki pages in `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/pages/`, appending to existing pages over creating new ones, one note per topic cluster. Preserve the user's wording — organize, don't rewrite. Commit + deploy the wiki (same push+open behavior as journal updates).
4. **Kick off**: Run the `start` flow below on the just-ingested items only (scope to their projects) — triage, group, and dispatch forks as usual.

## start — pick up pending work

0. **Check usage first** — run `~/.claude/scripts/usage.sh` before anything else. If it fails, skip silently. Otherwise gate on it:
   - any limit ≥90%, or severity not normal on the session limit → **do not dispatch**. Print the usage line and stop.
   - any limit ≥75%, or severity WARNING → **single fork, serial**. Work one group at a time; no parallel blast, regardless of how many groups exist.
   - otherwise → normal dispatch.
   Print the line verbatim in the plan (step 5) either way.
0b. **Export Notes** (skip entirely when a project target or inline task was given — the ask is already scoped, don't drag the whole Notes inbox in): run `~/.claude/skills/ingest/notes-list.sh` — plain `osascript` read of `plaintext of note`, one `.txt` per note in a tmp dir, printed as `<path>\t<noteId>`. No Chrome, no PDF hop. Those `.txt` files are a work source alongside PDFs below (triaged, banged out or filed to a roadmap). **Delete each source note only once its content is durably filed**, via `~/.claude/skills/ingest/notes-delete.sh <noteId>...` — never up front (a run that dies mid-way loses the note), and never hand-rolled `osascript` (not on PATH in every shell; the failure is silent). Deletion is **yours, in the main thread** — see step 9. A fork must not be the only thing responsible for clearing Notes.app.
1. **Scope**: Gather work from whichever sources exist:
   - Exported notes: the `.txt` files from step 0b, keep those matching the filter.
   - PDFs: `find ~/Downloads -iname "*.pdf"` (recurses into subfolders like `misc/` — a flat `ls ~/Downloads/*.pdf` misses those), keep files matching the filter.
   - Roadmap: find `roadmap.md`/`ROADMAP.md` in cwd, then git root, then one level down (`*/roadmap.md`) — or in the resolved repo root when a project target was given. **If cwd is not under `~/Documents/Code` and no project target was given** (e.g. invoked from `~`), that local search will find nothing real — fall back to sweeping every `~/Documents/Code/*/roadmap.md` for open `- [ ]` items. This is the common case for a bare `/work start`; don't let it silently return "just Notes/PDFs".
   - README/CLAUDE.md: same search pattern (including the same fallback sweep); collect open `- [ ]` items or an explicit TODO/Roadmap section matching the filter.
   - Wiki (Obsidian vault, `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/pages/`): check for open `- [ ]` items in entity/concept pages matching the filter, and also check `wiki/pages/security.md` for urgent items. The wiki carries more detail than repo docs — once a task/group's target project is known, read that project's `<project>.md` and `<project>-readme.md` pages (if present) in full as background context (state, prior blockers, decisions), not just for checkboxes. Scoped to matched project(s) only — never a full-wiki scan.
   If none of the above have anything, say so and stop.
2. **Triage**: For PDFs and exported notes, read the whole file (all pages, not just page 1 — a single page misses tasks/context further in) and infer the task + target project. For roadmap items, read as-is. Fold in the matched project's wiki context from step 1 — it often carries the blocked-reason or prior decision the roadmap line alone doesn't. Order by a two-key sort:
   - **Primary — project priority tier**:
     1. Live-product blockers/bugs (broken app, account recovery, missing asset on an already-shipped version)
     2. Explicit ship/App-Store pushes
     3. Active feature/design work on a project currently being iterated on
     4. Portfolio/meta (site copy, design reviews)
     5. Exploratory/research with no deadline
   - **Secondary — relevancy/actionability/ease**, used to break ties within a tier.
   - **Not a discrete action** (open-ended research, "explore X", "think about Y", no concrete next step): don't dispatch a fork for these. File them straight to the wiki (`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/pages/`, topic-appropriate page) as a note, or to the target project's roadmap.md under a `## Someday / Explore` heading if it's project-scoped but not actionable yet. Then treat as done for this run (checked off / PDF cleaned up per step 8) — shelving IS the completion for these.
   - **You (the orchestrator) own these end-to-end — no fork will.** Because no fork is dispatched, step 8's cleanup has no owner for them: file the content, `rm` the PDF, and delete the source Apple Note *in this turn, before you end it* (step 7's "end the turn immediately after dispatch" applies to forked groups only, never to these). Skipping this is the exact bug that leaves the Notes inbox full after a run that reported success.
3. **Group**: Cluster by target project/working directory. Within a group, keep tier order (serial — same files/repo). Across groups, independent.
4. *(usage — already checked in step 0.)*
5. **Plan**: Print one line per task — `N. source → task (project, tier) → dispatched to agent` — grouped by project, in execution order — followed by step 0's usage line verbatim, e.g. `Usage: session 8% | weekly_all 50% | weekly_scoped[Fable] 83% WARNING`, or `Usage: unknown` if the script failed. State which dispatch mode step 0's gate selected (stop / single-fork-serial / normal).
6. **Track**:
   - PDFs/notes: write a sidecar `<name>.progress.md` next to each file with `- [ ]` checkboxes, checking items off immediately as they complete (one-line note: files touched, verified or not). Resume from an existing sidecar instead of redoing finished tasks.
   - Roadmap items: the roadmap itself is the tracker — check off (`- [x]`) with a one-line note immediately as each completes.
7. **Execute (forked by default)**:
   - **One small task, one group** (typically the inline-task form): just do it in this turn — a fork costs more than the diff. Still do steps 6, 8, 9.
   - **With a filter**: launch exactly one fork for the single matched group. Stop there — do not expand to other groups.
   - **Without a filter (all)**: launch one `fork` per independent project group. If there are 2+ groups, launch all forks in parallel (single message, multiple Agent calls).
   - **Model routing**: real code work (edits, builds, ships, debugging) → `subagent_type: "fork"`. Forks always inherit the parent model; a `model` override is ignored, so don't pass one. Mechanical work — Notes triage, filing items to roadmap.md/wiki, step 8 shelving, step 3's "not a discrete action" items → `subagent_type: "general-purpose"` with `model: "haiku"`. These start cold, so give each an explicit one-paragraph brief: the exact file paths, the exact text to write, and the heading rules from step 8.
   - Each fork owns its group end-to-end: execution, tracking (step 6), cleanup (step 8), and commit (step 9) — fully self-contained, no orchestrator involvement after dispatch. Before acting, each fork re-reads its own project's wiki page(s) (`<project>.md`/`<project>-readme.md`) rather than relying solely on whatever context the orchestrating turn forwarded.
   - Within any fork: smallest correct diff, batch independent tool calls, one targeted verification per task (not full suites), terse output.
   - Usage watch: after finishing each task, re-run `~/.claude/scripts/usage.sh` (cheap — once per task, not more often). If the session limit hits ≥90%, or any limit reports severity WARNING and is rising fast, stop dispatching further tasks in this group after the current one, skip to step 8 for everything still queued (deferred note: "usage limit near cap: <usage line>"), and end the fork early rather than continuing through the rest of the group's queue.
   - Don't poll forks. The orchestrating turn ends immediately after dispatch — report "N group(s) dispatched" and stop; do not wait for completion notifications before ending the turn. Completion notifications arrive on their own later; that's what triggers step 11.
8. **Cleanup (PDFs/notes only, done by each fork for its own group)**: Never leave a PDF/sidecar sitting in Downloads. For any task not fully done+verified, append it as a TODO under `## From <source> (imported <date>)` in that project's roadmap file (or README.md/CLAUDE.md if no roadmap) — carry over enough of the source's actual content (not just a title) that the item is resumable cold: key details, numbers, names, blocked-reason. A one-line stub that drops the source content counts as data loss, not shelving. Then `rm` the PDF and its sidecar regardless of completion state. Forks do **not** delete Apple Notes — that happens in step 9, in the main thread.
   - **Filename case trap**: macOS is case-insensitive by default — `roadmap.md` and `ROADMAP.md` are the *same file*. Before writing, `ls` the repo root and match the existing case exactly. Never `cat file >> OTHERCASE` as a "merge" — on a case-insensitive volume that appends the file to itself.
   - **Heading idempotency**: if today's `## From …`/`## Braindump <date>`/`## Stashed <date>` heading already exists, append under it — don't add a second identical heading.
9. **Clear Notes.app (main thread, before dispatching or ending the turn)**: every note from step 0 is filed the moment its content is written to a roadmap/wiki page — that happens before forks run, so deletion does not wait on them. Run `~/.claude/skills/ingest/notes-delete.sh <noteId>...` yourself and read its `remaining_in_Notes=N` line. **N must be 0** before you report the sweep done; if it isn't, name the count and delete the stragglers. Skipping this step is exactly why "ingested your notes" kept leaving a full Notes inbox.
10. **Confirm (done by each fork for its own group)**: commit the roadmap/README/CLAUDE.md updates for that group's repo — `git diff` each file first and confirm every hunk is yours from this run, stage those paths explicitly (never `git add -A`), and never `git checkout`/`git restore` a file to "tidy" it (that silently discards uncommitted work you can't recover). Then end the fork with one terse summary: changes made, verification results, what got imported into the project doc. This summary arrives as that fork's own completion notification — there is no combined end-of-run summary from the orchestrator.

11. **Wrap up (main thread)**: once every dispatched fork/agent from step 7 has reported in, re-run `~/.claude/scripts/usage.sh` and invoke the `wrapup` skill once. Skip it — and say so in one line — if step 0's gate stopped the run, or if usage is now ≥90%. If no groups were dispatched at all (nothing pending), skip silently.

## stop — shelve unfinished work

1. **Scan**: Review this conversation for tasks that were identified but not completed+verified — bugs found, follow-ups noted, things explicitly deferred. Skip anything already finished.
2. **Group**: Cluster by target repo, inferred from file paths/project names discussed.
3. **File**: For each repo, find the roadmap file at its root — matching its existing case, `roadmap.md` vs `ROADMAP.md` are the same file on macOS (create with a `# <Repo> Roadmap` header if absent). Append under a `## Stashed <today's date>` heading, reusing that heading if it already exists, one `- [ ]` line per item, carrying over any blocked-reason/context needed to resume cold. Skip items already present as open lines.
4. **Never execute** — no code changes, no builds, no running tasks. Pure write.
5. **Confirm**: One line per repo touched, terse.
