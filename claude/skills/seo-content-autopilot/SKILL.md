---
name: seo-content-autopilot
description: Run the Abraham/ServiceOP client SEO content pipeline — crawl a site, find competitor gaps, build a keyword/topic-cluster plan, and draft EAT-optimized articles (pillar + supporting, or local-city pages). Use when doing SEO/content work for the Abraham engagement, or when asked to run the SEO skill / build a content plan for a GBP client site.
---

Source: `~/Documents/Code/abraham/transcripts.pdf` (3 video summaries) and `~/Documents/Code/abraham/OPERATING_GUIDE.local.md` (approval boundaries, prohibited practices — read this first, it overrides anything below).

Takes a website URL (client's own site, or one new city/location URL) and an optional topic. If no URL/topic given, ask.

Steps:
1. Read `~/Documents/Code/abraham/OPERATING_GUIDE.local.md` for approval boundaries and prohibited practices before doing anything else. Stop and ask the user if a step below would cross one.
2. Crawl the target site (WebFetch the homepage + a few key pages) to learn brand voice, existing services/locations, and content already published.
3. Keyword + competitor research: for the client's niche/city, identify top keywords, search intent, competitor content gaps, and winnable opportunities (WebSearch top-ranking competitor pages for the niche/city).
4. Build a topic cluster: one pillar article + 2-3 supporting articles that link back to it, OR (if this run is for a new location) one local page per city using the same structure. Present the plan — titles, target keywords, H2/H3 outline — for approval before writing full drafts.
5. On approval, write each article: EAT-optimized (real examples, data/stats, proper heading structure, author bio, specific real tools/companies, not vague filler). Flag clearly in the output that a human needs to add real experience/examples on top before publishing — don't let raw output go live as-is.
6. For local pages: unique per city, local keywords, no duplicate boilerplate across cities beyond the shared structure.
7. Optional, only if asked: draft schema/structured data (FAQ, LocalBusiness, Article) for a page.
8. Optional, only if asked: turn a published post into short social captions (Instagram/Facebook/LinkedIn) pulled from its own content, not templated filler.
9. If the client has shared Google Search Console data and an article is stuck (page 2+), rewrite just the intro + add examples + optimize for a featured snippet, rather than a full rewrite.

Output articles as markdown, one file per article, so they're easy to copy into the CMS. Never auto-publish — this repo/skill has no publishing integration; publishing stays manual until the user explicitly sets one up.
