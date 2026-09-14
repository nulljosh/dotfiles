---
name: hormuz
description: Check whether the Strait of Hormuz is open, current WTI crude price, and the long/short momentum read from hormuz.heyitsmejosh.com. Use when the user asks about Hormuz status, oil price, or "should I long/short oil".
---

# Hormuz

Pulls live data from the deployed API — no browser needed.

```bash
curl -s https://hormuz.heyitsmejosh.com/api/status
curl -s "https://hormuz.heyitsmejosh.com/api/oil?range=5d"   # or 1mo, 1y
```

`status` returns `{open, last_closure, note}` — `open` is currently hardcoded true, since the
strait has never had a sustained closure. `oil` returns `{price, prevClose, timestamps, closes}`
for the given range; compute percent change first-to-last for the same long/short read the site
shows.

Report price, day change %, and the momentum read in one or two sentences. Don't fetch the page
in a browser for this — the API is faster and this is the whole point of having one.
