---
name: lint
description: Clean up the codebase — remove dead code, simplify over-complicated logic, fix style inconsistencies, and tidy up anything that's just noise. Use when asked to lint, clean up, or tidy the code, or invoked as /lint.
---

Clean up the codebase. Not a bug hunt, not a security audit — just making the code smaller, cleaner, and easier to read. Work like a lazy senior dev: delete more than you add.

## Arguments

Optional: a path or glob to scope the cleanup. Default: whole project.

## What to do

1. **Grep for obvious dead weight first** — unused imports, commented-out code blocks, TODO/FIXME comments that are clearly stale, console.log/print debug statements, variables assigned but never read. Also check for junk files: `.DS_Store`, `*.bak`, `*.orig`, `*~`, and zero-byte tracked files (`find . -type f -size 0`, cross-check `git log -1 --` before deleting). These are free wins fleet-wide even when the source itself is already clean.

2. **Read files that matched**, batch them, look for:
   - Dead code: functions/variables never called or referenced
   - Duplicated logic: same thing done twice in different places → consolidate
   - Needlessly complex expressions: nested ternaries, long chains, manual loops over stdlib equivalents
   - Magic numbers/strings with no explanation → extract to named constant only if used more than once
   - Overly verbose code: 10 lines that could be 2
   - Inconsistent style: mixed quote styles, inconsistent naming, mismatched patterns within the same file

3. **Edit directly** — don't ask permission for obviously safe deletions (dead imports, debug logs, commented-out blocks). For anything that changes behavior (restructuring logic, consolidating functions), show a brief diff rationale first.

4. **Report** — one-liner per file: what was cleaned, lines removed. If something looked dirty but was left alone, say why (e.g. "couldn't confirm unused without tracing callers").

## Rules

- Deletion over abstraction. Remove noise, don't reorganize into new patterns.
- Don't refactor working code into a different style just because you'd write it differently.
- Don't add comments explaining what the code does — the code should speak for itself after cleanup.
- Scope creep kills: if you notice a real bug while cleaning, flag it, don't fix it here.

## Usage awareness
Single project, direct edits — no subagent fanout warranted here even on a large repo; batch file reads instead. If usage is tight and no scope was given, default to the most-recently-touched files/dirs rather than a full-repo pass.

## Fleet-wide invocation (~/Documents/Code, many repos)
Survey before reading: `grep -rl` across the whole tree for console.log/TODO/junk-files first, excluding `node_modules`/`.build`/`dist`/`Pods`/`DerivedData`/`.git`. A mature, already-shipped fleet is often already clean of dead code — don't force a per-file read pass through every repo when the survey turns up nothing; report that and move on. Vendored READMEs (SPM `.build/` checkouts, dotfiles plugin dirs, third-party pentest targets like a Juice Shop clone) aren't yours to touch. Living docs (roadmap.md, GTM.md) are active notes, not cruft — leave them alone even if long.
