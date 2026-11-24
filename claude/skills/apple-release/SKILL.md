---
name: apple-release
description: Build, sign, validate, release and troubleshoot Apple apps with asc. Use for App Store Connect records, submissions, TestFlight, rejection handling, notarization or Apple sign-in fixes.
---

# Apple Release

Select only the mode requested by the user and read its procedure below. Former command names remain routing aliases, not separate skills. Resolve relative resources from the selected procedure directory. Read additional modes only if needed for the task.

Repository AGENTS.md and current user instructions take precedence over historical procedures. A procedure does not authorize unrelated work, publishing, merging, sending messages, purchases, background automation, or delegation. Honor existing authorization and stop at the requested outcome. Do not start an endless loop or act on a roadmap unless requested. Use current repo names and verify historical paths before running commands.

## Hard gate: one store submission a week, every mode
Before ANY `asc review submit`, `submissions-submit`, or "Add for Review", run `python3 <skill-dir>/week_gate.py`. If it prints BLOCKED, do not submit. Not in loops, not "just one more", not with a note. Tell Joshua which app is next in line and stop. About 25 submissions went in between Nov 7 and Nov 22, 2026, most from the asc-cli key in agent loops: the bulk pattern behind the 5.6 suspension and the 4.3(a) waves. Only Joshua's explicit yes in chat, for a named app, overrides this.

| Mode / former command | Instructions |
|---|---|
| `asc-app-create-ui` | [Procedure](references/asc-app-create-ui/PROCEDURE.md) |
| `asc-build-lifecycle` | [Procedure](references/asc-build-lifecycle/PROCEDURE.md) |
| `asc-cli-usage` | [Procedure](references/asc-cli-usage/PROCEDURE.md) |
| `asc-crash-triage` | [Procedure](references/asc-crash-triage/PROCEDURE.md) |
| `asc-id-resolver` | [Procedure](references/asc-id-resolver/PROCEDURE.md) |
| `asc-notarization` | [Procedure](references/asc-notarization/PROCEDURE.md) |
| `asc-release-flow` | [Procedure](references/asc-release-flow/PROCEDURE.md) |
| `asc-signing-setup` | [Procedure](references/asc-signing-setup/PROCEDURE.md) |
| `asc-submission-health` | [Procedure](references/asc-submission-health/PROCEDURE.md) |
| `asc-system-status` | [Procedure](references/asc-system-status/PROCEDURE.md) |
| `asc-testflight-orchestration` | [Procedure](references/asc-testflight-orchestration/PROCEDURE.md) |
| `asc-wall-submit` | [Procedure](references/asc-wall-submit/PROCEDURE.md) |
| `asc-web-relogin` | [Procedure](references/asc-web-relogin/PROCEDURE.md) |
| `asc-workflow` | [Procedure](references/asc-workflow/PROCEDURE.md) |
| `asc-xcode-build` | [Procedure](references/asc-xcode-build/PROCEDURE.md) |
| `asc-status` | [Procedure](references/asc-status/PROCEDURE.md) |
| `rejection-handler` | [Procedure](references/rejection-handler/PROCEDURE.md) |
| `apple-signin-fix` | [Procedure](references/apple-signin-fix/PROCEDURE.md) |
