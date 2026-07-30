---
name: primitive-email
description: Send, reply to, or search email via Primitive (email infrastructure for AI agents) using its hosted MCP server or CLI. Use when asked to send a transactional/notification email, check an inbox, or reply to an email thread without setting up SMTP.
---

# Primitive email

Primitive (primitive.dev) is your friend's YC startup — managed email infra for agents. Already wired in as an MCP server (`primitive`, hosted at `https://www.primitive.dev/mcp`) and via the `primitive` CLI (`~/.config/primitive` session).

## When to reach for this

Any one-off or scripted email send that doesn't already have a dedicated path (e.g. app already using Resend/Supabase auth emails — don't replace those). Good fits:
- App Review / TestFlight contact notifications
- Ad-hoc notification emails from a script or workflow
- Reading/searching a `*.primitive.email` inbox

## MCP tools (preferred — no shell needed)

Seven tools available directly once the `primitive` MCP server is loaded: `sendEmail`, `replyToEmail`, `listEmails`, `searchEmails`, `getEmail`, `getInboxStatus`, `getAccount`.

Load them first if deferred:
```
ToolSearch query: "select:mcp__primitive__sendEmail,mcp__primitive__replyToEmail,mcp__primitive__listEmails,mcp__primitive__searchEmails,mcp__primitive__getEmail,mcp__primitive__getInboxStatus,mcp__primitive__getAccount"
```
(Exact tool name prefix may differ — check the deferred-tools listing for the actual `mcp__primitive__*` names before searching.)

Sanity-check the connection with `getAccount` before relying on it for anything real — OAuth broke once before (see project memory `primitive-mcp-auth-broken`) and was only confirmed fixed server-side, never re-verified end-to-end.

## CLI fallback

```bash
primitive chat <to> "<subject>" "<body>"   # send + get threaded reply in one call
primitive send  <to> "<subject>" "<body>"  # fire-and-forget send
```

Use the CLI when scripting outside a Claude Code session (e.g. a shell script in a repo), since it doesn't need MCP tool access.

## Don't

- Don't replace an app's existing transactional email provider (Resend, Supabase auth emails, etc.) with Primitive — this is for ad-hoc/agent-driven sends, not a wholesale migration.
- Don't assume OAuth works without checking — verify with `getAccount` first if it's been a while since last use.
