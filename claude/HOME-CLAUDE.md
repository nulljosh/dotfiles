# Home (~/)

Machine-level config. Project notes live in `~/Documents/Code/CLAUDE.md`.

## Identity
- macOS Darwin 25.6.0 (arm64), Mac Mini M4
- Shell: fish (`/opt/homebrew/bin/fish`)
- Email: trommatic@icloud.com · Phone: +1 778 201 4533

## Key tooling
| Path | Purpose |
|------|---------|
| `~/.claude/` | Claude Code config, memory, commands, skills |
| `~/.asc/` | App Store Connect CLI auth |
| `~/.appstoreconnect/`, `~/.fastlane/` | Apple distribution |
| `~/.agents/skills/` | asc-* skill packs |
| `~/.supabase/` | Supabase CLI auth |
| `~/.local/bin/` | `claude`, `sync`, `uv`, `uvx`, `asc-login` only |
| `~/.openclaw/` | AI gateway (iMessage, model routing) |
| `~/.atuin/` | Shell history sync |

## No background automation
No crontab, no watchdog, no auto-commit daemon. `~/.local/bin` has 5 binaries only. The "auto-push after passing changes" preference is per-session, not a daemon.

## Browser automation — check these first
Before opening Chrome, try in order:
1. `gh` — GitHub
2. `vercel` CLI / Vercel MCP — deployments, env vars
3. `supabase` CLI / Supabase MCP — DB, migrations
4. `asc` CLI — App Store Connect
5. `wrangler` / Cloudflare curl — Workers, KV, DNS
6. `curl` / WebFetch — REST APIs, page content
7. Gmail/Calendar/Drive MCP — Google services

Open Chrome only for: visual rendering, OAuth-only flows, or UI with no API.

## Codebase
All project work lives under `~/Documents/Code`. See its `CLAUDE.md`.

## Journal
- Few, big entries. One entry per few months, not per week or per month. Merge new work into the current period's entry instead of creating another one; if a period has 10+ entries, consolidate them into one.
- Write like a person: plain natural English, no tech jargon, no AI voice ("delve", "leverage", "seamlessly", "it's not just X, it's Y"), no em dashes, no emojis, no bullet-point walls where a sentence works.
