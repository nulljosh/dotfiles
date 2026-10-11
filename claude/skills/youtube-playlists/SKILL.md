---
name: youtube-playlists
description: Clear out YouTube Watch Later by sorting it into playlists, summarizing every video from its transcript into iCloud Drive, then removing the videos and the temp playlists. Use for /youtube-playlists, "organize watch later", "clean up my YouTube", or "summarize my watch later".
---

# YouTube Watch Later cleanup

Goal state: Watch Later empty, no leftover temp playlists, one summary file per theme in `~/Library/Mobile Documents/com~apple~CloudDocs/YouTube Summaries/`.
For a single video or playlist summary, use summarize-youtube instead.

## Read (no Chrome needed)
`uvx --prerelease allow --from "yt-dlp[default]" yt-dlp --flat-playlist --cookies-from-browser chrome --print "%(id)s|%(title)s|%(channel)s" ":ytwatchlater"`; same for `https://www.youtube.com/feed/playlists`. The Data API returns Watch Later empty, so cookies are the way. Never export the cookie jar to a file (auto mode blocks it); pass `--cookies-from-browser chrome` inline.

## Write: InnerTube from a logged-in youtube.com tab
Use claude-in-chrome. Navigate a tab to youtube.com, then define in `javascript_tool`:
`yt2(ep, body)` = POST `/youtubei/v1/<ep>` with `credentials:'include'`, headers `authorization: SAPISIDHASH <t>_<sha1(t+' '+SAPISID+' https://www.youtube.com')>`, `x-origin`, `x-goog-authuser:0`, body `{context: ytcfg.get('INNERTUBE_CONTEXT'), ...}`.
- Owned playlists + IDs: `playlist/get_add_to_playlist` `{videoIds:[id], excludeWatchLater:false}` (saved playlists owned by others aren't listed or addable).
- Create: `playlist/create` `{title, privacyStatus:'PRIVATE', videoIds:[...]}`. It already adds the videos, so do NOT also add them again (doubles them).
- Add/remove: `browse/edit_playlist` with `ACTION_ADD_VIDEO` (`addedVideoId`) or `ACTION_REMOVE_VIDEO_BY_VIDEO_ID` (`removedVideoId`); works on `WL` too. Delete: `playlist/delete`.
- Verify every step by re-reading with yt-dlp (counts, no duplicates).

## Captions and summaries
1. `yt-dlp --skip-download --write-auto-sub --write-sub --sub-lang en --sub-format vtt --cookies-from-browser chrome --sleep-requests 4 --sleep-subtitles 6 -o "%(id)s.%(ext)s" -a ids.txt` into the scratchpad. One job only, run detached (`nohup ... &`, not tied to the shell call). 429 means stop and wait; parallel jobs make it worse (that's what happened). Expect about 5 videos a minute at best.
2. Clean VTT to plain text (dedupe rolling lines, strip tags). For long videos sample evenly across the whole transcript (about 7 slices, 9-16k chars total), never just head and tail.
3. No captions: `yt-dlp -x --audio-format mp3` then `uvx --from mlx-whisper mlx_whisper f.mp3 --model mlx-community/whisper-large-v3-turbo --output-format txt`. Music-only or noisy clips come back empty or looping: say so in the note, don't invent content.
4. Write 3-6 sentences per video from the actual transcript, one markdown file per theme (title, channel, youtu.be link, summary). State when a video is opinion, sponsor-heavy or low value.
5. Read transcripts in batches of about 70k chars and write summaries to disk after each batch.

## Order of operations
Sort into playlists (reuse owned ones, create themed ones, put leftovers in a Misc/Society/Music/Games bucket so Watch Later fully empties) -> summarize all -> remove from Watch Later -> ask once for deletion, then delete the temp playlists and take only the videos you added out of the user's pre-existing playlists. Never delete the user's own playlists, saved playlists, or their videos in them unless they name that playlist. Keep the Chrome tab open until the end, then close the tab you opened.

If auto mode blocks a bulk write, split it into the narrowest call the user explicitly asked for; if still blocked, stop and tell them.
