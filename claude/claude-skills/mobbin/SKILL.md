---
name: mobbin
description: Pull real app UI references from Mobbin for a screen type or app (e.g. "onboarding", "paywall", "Airbnb search"), then turn them into concrete design notes for the current project. Use when the user says /mobbin, "mobbin", "find UI references", or asks what a screen should look like.
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
