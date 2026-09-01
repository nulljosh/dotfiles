---
name: mobbin
description: Pull real app UI references from Mobbin for a screen type or app (e.g. "onboarding", "paywall", "Airbnb search"), then turn them into concrete design notes for the current project. Also clones the style/vibe of comparable apps into the current project's design system. Use when the user says /mobbin, "mobbin", "find UI references", "make this look like a real app", or asks what a screen should look like.
---

# Mobbin

Mobbin has no public API and requires a logged-in session. Drive the user's Chrome.

## Steps

1. Load browser tools in ONE call:
   `ToolSearch select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__tabs_close_mcp`
2. `tabs_context_mcp`, then open a new tab at:
   `https://mobbin.com/search/ios/screens?query=<url-encoded query>`
   Use `android` or `web` in place of `ios` when the target platform differs.
   Searching a specific app instead? `https://mobbin.com/browse/ios/apps` and filter by name.
   Both verified 200; `/discover/...` is 404 — do not guess other URL shapes.
3. If it lands on a login wall, stop and tell the user to sign in to Mobbin in Chrome. Do not attempt credentials.
4. Screenshot the results grid. Open 3-5 relevant screens and screenshot each.

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
2. Search that category on Mobbin (`https://mobbin.com/search/ios/apps?query=<category>`
   for apps, `.../screens?query=` for screens). Pick 3 shipped apps that are the
   closest real analogue, not the most famous ones.
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

