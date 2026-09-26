---
name: playlist
description: Build a "most played lately" playlist in Music.app (iTunes) with 25, 50 or 100 songs from the last 30 days or any window, and print the tracklist. Use when the user says /playlist, "make a playlist of my top songs", "most played this month", or wants a playlist to send to a friend.
---

# Playlist

One script, no dependencies:

```
~/.Codex/skills/playlist/top_played.py [count=50] [days=30]
```

It opens Music.app, creates or refreshes the playlist `Top <count> (<days> days)`, and prints `Artist - Title` lines to stdout. Rerunning overwrites that one playlist and touches nothing else.

Known ceiling: Music.app stores a total play count and a last-played date, no per-day history. The list is "played inside the window, ranked by all-time plays". Say so if the user asks why an old favourite ranks high.

`top_played.py --selftest` checks the ranking.

## Sending it to someone on Spotify

Hand the stdout tracklist to the `playlist-transfer` skill. It pastes the list into TuneMyMusic as free text, so no share link or iCloud sync is needed.
