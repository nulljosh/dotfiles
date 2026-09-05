---
name: curbfind-deals
description: List the best Craigslist deals right now via Curbfind's AI-ranked search. Use when the user asks for good deals, what's cheap, or invokes /curbfind-deals, /deals, or "find me a deal".
---

Curbfind's own worker already does the ranking and AI reasoning — this skill
just calls it and shows the top of the list. Never re-implement the deal
scoring here.

Fetch (swap query params as the user's ask implies):

```
curl -s "https://curbside-api.trommatic.workers.dev/api/search?city=<city>&cat=<cat>&sort=deal&q=<query>"
```

- `city`: slug like `vancouver`, `newyork`, `sfbay`. Default `vancouver` if unspecified.
- `cat`: `sss` (for sale, default), `cta` (cars & trucks), `hhh`/`apa` (housing), etc.
- `q`: only set if the user named a specific item (e.g. "find me a deal on a bike" -> `q=bike`).
- `min_price`/`max_price`: set if the user gives a budget.

The response's `items` array is already sorted best-deal-first. Each item may
carry a `dealReason` (an AI one-liner, only present on the top ~5). Present
the top 5-10 to the user as a short list:

```
$<priceString> — <title> (<location>) — <dealReason, if present>
```

Include the listing's `url` so the user can open it. Don't dump the raw JSON.
If `items` is empty, say so plainly — don't invent listings.
