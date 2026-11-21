---
name: finish-line
description: After any visible change to an app, do the whole finish line without being asked. Refresh README screenshots, sync the GitHub description and topics, check docs, brand and design-system drift, build and deploy the landing, verify it live, and send Joshua the screenshots. Use for /finish-line, "finish it", "polish it", after a visible feature ships, or before reporting a visible change as done.
---

# Finish line

Joshua should never have to list these. A visible change is not done until all of them are, or until each one has a one-line reason it was skipped. Work in the repo's own git checkout and commit by exact path.

1. **Screenshots.**
   - Capture the real app from a Release build, so no debug counters show. Use `screencapture -x -o -l <window id>`, which works even when the window is covered (CGWindowList finds the id; floating windows sit on layer 3, so don't filter by layer).
   - Replace the stale images the README points to, and keep the alt text true.
   - Use the web app or a headless browser for web projects, and capture at desktop and at 390 px.
2. **GitHub.**
   - Set the description to one short, sweet sentence that says what it is, with no feature list.
   - Set the homepage to the live URL, and set the topics.
   - Use `gh repo edit <owner/repo> --description ... --homepage ... --add-topic ...`.
3. **Docs.**
   - README, CHANGELOG (today's entry), CLAUDE.md, WHITEPAPER and docs/*.md must match what shipped.
   - Version numbers come from the project file, never invented.
   - Badges must point at the repo that actually runs CI.
   - Use the house voice: no em dashes, no emojis.
   - For a full audit, run the `docs` skill.
4. **Brand and design system.**
   - The app accent must equal `brand/tokens.css`.
   - Fonts must match BRAND.md, which records any custom face.
   - The icon in the app, README, landing and favicons must be the same glyph.
   - Fix drift, don't just note it.
5. **Landing.**
   - Build and deploy it (`scripts/build-site.sh` or the repo's deploy script, then `npx wrangler deploy` or `pages deploy`). A push deploys nothing.
   - Curl the live URL and check the new text or asset is served.
6. **Proof.**
   - Send Joshua the screenshots with SendUserFile.
   - If the change is a flow, run the `show-me` skill for a video.
7. **Record.** Check off the roadmap line, and update the loop handoff if one exists.

Report in at most 3 lines: what shipped, the live URL, and anything skipped with its reason.
