---
name: summarize-twitter
description: Summarize a tweet or an entire X/Twitter thread from a URL, keyless via fxtwitter. Use when asked to summarize, recap, tldr, or "read" a tweet/thread/x.com link. Optionally implements what the thread describes when --implement is passed or requested in the same message, never by default.
---

# Summarize a tweet or thread

Invoked as `/summarize-twitter <x.com or twitter.com url> [--implement]`.

## Workflow
1. Run `python3 ~/.Codex/skills/summarize-twitter/thread.py <url>`. It prints every tweet in
   the author's reply chain, oldest first, with quote tweets and media links.
2. The script walks UP the chain (fxtwitter has no "replies" endpoint). If the URL is the first
   tweet of a thread and the output is 1 tweet, the thread continues below it:
   - Ask nothing. Open the tweet in Chrome (logged-in session), read the page text, and collect
     the same-author replies in order. Only then summarize.
3. If the API returns 404 (deleted, private, or age-gated), say so. Never summarize from memory.
4. Produce: a 1-paragraph TL;DR, then key points as bullets. Quote the exact tweet text for any
   claim, number, or link that matters. Keep media/quote links.

## Optional implement mode
Only with `--implement` or when asked in the same message. Extract the concrete steps, commands
or code the thread describes and implement them in the current project with normal care.
Otherwise stop at the summary and note "pass --implement to apply this."
