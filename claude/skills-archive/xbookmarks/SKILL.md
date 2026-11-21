---
name: xbookmarks
description: Clean out Joshua's X (Twitter) bookmarks. Collect all of them, keep the ones worth acting on in the wiki, then unbookmark everything processed so the list hits zero. Use for /xbookmarks, "clean my twitter bookmarks", "empty bookmarks", "process bookmarks".
---
Builds on xread (same dir, same taste): ~/Documents/Code/_attic/xreader (taste.md, seen.txt, login.sh, check.mjs). On demand only, no cron.

0. xreader has no node_modules: import playwright-core from `~/Documents/Code/epiphany/node_modules/playwright-core/index.mjs`.
Scripts in xreader: collect.mjs (step 2), deep.mjs (2b), clear.mjs (5, also verifies 0 left).
1. **Attach headless.** Run `login.sh` if :9333 is down (own profile, already logged into X, never launch via Playwright, never copy the main profile). Attach with playwright-core `connectOverCDP('http://127.0.0.1:9333')`, same as check.mjs. Open `https://x.com/i/bookmarks` (redirects to /i/history, fine).
2. **Collect everything.** Scroll until the article count stops growing (1.2s apart, cap ~80 scrolls). Per `article[data-testid="tweet"]`: link, handle, text, stats. X unmounts offscreen tweets, so harvest after every scroll step into a Map keyed by link, never count articles once at the end. Write raw to a scratch JSON first so a crash loses nothing. Quoted "Article" cards: open the tweet, read the page text, summarise (never paste 50k).
2b. **Deep read before ranking.** `node deep.mjs bookmarks.json deep.json` opens every non-junk link (set the junk indices in the script) and pulls the author's thread, link card, alt text and any article. Never rank from the one-line preview.
3. **Triage against taste.md.** Three buckets: KEEP (actionable, tool, workflow, number-backed), SKIM (one-line note, no page), DROP (hype, bait, news, dead links). Anything already in seen.txt is DROP. Rank KEEP by relevance to the codebase.
4. **Write to the wiki first** (~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki): `pages/src-x-bookmarks-DATE.md` (every KEEP + SKIM, one line + link + handle), `pages/syn-x-bookmarks-ranked-DATE.md` (top 10 with what to try), update index.md and log.md. Append kept links to seen.txt. Joshua voice: plain, no em dashes, no AI words.
5. **Only after the wiki write, unbookmark** every collected tweet (KEEP, SKIM, DROP alike, the links are saved): click `[role=group] div[aria-label="Bookmarked"]` per article, 1s apart, batches under 45s, re-scroll for the next batch. If a batch fails to click, stop and report; don't loop.
6. **Verify.** Reload bookmarks, count articles, expect 0. Close the tab.
7. **Reply** with: counts (collected / kept / dropped / left), the top 3 KEEPs, and the wiki path. Short.

Gotchas (verified 2026-10-11): if using the extension instead of CDP, `osascript -e 'tell application "Google Chrome" to activate'` first; javascript_tool output is blocked if it contains URLs or `?=&` and capped near 800 chars, so strip those and read in chunks of ~12.
New bookmarks later: just rerun; seen.txt keeps it incremental.
