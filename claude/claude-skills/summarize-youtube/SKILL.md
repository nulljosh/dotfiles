---
name: summarize-youtube
description: Summarize a YouTube video from a URL argument by fetching its transcript via yt-dlp. Use when asked to summarize, recap, or "tldr" a YouTube video/link. Optionally implements what the video describes when --implement is passed or requested in the same message — never by default.
---

# Summarize a YouTube video

Invoked as `/summarize-youtube <youtube-url> [--implement]`.

## Workflow
1. Check `yt-dlp` is available: `which yt-dlp`. If missing, install it
   (`brew install yt-dlp`) before continuing.
2. Fetch captions only, no video download, into `/tmp`:
   ```
   yt-dlp --skip-download --write-auto-sub --write-sub --sub-lang en \
     --sub-format vtt -o "/tmp/yt-%(id)s.%(ext)s" <url>
   ```
3. Also grab context: `yt-dlp --skip-download --print "%(title)s|%(channel)s|%(description)s" <url>`
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
