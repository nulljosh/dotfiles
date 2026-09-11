---
name: mobbin
description: Pull real app UI references from Mobbin for a screen type or app (e.g. "onboarding", "paywall", "Airbnb search"), then turn them into concrete design notes for the current project. Also clones the style/vibe of comparable apps into the current project's design system. Use when the user says /mobbin, "mobbin", "find UI references", "make this look like a real app", or asks what a screen should look like.
---

# Mobbin

Mobbin has no public API and requires a logged-in session. Drive the user's Chrome.

## Steps

1. Load browser tools in ONE call:
   `ToolSearch select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__tabs_close_mcp`
2. `tabs_context_mcp`, then open a new tab at `https://mobbin.com/`.
   If it lands on a login wall, stop and tell the user to sign in to Mobbin in Chrome. Do not attempt credentials.
3. **Both the `?query=` URL param AND the full search-results page (after pressing Enter) are broken** — both silently render the generic "Most popular" grid regardless of the term. Verified on two separate searches each way. Never rely on either.
   The only place real matches appear: the autocomplete dropdown that opens while typing in the search box, BEFORE submitting. Click the box, type, and screenshot/read that dropdown directly — do not press Enter.
4. Screenshot the results. Open 3-5 relevant screens and screenshot each.

## Output

Do not dump screenshots and stop. Report:

- **Pattern**: what these screens have in common (layout, nav, hierarchy, CTA placement)
- **Steal this**: 3-5 concrete, implementable specifics
- **Skip this**: what does not fit this project

Then apply it if the user asked for a change, honouring the house rules: no teal, no purple, no gradients, no emoji, sans-serif only, native platform idiom over custom chrome.

## Vibe mode (no screen named)

If the user says just `/mobbin`, or asks to improve the current project's design
system rather than one screen, run this instead of a screen search.

1. Work out what the current project *is* — read its README/roadmap and the main
   view files, and name the category in Mobbin's terms (finance tracker, habit
   tracker, marketplace, reader, notes, dating, fitness). One line, then proceed.
2. Search that category on Mobbin using the on-page search box (click + type —
   the `?query=` URL param is broken, see above). Pick 3 shipped apps that are
   the closest real analogue, not the most famous ones. If nothing in Mobbin's
   catalog is a real analogue (a niche dev tool, a personal/legal app, a math
   utility), say so and skip rather than forcing a comparison.
3. Screenshot 3-5 screens per app covering the same surfaces this project has
   (list, detail, empty state, settings). Skip surfaces the project lacks.
4. Read the project's own tokens/theme file (`tokens.css`, the SwiftUI theme, or
   whatever exists) so the comparison is against real values, not guesses.

Output a gap table, most valuable first, max 8 rows:

| Gap | What they do | This project | Fix |

Then: "Apply top N? y/n" — do not edit unprompted. Applying means editing the
existing token/theme file, never adding a parallel theme system.

House rules override anything seen on Mobbin: no teal, no purple, no gradients,
no emoji, sans-serif only, native platform idiom over custom chrome. If the
reference apps all lean on a banned pattern, say so and give the nearest legal
equivalent.

## Sweep mode (multiple apps)

If asked to run vibe mode across more than 2-3 apps, do not batch them into
one blocking pass that only reports at the end. Go one app at a time, and
after each app finishes, append its result immediately (category + gap list,
or "skip: niche") to a running log file rather than holding it in memory —
`/tmp/mobbin-sweep-<date>.md` unless told otherwise. This way a run that gets
interrupted or runs long still leaves a readable partial result on disk, and
whoever is watching progress can tail the file instead of waiting on the
whole sweep. Same Chrome tab is fine to reuse across apps — no need to open a
new one per app, just navigate.

Report your own final summary only after the log file is complete, pointing
at the file rather than repeating every line back.

