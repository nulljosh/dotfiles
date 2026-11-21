---
name: playlist-transfer
description: Convert a playlist between Apple Music and Spotify (or any other service) with TuneMyMusic in the logged-in Chrome session. Use when the user says /playlist-transfer, hands over an Apple Music or Spotify playlist link and wants it on another service, or wants to share a playlist with someone on a different music app.
---

# Playlist transfer

No build. tunemymusic.com does the matching, free up to 500 tracks per transfer. Proven run 2026-09-21: 50 of 50 tracks, Music.app to Spotify, about two minutes.

## Input

Either works, neither needs a login on the source side:

- A plain `Artist - Title` tracklist. The `playlist` skill prints one. Preferred, it skips share links and iCloud sync.
- A public playlist share link (Apple Music: Share > Copy Link).

Also ask what to name the playlist if the user has not said.

## Steps

1. `navigate` to `https://www.tunemymusic.com/transfer`.
2. Source: click **Free text** (it takes two clicks, the first only highlights the tile). Click the textarea, `type` the whole tracklist in one go, then click the button under it. It reads "Convert song list" on screen but the accessibility tree calls it "Choose Destination", so `find` it rather than guessing.
3. Destination: click **Spotify**. A sign-in popup opens in a separate window that the tab group cannot see. Stop here and tell the user to sign in. Never type credentials or approve OAuth for them. The playlist lands in whichever account signs in.
4. Once the user says they are through, the page sits on step 4/4 with the playlist called "My Playlist". The pencil has no label, it is the first unlabeled button beside the playlist row. Click it, triple-click the Playlist Name field, type the name, zoom to confirm it took, Save.
5. Click **Start Transfer**, wait 10 seconds, `get_page_text`. Expect "Transfer Complete!" with the moved count.
6. The result page has no Spotify link. `navigate` the same tab to `https://open.spotify.com/collection/playlists`, click the playlist in the left library, read the URL from `tabs_context_mcp`.
7. `pbcopy` the link and report: tracks moved, tracks not found by name, the link.

## If the friend should own it

They can run it themselves: send them the tracklist or link plus the transfer URL, they sign in to their own account. Otherwise a playlist in the user's account shares fine as a link.

## Missing tracks

Search the destination service for each missing track and add it by hand if a match exists. Anything truly absent, name it in the report.
