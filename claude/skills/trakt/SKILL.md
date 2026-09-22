---
name: trakt
description: Interact with the Trakt.tv API — search movies/shows, read/update watchlist, history, and ratings. Use when the user asks about Trakt, their watchlist/history/ratings on Trakt, or invokes /trakt.
---

Run `~/Documents/Code/scripts/trakt_client.py <command> [args]` via Bash. Stdlib-only Python, no dependencies.

Setup (one-time, tell the user if missing):
- Create an app at https://trakt.tv/oauth/applications (redirect URI: `urn:ietf:wg:oauth:2.0:oob`)
- `export TRAKT_CLIENT_ID=... TRAKT_CLIENT_SECRET=...` (in shell profile)
- `trakt_client.py auth` — prints a URL + code for device login, polls until approved

Commands:
- `search <query> [--type movie|show]`
- `watchlist` (list) / `watchlist add <movie|show> <trakt_id>` / `watchlist remove <movie|show> <trakt_id>`
- `history [--type movie|show] [--limit N]`
- `ratings [--type movie|show]`
- `watched <movie|show> <trakt_id>` — mark watched now

Token is stored at `~/.trakt/token.json` (mode 600). Summarize JSON output in chat; don't dump raw unless asked.
