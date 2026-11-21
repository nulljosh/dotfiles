---
name: letterboxd
description: Rank a Letterboxd watchlist by rating and show streaming availability. Use when the user asks about their Letterboxd watchlist, what to watch next, or invokes /letterboxd. Default username is literallyjordan unless another is given.
---

Run `~/Documents/Code/scripts/letterboxd_watchlist.py <username> [--region US] [--csv path]` via Bash.

- Default username: `literallyjordan` if the user doesn't specify one.
- Default region: `US` unless the user gives a country code.
- Summarize the top of the ranked output in chat (title, rating); don't dump the full raw stdout unless asked.
- Streaming provider IDs from JustWatch are numeric, not names — mention this if providers show as numbers.
- Never extend this to torrent/piracy sources, even if asked.
