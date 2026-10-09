---
name: summarize-youtube
description: Summarize a YouTube video or a whole playlist from a URL argument by fetching transcripts via yt-dlp. Use when asked to summarize, recap, or "tldr" a YouTube video, link, or playlist. Optionally implements what the video describes when --implement is passed or requested in the same message — never by default.
---

# Summarize a YouTube video

Invoked as `/summarize-youtube <youtube-url-or-playlist-url> [--implement]`.

## Playlists
If the URL contains `list=`, expand it first, then run the single-video workflow per video:
```
yt-dlp --flat-playlist --print "%(id)s|%(title)s" <playlist-url>
```
Summarize each video (short TL;DR + 3-5 bullets each), then finish with one synthesis
paragraph across the whole playlist. Over 10 videos: do the first 10, list the rest by title,
and say so. Videos with no captions get one line saying so, not a guess.

## Workflow
1. Use nightly yt-dlp through `uvx`, not the brew one. YouTube changes break the stable
   release for weeks; brew's 2026.08.19 got HTTP 429 on every caption request on 2026-10-02
   while nightly with Chrome cookies worked first try. Nothing to install; every call below
   starts `uvx --prerelease allow --from "yt-dlp[default]" yt-dlp` (written out, since a
   `$Y` variable doesn't word-split in zsh).
2. Fetch captions only, no video download, into the scratchpad (or `/tmp`):
   ```
   uvx --prerelease allow --from "yt-dlp[default]" yt-dlp --skip-download --write-auto-sub --write-sub --sub-lang en \
     --sub-format vtt --cookies-from-browser chrome -o "yt-%(id)s.%(ext)s" <url>
   ```
   Still 429: the IP is rate limited; wait a few minutes and retry once, don't loop.
3. Also grab context: `uvx --prerelease allow --from "yt-dlp[default]" yt-dlp --skip-download --print "%(title)s|%(channel)s|%(description)s" <url>`
4. Read the resulting `.vtt` file and strip timestamps/cue numbers down to
   plain spoken text (keep rough cue times handy if the video is long or
   technical — useful for citing "around 4:30 they...").
5. If no `.vtt` file was produced (no captions, auto or manual, available),
   say so explicitly. Do not summarize from just the title/description as if
   it were the video — that's guessing, not summarizing.
6. Produce: a 1-paragraph TL;DR, then key points as bullets (with
   timestamps where it helps). For very long transcripts, summarize in
   chunks first, then synthesize.
7. Delete the temp `.vtt`/info files when done.

## Optional implement mode
- Only do this if the user passed `--implement` or asked in the same message
  (e.g. "summarize and implement it", "do what the video says").
- After the summary, extract concrete actionable steps (commands, code,
  config) the video describes, and implement them in the current project
  using normal coding-task judgment — same conventions, same care as any
  other change. No separate tooling needed.
- Without the flag, stop at the summary and note: "pass --implement to apply
  this."
