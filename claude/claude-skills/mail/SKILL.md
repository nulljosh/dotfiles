---
name: mail-sweep
description: Scan email for dev-tool warnings (App Store Connect, Vercel, Sentry, GitHub Actions) and file them into the right project's roadmap.md, or fix directly if trivial. Use when the user says "check my email", "/mail-sweep", or pastes a screenshot of dev-tool inbox notifications.
---

# mail-sweep

Replaces the manual screenshot → Notes.app → paste-into-Claude loop for dev-tool emails. User-triggered only — no cron, per the "no background automation" rule in `~/CLAUDE.md`.

## Sources

- iCloud/other Mail.app accounts (macOS): read headlessly via `osascript` against Mail.app — never UI-script it (per `feedback_headless_automation`). Example:
  ```applescript
  tell application "Mail"
    set theMessages to messages of inbox whose sender contains "itunesconnect@apple.com"
    repeat with m in theMessages
      -- subject of m, content of m, date received of m
    end repeat
  end tell
  ```
- Gmail: use `mcp__claude_ai_Gmail__*` MCP tools if connected (load via ToolSearch first).

## Match list (extend as new senders show up)

- `itunesconnect@apple.com`, "App Store Connect" — subjects like "issue with your ... submission", "Action needed"
- Vercel deployment-failed notifications
- Sentry alert emails
- GitHub Actions failure notifications

## Per matched email

1. Extract the app/project name from the subject — match against directory names under `~/Documents/Code`.
2. Extract the actual error/reason from the body.
3. Cross-check against that project's `roadmap.md` and your memory (`~/.claude/projects/-Users-joshua/memory/`) — if already resolved (e.g. a fix already shipped per project memory), mark it stale, skip filing, note it in the summary.
4. If new/unresolved and trivially fixable with an existing `asc-*` skill (metadata issue, stale build, etc.), fix it directly and report what changed.
5. Otherwise append a dated entry under a `## Inbox` heading in that project's `roadmap.md`.

## Output

One-shot summary: what was filed, what was auto-fixed, what was stale/skipped. No essay per email.

## Don't

- Don't set up any recurring/background job for this — always user-invoked.
- Don't UI-script Mail.app or open it visibly; AppleScript reads only.
- Don't re-file something already tracked as resolved in project memory — check first.

## Usage awareness
This is a single-pass scan, not a fanout task — no subagents per email. If many emails match, batch-read them together rather than one tool round-trip per message, and fix only what's trivially mechanical (per step 4); anything ambiguous goes to roadmap.md instead of burning turns investigating it deeply.
