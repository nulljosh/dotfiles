---
name: checkpoint
description: Checkpoint, not a wrap — the session is never "done", we take breaks. Refresh the journal with the work so far, ingest current project state into the notes wiki, deploy both, then keep going. Runs in the background via a haiku subagent so the main session is never blocked. Use when the user says /checkpoint, /checkmark, /wrapup, /wrap-up, /goodnight, /goodbye, pastes a Claude usage screenshot, or asks to save progress.
---

# /checkpoint — save the game, keep playing

One command to log the work so far everywhere. This is a checkpoint, not an ending: never report it as "session over", never say goodbye, never stop the loop. Log, deploy, hand a five-line TLDR back, and the session continues exactly where it was.

**Usage-screenshot trigger:** if the user pastes a screenshot of Claude usage/limits (usage bar, "5-hour limit", token/cost meter) instead of typing a command, that screenshot IS the signal — no confirmation needed. Switch immediately to lean mode (invoke the `lean` skill) and trim scope before running the Steps below: finish only the in-flight step of any current task the shortest way possible (no new scope, no exploration, no subagents/simulator/Chrome beyond what wrapup itself needs), commit-or-stash rather than polish, and keep the report to ≤5 lines (shipped / parked / resume point). Do not start anything new while it runs; resume the moment the subagent reports back.

**Run in the background:** delegate the whole checkpoint to one subagent (`run_in_background: true` if the Agent tool offers it, so the main conversation keeps working) — Agent tool, `subagent_type: general-purpose`, `model: haiku` — with the Steps below as its prompt. Relay its TLDR to the user. The main session's model is untouched.

**Delta re-runs:** if a wrap agent already ran in this session, don't spawn a fresh agent or redo the full wrap — SendMessage the same agent with only what changed since its run, telling it to update journal/wiki status lines, redeploy, and return a short TLDR.

## Steps

1. **Collect** — from `~/Documents/Code`, for each repo with `.git`:
   `git log --oneline --since="12 hours ago"`. Skip repos with no commits.

2. **Journal** — read `~/.claude/skills/journal/SKILL.md` in full first, especially the Voice section, before writing anything:
   - Update the newest post in `~/Documents/Code/journal/_posts/`. Read `journal/CLAUDE.md` first. **The journal holds 3-5 big posts, one per few months. Never create a new post from a checkpoint** unless the newest post's `date:` is over ~2 months old. It got to 11 posts on 2026-09-20 because every checkpoint started a new one.
   - Posts are `categories: journal quarterly`: flowing prose paragraphs, no day headings, 1200-word cap. Fold new work into the paragraph it belongs to. If the post is at the cap, tighten existing wording to make room; do not drop facts and do not start a new file. A full post is never a reason to skip the journal; "at capacity, captured in wiki instead" is a failed checkpoint (happened 2026-09-20). If the post already has `##` day headings, append inside today's heading and never add a second heading for the same day.
   - Write first person, like Joshua recapping his day to a friend — not third person, not a changelog. 2-5 sentences, pick what actually mattered, skip commit hashes/bundle IDs/error codes unless the story is genuinely about that error. See journal SKILL.md's Voice section for a bad/good example before writing.
   - **Run `python3 scripts/lint-posts.py` and fix every violation before committing.** It caps length, bans commit hashes, version and build numbers, em dashes and lists inside day sections, and rejects a second heading for the same weekday. `deploy.sh` runs it too and will refuse to publish. The session dump you were handed is long; the entry is not. Compress it, do not transcribe it.
   - Commit, deploy via `./scripts/deploy.sh` (never plain git push for deploy), and `git push`.

3. **Obsidian vault** (`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/`). Its own step because it is the one that gets skipped: it is not a git repo, so nothing downstream notices when it is missed, and updating master.md is NOT a substitute. Skipped on 2026-09-20 for exactly that reason.
   - Read `wiki/CLAUDE.md`. For every repo from step 1 with real commits (ignore fleet-wide boilerplate like launch-kit or docs refreshes unless that IS the story), open `wiki/pages/<repo>.md`, update its current-state lines and bump `updated:` in the frontmatter. Page names do not always match repo names (`nulljosh.github.io` lives at `portfolio-site.md`), so grep `wiki/index.md` for the repo before deciding a page is missing; only then create one and add it to the index. Only claim a page in the TLDR if you actually edited it.
   - Update `wiki/pages/_overview.md` only where an entity page's state changed what it says.
   - Append one entry to `wiki/log.md`: `## [YYYY-MM-DD] checkpoint | <title>`, naming every page touched as `[[page]]`.
   - **Gate, run it and paste the output into the TLDR:** `cd "<vault>" && grep -c "^## \[$(date +%F)\] checkpoint" log.md && find pages -name '*.md' -mmin -30 | wc -l`. Both numbers must be above zero. If either is zero the checkpoint is not done; go back and do the step.

4. **Notes and roadmaps** — update `~/Documents/Code/notes/notes/master.md`:
   - `master.md`: bump the "Updated" date, refresh the Roadmap / Active Projects table and Ship Now list with current state, prune completed `- [x]` items.
   - Run `~/.claude/skills/wiki-refresh/SKILL.md` (read it in full) across all three surfaces it covers (Obsidian vault, master.md, `~/Documents/Code/CLAUDE.md`): catch stale app names in index/current-state sections left over from any rename. Only touch current-state/index lines, never past wrap-log entries or entity-page changelog/history sections.
   - **Roadmap sweep**: for each repo touched this session, `grep -c "^- \[ \]"` its `roadmap.md`/`ROADMAP.md` and spot-check open items against this session's commits/memory files — check off (`- [x]`) anything actually shipped, don't just leave it stale. Small drift check, not a full re-audit.
   - **Roadmap prune**: after the sweep above, run the `roadmap-prune` skill on each repo touched this session (`python3 ~/.claude/skills/roadmap-prune/scripts/prune.py <repo>/roadmap.md`) to strip the `- [x]` items back out — history lives in git log, the roadmap file should only ever show what's still open. Commit the prune as part of that repo's wiki-wrap commit.
   - Bullet style, no frontmatter, no emojis (see notes/CLAUDE.md).
   - Commit + push.

5. **GitHub issues** — mirror each touched repo's roadmap into its issue tracker so open work is official, not just a markdown checklist:
   `python3 ~/.claude/skills/checkpoint/scripts/roadmap-to-issues.py <repo>` (add `--dry-run` first if the repo has never been synced, and eyeball the titles). It opens an issue per open top-level roadmap item (labelled `bug` or `enhancement`), closes issues whose item got checked off, and skips anything already there. Repos with no `gh` remote are skipped automatically. Run this BEFORE the roadmap prune in step 4, since prune deletes the `- [x]` lines the closer needs.

6. **Stale-memory check** — for each repo touched this session, grep `~/.claude/projects/-Users-joshua/memory/project_*.md` for a matching memory file. If this session's commits change status the memory records (version bump, submission, ship, fix, or code the memory describes as removed/added that a commit touches again), edit that memory file directly to correct it — update the stale claim, keep the `**Why:**`/`**How to apply:**` structure intact, note what changed. Then list it in the TLDR as "memory fixed: <file>".

6b. **Loop handoff** — if a `/loop` is live this session, or a touched repo already has one, rewrite that repo's `docs/LOOP-HANDOFF.md` (create it if missing). Joshua Tree's is the reference, copy its shape: H1 `<Name> loop handoff (<date>, <time of day>)`, then `## What the loop is`, `## Where things stand`, `## Next, in order`, `## Restart prompt` with the full `/loop ...` prompt in a code fence, ready to paste. Current state only, no history, house voice, no em dashes. Make sure the repo's `CLAUDE.md` has a `## The loop` section pointing at it. Commit with that repo's checkpoint commit, staged by exact path. TLDR line: "loop: <repo>/docs/LOOP-HANDOFF.md" or "loop: none live".

7. **TLDR** — one line per surface, every surface, in this order: journal, vault (pages touched + the gate's two numbers), master.md, roadmaps, issues opened/closed, loop file, memory fixes (or "memory: nothing stale"). Then commit and repo counts and the journal URL. A surface that was not done says `SKIPPED: <why>`. Never leave a surface out of the list; a missing line reads as done when it was not.

8. **Notify** — call the `PushNotification` tool with the TLDR summary so the wrap is visible even if this ran in the background.

9. **Never close the session.** No `kill`, no exit, ever, from the main session or the subagent. Once the TLDR is relayed and the journal is clean (`git -C ~/Documents/Code/journal status --porcelain` empty), end with the TLDR. Joshua closes Claude Code himself. Auto-close ended two sessions mid-wrap on 2026-09-25.

## Rules
- Work lean: batch git scans, no subagents.
- Don't invent work — only what git shows for this window.

## Usage awareness
If usage is high going into a wrap, still do steps 1-2 (journal is the durable record) but trim the vault, master.md and roadmap-prune work to repos actually touched this session — skip the fleet-wide entity-page pass across untouched apps. Trimming means fewer pages, never zero: the step 3 gate still has to pass. Memory-fix check (step 6) stays scoped to touched repos already, so it's cheap regardless.
