---
name: feature-audit
description: Inventory every user-facing feature of a project as a user story with expected behavior derived from code, track status in a canonical CSV, then loop through testing each story, documenting errors, fixing them, and retesting. Use when the user wants a full feature audit, user-story coverage, or invokes /feature-audit.
---

Canonical spreadsheet lives at `~/Documents/Code/_feature_audit/<project>.csv`, with a master `~/Documents/Code/_feature_audit/index.csv` (columns: project, last_updated, total, pass, fail, blocked).

Per-project CSV columns: `feature, user_story, expected_behavior, source_ref, status, error, fix_attempts`.
`status` is one of: `untested`, `pass`, `fail`, `blocked`.

Run exactly one phase per invocation — re-read the CSV first to resume where the last run left off rather than starting over.

## Phase 1 — Inventory
1. Read the project's CLAUDE.md/README/roadmap.md for context, then scan source for distinct user-facing features (routes/views/controllers for web apps; SwiftUI Views/Features for iOS/macOS).
2. For each feature not already a row in the CSV, add one: `user_story` as "As a user, I can <action> so that <benefit>"; `expected_behavior` derived from the actual code path (not assumed); `source_ref` as `file:line`; `status` = `untested`.
3. Update `index.csv` for this project.

## Phase 2 — Test loop
1. For every row with `status = untested`, exercise the behavior — use the project's `run` skill or `ios-simulator` skill if applicable, otherwise hit the code path/API directly.
2. Set `status` to `pass` or `fail`. On `fail`, fill `error` with what actually happened vs. what was expected.
3. Do not fix anything in this phase.

## Phase 3 — Fix loop
1. For every row with `status = fail`, fix the underlying bug with the smallest correct diff — no refactors, no unrelated cleanup.
2. Retest only that story. On success set `status = pass`; on repeat failure increment `fix_attempts` and update `error`.
3. If `fix_attempts` reaches 2 and it still fails, set `status = blocked` and stop touching it — don't loop forever on one story.

## Notes
- Keep edits lean: minimal exploration, no subagents unless a project is large enough that parallel inventory across unrelated modules is clearly faster.
- Skip projects with no real end-user features (pure config/dotfiles/reference repos).

## Usage awareness
Phases are already checkpointed via the CSV, so lean on that when budget is tight: run only Phase 1 (inventory) or Phase 2 (test) in a session rather than pushing through all three. When testing many stories, batch several into one pass instead of one subagent per story, and stop at `fix_attempts = 2` per the rule above rather than grinding a blocked story. Prioritize projects with the most `untested`/`fail` rows over exhaustively re-touching already-`pass` ones.
