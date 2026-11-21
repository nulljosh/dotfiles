---
name: blog-digest
description: Pull and summarize the latest entries from a list of tech/writing blogs via their RSS feeds. Use when the user asks for a blog digest, "what's new on X blog", or invokes /blog-digest.
---

Default feed list (add more as the user names blogs):

- NSHipster — https://nshipster.com/feed.xml
- Daring Fireball — https://daringfireball.net/feeds/main
- Six Colors — https://sixcolors.com/feed/
- Marco.org — https://marco.org/rss
- Inessential (Brent Simmons) — https://inessential.com/feed.json

Steps:
1. `curl -s <feed-url>` for each feed (RSS/Atom XML).
2. Parse title, link, pubDate, and description/summary for the N most recent items (default N=3 per blog, or what the user asks for).
3. Present as a short digest grouped by blog: title (linked), date, 1-2 sentence summary in your own words — don't just paste the RSS description if it's boilerplate.

- If a URL has no discoverable feed, try `<url>/feed`, `<url>/rss`, `<url>/atom.xml`, or check the page `<link rel="alternate" type="application/rss+xml">` before giving up.
- No local state/db — this is a live pull each time, not a subscription tracker. If the user wants persistence (e.g. "only show new since last time"), ask before building that.
