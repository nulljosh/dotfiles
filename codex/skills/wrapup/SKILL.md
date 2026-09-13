---
name: wrapup
description: Record a completed coding session in Joshua's journal and Obsidian wiki, refresh relevant project state, then publish and push the resulting changes. Use when asked to wrap up a session or journal and ingest its work.
---

# Wrap up a session

Record what actually happened in this session. Use the conversation and the relevant repos' diffs, commits, and live checks as evidence. A recent git log is a cross-check, not a substitute for the session: other work may have landed in the same time window. Do not claim that an automated test proves a real-device test.

## Journal

Read `~/Documents/Code/journal/CLAUDE.md` and the latest post before editing. Follow the current rules there, especially the few-large-entries preference, word limits, and first-person voice. Merge a short natural-English account into the current period's post when appropriate; do not create duplicate day sections or a new post just for a small wrap. Describe what the work meant, not a commit log. Run `python3 scripts/lint-posts.py` in the journal repo and fix its findings.

Publish journal changes with `./scripts/deploy.sh`, verify the live post URL, then commit and push the journal repo. A git push alone does not deploy this site.

## Wiki and project state

Read `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/CLAUDE.md` before editing the Obsidian vault. Update the entity pages for projects actually touched, using their current state and the wiki's frontmatter and `[[wikilink]]` conventions. Refresh `wiki/index.md` and `wiki/pages/_overview.md` only where the work changes their summaries or ordering. Append a concise wrap entry to `wiki/log.md`. The vault is iCloud-synced plain files; there is no git push for it.

Read `~/Documents/Code/notes/CLAUDE.md` before changing `notes/notes/master.md`. Correct live status, active-project, or open-work lines that this session made stale. Preserve dated historical entries. Commit and push the notes repo if it changed. Check the touched projects' roadmaps and `~/Documents/Code/CLAUDE.md` for stale current-state claims; update and push only files that need correction. Do not sweep unrelated repos or rewrite history.

## Finish

Before staging in any repo, inspect its status and diff so unrelated work stays untouched. Stage explicit files, run relevant checks, commit, and push. If a push is rejected, fetch and integrate remote commits without overwriting them. Report briefly what reached the journal, wiki, and repos, with the journal link and any work still pending.
