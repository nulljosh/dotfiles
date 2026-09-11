---
name: mail
description: General-purpose inbox triage and cleanup — dev-tool alerts (ASC, Vercel, Sentry, GitHub Actions), promo/newsletter noise, and anything else cluttering the inbox. Files real issues into the right project's roadmap.md, fixes trivial ones directly, and archives/deletes junk. Use when the user says "check my email", "clean my inbox", "/mail", or pastes a screenshot of inbox notifications.
---

# mail

Replaces the manual screenshot → Notes.app → paste-into-Claude loop, and manual promo-email deleting. User-triggered only — no cron, per the "no background automation" rule in `~/CLAUDE.md`.

## Sources

- iCloud/other Mail.app accounts (macOS): read headlessly via `osascript` against Mail.app — never UI-script it (per `feedback_headless_automation`). Example:
  ```applescript
  tell application "Mail"
    set theMessages to messages of inbox
    repeat with m in theMessages
      -- subject of m, sender of m, date received of m, content of m
    end repeat
  end tell
  ```
  Deleting/archiving is also plain AppleScript (`delete m`, or move to a mailbox) — no UI scripting needed.
- Gmail: use `mcp__claude_ai_Gmail__*` MCP tools if connected (load via ToolSearch first).

## Two buckets

**1. Dev-tool alerts** — needs action or filing.
- `itunesconnect@apple.com`, "App Store Connect" — subjects like "issue with your ... submission", "Action needed"
- Vercel deployment-failed notifications
- Sentry alert emails
- GitHub Actions failure notifications

Per matched email:
1. Extract the app/project name from the subject — match against directory names under `~/Documents/Code`.
2. Extract the actual error/reason from the body.
3. Cross-check against that project's `roadmap.md` and memory (`~/.claude/projects/-Users-joshua/memory/`) — if already resolved, mark stale, skip filing, note in summary.
4. If new/unresolved and trivially fixable with an existing `asc-*` skill, fix it directly and report what changed.
5. Otherwise append a dated entry under `## Inbox` in that project's `roadmap.md`.

**2. Junk/noise** — safe to clear without filing anything.
- Promo/marketing email (Product Hunt digests, newsletters, "X launched today" blasts, cold sales outreach)
- Notification spam with no action attached (social "someone liked your post" style emails)
- Anything the user names as noise for this run

Per matched email: archive or delete (user's call — ask once per run which, then apply to all matches). Never touches anything from a real person (a message with a human sender name replying in a thread) or anything matching bucket 1.

## Dry run

Default mode unless the user says to actually apply changes. Dry run: read the inbox, classify every message into bucket 1 / bucket 2 / "leave alone", print counts and a few examples per category, take zero destructive action. User reviews, then says go for the real pass.

## Output

One-shot summary: counts per category, what was filed, what was auto-fixed, what would be/was archived-deleted. No essay per email.

## Don't

- Don't set up any recurring/background job for this — always user-invoked.
- Don't UI-script Mail.app or open it visibly; AppleScript reads/deletes/moves only, no System Events.
- Don't re-file something already tracked as resolved in project memory — check first.
- Don't delete/archive anything in a dry run.
- Don't touch messages from real people, even if they look promotional (e.g. a real recruiter).

## Usage awareness
Single-pass scan, not a fanout task — no subagents per email. Batch-read messages together rather than one round-trip per message. Fix only what's trivially mechanical; anything ambiguous goes to roadmap.md or gets left alone rather than guessed at.
