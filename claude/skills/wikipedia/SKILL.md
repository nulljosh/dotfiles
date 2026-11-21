---
name: wikipedia
description: Build a Wikipedia-style article page for a website, company, product, or person. Use when the user says "/wikipedia <url or subject>", "make a wiki page for X", or "build a wikipedia page for this site".
---

# Wikipedia page builder

Given a URL (or subject name), research it and draft real Wikipedia article source (wikitext), for the user to submit themselves at wikipedia.org. No Artifact, no HTML — plain text/wikitext only, since this is meant to be pasted into Wikipedia's own editor.

## Steps

1. Resolve the target: if given a URL, WebFetch it (and a couple of internal links: about/product/pricing pages). If given a bare subject with no URL, WebSearch first.
2. Check notability before drafting: WebSearch for independent secondary-source coverage (press, reviews, articles not published by the subject itself). Wikipedia requires this — without it, an article gets speedy-deleted. Report what you found (or didn't) plainly before writing anything. If there's nothing independent, say so and stop — don't draft an article that will just get deleted.
3. If notability is arguable, draft the article as **wikitext** (Wikipedia's markup: `'''bold'''`, `[[wikilink]]`, `== heading ==`, `{{Infobox company}}` template, `<ref>` citation tags), sourced only from what you actually fetched — never invent founding dates, founders, funding, etc.
4. Output the wikitext as a plain text block (or write to a `.txt`/`.wiki` file if asked to save it) — never an Artifact, never styled HTML. The user pastes it into Wikipedia's edit box themselves, logged into their own account.
5. Never log into Wikipedia, handle credentials, or attempt to publish/edit pages on wikipedia.org directly — that's the user's own action to take.

## Notes
- This produces a draft for the user to submit by hand. It never touches wikipedia.org directly.
