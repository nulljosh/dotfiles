---
name: wiki-refresh
description: Refresh every index/catalog surface (Obsidian wiki index+overview, notes/master.md, ~/Documents/Code/AGENTS.md) for stale app names after a rename, and catch small drift like it. Also audits the Obsidian Entities list's ship-status ordering against real ASC state. Use when asked to refresh the wiki index, or after any app/repo rename, as part of /wrapup step 3.
---

# wiki-refresh

Renames happen often (Brief→Casewright→Litigate, spark→sparkjar, tally→talli, Books→Spine, root→etyma). Historical/dated entries (wrap-log paragraphs in `master.md`, `## Recent (...)` sections) should NOT be touched — they're a record of what was true when written. Only **current-state index sections** need the new name. There are three separate surfaces to check — a rename that lands on one but not the others is the recurring bug this skill exists to catch, so check all three every time, not just the one that was recently edited.

## The three surfaces

1. **Obsidian wiki vault** (the real "Wiki Index" — this is the one people actually read):
   - `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/index.md` — the catalog itself (Entities/Personal/Concepts/Sources sections)
   - `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/pages/_overview.md` — top-level synthesis table
   - `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/pages/<entity>.md` — one page per app; these get updated per-ingest more reliably than the index/overview do, so **treat entity pages as more current than index.md/_overview.md when they conflict** — the index just needs to catch up to what the entity pages already say.
   - This vault is plain files synced by iCloud, not git — no commit/push step here, just save.
   - Read `wiki/AGENTS.md` once per session if you haven't already, for the page-type schema and link conventions (`[[wikilink]]`, kebab-case filenames).
2. **notes repo** (`~/Documents/Code/notes/notes/master.md`): `### Ship Now` checklist, `### Active Projects` table — these are the live index, not history.
3. **`~/Documents/Code/AGENTS.md`**: repo table, `## Ship Status`, `## Stack Conventions` (inline app mentions), `## Roadmap` bullets. Per-app `AGENTS.md` files too, if the rename touched them and wasn't caught at the time.

## Steps
1. Establish the current name for each app from the most authoritative recent source: the rename's own memory file (`~/.Codex/projects/-Users-joshua/memory/project_app_renames.md`), the most recent nightly-wrap paragraph in master.md, or (for the Obsidian vault specifically) the app's own entity page in `wiki/pages/` — that's ground truth, not the index sections.
2. Grep all three surfaces for the *old* name(s). Don't assume a rename already caught on one surface means it's caught everywhere — check each independently.
3. For merged/renamed-and-consolidated apps (e.g. root→etyma), verify there isn't a duplicate/orphaned page or index entry still describing the old name as if it were a separate thing — fold it into the current entity, don't just relabel it.
4. Edit only index/current-state lines to the new name. Add a short `(renamed from X, date)` parenthetical the first time a section mentions it, so the trail isn't lost.
5. Leave every `### Recent (...)` / `**NIGHTLY WRAP...**` paragraph and every `wiki/pages/*.md` entity's own history/changelog section untouched — those are history.
6. Note any DNS/domain or repo-name follow-up implied by the rename (old CNAME now stale, old GitHub repo name) as a roadmap bullet if not already tracked — don't action it, just flag it.
7. Commit + push `notes/notes/master.md` and `~/Documents/Code/AGENTS.md` if changed. The Obsidian vault has no git remote — just save the files.
8. **ASC audit for ship-status order**: `wiki/index.md`'s Entities section is ordered most-shipped to least-shipped (see `wiki/AGENTS.md`'s Index format section for the tier definitions). Memory files and entity pages can be stale, so for any app whose tier is unclear or hasn't been touched in a while, verify with the ASC CLI instead of guessing: `asc apps list` to find the app record, then `asc versions list --app-id <id>` (or the app's own `asc web review show` for a rejection reason) to get its real per-platform state. Re-tier and move that entry if the audit disagrees with where it currently sits. Skip apps that are pure web (no ASC record) — their tier comes from whether the site is live, not ASC.

## Rules
- Never rewrite a past wrap entry or entity-page changelog to use the new name — that's revisionist and breaks the "what was true then" record.
- If unsure whether something is history vs index, check the section heading: `## Roadmap`, `### Ship Now`, `### Active Projects`, repo tables, `wiki/index.md`, `wiki/pages/_overview.md` = index; anything dated with `Recent`/`WRAP`, or a page's own `## Changelog`/`## History` subsection = history.
- Be thorough, not quick: read the actual current content of all three surfaces before editing rather than pattern-matching on the old name alone — a stale entry doesn't always contain the literal old string (e.g. it might say "root repo" without saying "root" as an app name).
