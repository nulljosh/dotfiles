---
name: news
description: Pull today's top stories via newsline's RSS API (CNN, Fox, BBC, Hacker News, Vancouver Sun, The Province + more) plus WSJ/Bloomberg/CNBC markets backfill, and give a market + news briefing — biggest stories of the day, the week's read, and market/stock commentary. Use when the user invokes /news, /market, /morning, or /goodmorning.
---

# News & market morning briefing

Invoked as `/news`, `/market`, `/morning`, or `/goodmorning`.

## Workflow
1. Pull the day's top headlines + URLs from **newsline**, which already
   aggregates 17 RSS sources (CNN, Fox, BBC, NPR, Guardian, Hacker News,
   Vancouver Sun, The Province, …) with no scraping/block headaches:
   ```sh
   curl -s "https://news.heyitsmejosh.com/api/stories?_=$RANDOM" \
     | python3 -c "import sys,json; [print(x['outlet'],'—',x['title'],x['link']) for x in json.load(sys.stdin)['latest'][:60]]"
   ```
   The `stories` array (vs `latest`) gives the same headlines pre-clustered by
   how many outlets cover each — a built-in importance signal for step 2.
   Skip evergreen/explainer items, keep dated/breaking stories.

   **Business/markets gap:** newsline is general news, so for market-specific
   depth, backfill via WebSearch for today's top WSJ/Bloomberg/CNBC markets
   headlines (those three hard-block scrapers; don't fight them with curl).
2. Across all sources, pick the 6-10 most significant stories of the day —
   dedupe stories multiple outlets are covering (that's a signal of
   importance, mention it once and note who covered it), prioritize
   market-moving / macro / large-cap news over soft stories.
3. For each: WebFetch the article, write a 2-4 sentence summary — what
   happened, why it matters, one concrete number or quote.
4. Spot-check the one or two most load-bearing factual claims per story
   (a stat, a quote, a "first time in X years" claim) with a quick WebSearch
   against an independent source. Note agreement or flag disagreement —
   skip trivial/uncontroversial claims.
5. WebSearch for today's major index moves (S&P 500, Nasdaq, Dow — % change)
   and the past week's performance for the same indices, plus any stocks
   that are leading the day's news (movers tied to the stories above).
6. Present:
   - **Market snapshot**: today's index moves + one-line why, and the past
     week's trend.
   - **Top stories**: ranked list, source tag(s), summary, verification note.
   - **Stocks/sectors in focus**: names or sectors tied to today's news and
     why they're moving — informational context, not personalized advice;
     say so explicitly, don't tell the user what to buy.
   - **The week ahead/read**: 2-3 sentences tying the stories together —
     what theme is driving markets this week and what to watch next.
   Keep it skimmable — this is a briefing, not an essay.

## Adding more sources
Headlines come from newsline — add a source by appending a `[outlet, bias, url]`
row to `FEEDS` in `~/Documents/Code/newsline/worker.js` (any RSS/Atom feed),
not here. WSJ/Bloomberg/CNBC markets depth stays a WebSearch backfill in step 1.
Business, CNBC.
