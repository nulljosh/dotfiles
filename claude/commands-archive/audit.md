---
name: audit
description: Run security-sweep + code-review across one, several, or all projects under ~/Documents/Code. Use when the user wants a combined audit or invokes /audit.
---

Combined security + code quality audit. $ARGUMENTS controls scope:

- No args, or `all` → every subdirectory of `~/Documents/Code` that contains a `.git` (skip `_external`, `node_modules`, and other non-project folders).
- One or more project names (e.g. `epiphany spark`) → resolve each to `~/Documents/Code/<name>`. If any doesn't exist or isn't a git repo, error out and list what's wrong before doing anything else.

## Steps

1. Resolve the project set from $ARGUMENTS per the rules above.

2. Run security-sweep against that scope:
   - Multiple projects (including `all`): invoke the security-sweep skill from `~/Documents/Code` so its built-in multi-project mode handles discovery, per-project sweep, and aggregation. Report-only — do not auto-patch (multi-project sweeps are report-only per that skill's own rules).
   - Single project: invoke security-sweep normally inside that repo, allowing its usual patch-offer step at the end.

3. Run code-review per project, looping since code-review has no multi-project mode of its own:
   - For each resolved project, `cd` into it and invoke the code-review skill at default effort against its current diff.
   - If a project has no staged/unstaged diff to review, skip it and note that in the final report instead of erroring.

4. Produce one combined report:
   - Security findings first, grouped by severity (as security-sweep already formats).
   - Then code-review findings, grouped per project.
   - Note any projects skipped (no diff) or failed to resolve.

5. Apply fixes conservatively: only patch findings you're confident about (clear bugs, real vulnerabilities, obvious dead code/simplifications from code-review). Skip anything speculative or stylistic-only; note what was skipped and why.

6. Refresh markdown docs (README/CHANGELOG) per project if the fixes changed user-facing behavior — keep this minimal, don't rewrite docs wholesale.

7. Per project with changes: show `git diff --stat` (or full diff if small) and a proposed commit message, and wait for explicit user confirmation before committing.

8. On confirmation, commit (with the standard Co-Authored-By trailer) and push each project. Do not push a project the user didn't confirm.
