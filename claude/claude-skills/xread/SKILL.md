---
name: xread
description: Read X for AI tips and tricks so Joshua doesn't have to. One search over a curated handle list plus my bookmarks in logged-in Chrome, ranked by taste, written as a short digest. Use for /xread, "check twitter", "twitter digest".
---
Dir: ~/Documents/Code/xreader (handles.txt, taste.md, seen.txt). On demand only, no cron.

1. Build one URL: `https://x.com/search?q=(from:a OR from:b ...) min_faves:30 -filter:replies&f=live` from handles.txt (URL-encode). Open in a new Chrome tab.
2. javascript_tool: scroll ~15 times (1.2s apart), collect `article[data-testid="tweet"]` link, user, text, stats (aria-label on `[role=group]`). Dedupe by link.
2b. (bookmarks flow, verified 2026-10-11) Bookmarks live at x.com/i/bookmarks, which redirects to /i/history. Chrome needs `osascript -e 'tell application "Google Chrome" to activate'` first. javascript_tool output is blocked if it contains URLs or `?=&`, and capped near 800 chars: strip those and read in chunks of ~12.
 a. Scroll collect as below. Articles show as a quoted card: on the tweet page, click `div[role=link]` whose text has "Article", then get_page_text for the full text (summarise, don't paste 50k).
 b. Ingest into wiki (~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki): pages/src-x-bookmarks-DATE.md, src-x-articles-DATE.md, syn-x-bookmarks-ranked-DATE.md (rank by relevance to the codebase), update index.md and log.md.
 c. Only after the wiki write, unbookmark: per article click the `[role=group] > div[aria-label="Bookmarked"]` button (.click(), 1s apart, batches under 45s or the tool times out). Reload bookmarks to confirm 0 left.
 d. Headless (verified 2026-10-11): `~/Documents/Code/xreader/login.sh` starts plain Chrome with its own profile (~/.xreader/profile, logged into X) on CDP :9333. Scripts attach with playwright-core `connectOverCDP('http://127.0.0.1:9333')` (see check.mjs), no extension needed, same selectors. Playwright-launched Chrome gets rejected at X login, so never launch it that way. Never copy the main Chrome profile or cookies.
 Original step: Then open `https://x.com/i/bookmarks` in the same tab and run the same scroll/collect (no min_faves filter, they're already hand-picked). Merge with step 2, dedupe by link. Bookmarks go through seen.txt like everything else; rank them above timeline items of equal quality.
3. Drop anything in seen.txt. Judge the rest against taste.md. Top 10 max.
4. Write digest-YYYY-MM-DD.md: per item one line (what it is + what to try), the link, handle. Joshua voice: plain, punchy, no em dashes, no AI words. Append kept links to seen.txt.
5. Reply with the top 3 only, plus the file path. Close the tab.
Add/remove handles by editing handles.txt. If a handle returns nothing for weeks, drop it.
