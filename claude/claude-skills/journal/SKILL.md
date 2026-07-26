---
name: journal
description: Manage weekly journal entries at journal.heyitsmejosh.com
model: haiku
---

# Journal: Weekly Entry Manager

Create or update weekly journal entries for journal.heyitsmejosh.com, following the established format and style.

## Usage

```bash
/journal              # Create or update this week's entry (interactive)
/journal <date>       # Create entry for specific date (YYYY-MM-DD format)
/journal push         # Deploy latest changes to production
/journal open         # Open current week's entry in browser
```

## What it does

1. Checks if an entry exists for the current (or specified) week. **Staleness check first:** if the latest post's frontmatter `date:` is more than ~10 days before today, or the file is larger than ~20KB, do NOT append — start a new post instead (see `inkpress/CLAUDE.md`'s size/staleness exception). This is what keeps entries readable; the old rule of always appending to "this month's" post let one post silently grow to 157KB/18 days stale before anyone noticed.
2. If missing: creates a new markdown post with SVG header, following journal rules
3. If exists: offers to update or refresh the entry
4. Collects recent codebase work from memory and git history
5. Generates entry with natural English, technical but readable style
6. Creates matching monochrome SVG header (matches site CSS)
7. Commits changes with a short git message summarizing what was added
8. Deploys automatically via `./scripts/deploy.sh` to Vercel (no prompt)
9. After deploy, outputs a bullet-point TLDR of what was added/changed

## Rules

- One post per week (Friday or Sunday date)
- Filename format: `YYYY-MM-DD-slug.md` (slug becomes URL)
- No em-dashes, filler phrases, or emojis
- Posts must be in natural English, not tool-spam

## Voice (entries were getting spammy — follow these)

- Write like a person recapping their day to a friend, not a changelog. Full sentences, first person ("I fixed...", "Spent the evening on...") — not third person ("Joshua fixed...", "the user asked..."). This is Joshua's own journal; write as him.
- A day section is 2-5 sentences. Pick the 1-3 things that mattered; drop the rest. Never enumerate every commit or repo.
- No commit hashes, no version numbers unless the release itself is the story, no file paths, no tool names unless essential, no bundle IDs / error codes / ASC jargon unless the story genuinely is about that error.
- Ban list: "shipped X, Y, Z" comma trains; "various fixes"; "cleanup"; starting every sentence with a repo name; bullet lists inside day sections (prose only); enterprise-log phrasing like "landed," "resolved," "root cause," "server-side enforcement" — say what happened and why it mattered, not the engineering-report version of it.
- Read it back once: if a sentence could appear in `git log` or a PR description, rewrite it or cut it. If it doesn't sound like something you'd actually say out loud, rewrite it.

**Bad (robotic, third person, changelog):** "Epiphany landed two critical Stripe fixes — the webhook price lookup now correctly resolves product IDs instead of passing undefined values, and payment failures are now properly handled when events arrive. The People graph and Daily Brief features are now gated behind a Pro subscription with server-side isPro() enforcement."

**Good (human, first person, what it means):** "Spent a chunk of tonight actually making Epiphany's Stripe setup work right — turned out the webhook had been silently failing to record what people paid for, so I fixed that, plus what happens if a card gets declined. Also put the People search and Daily Brief behind the paid tier, since they were fully built and just... free this whole time."

- **Never create a second `##` heading for a day that already has one.** Grep the post for the existing heading (`## Friday`, `## Saturday (2026-07-18)`, etc.) before writing anything. If it exists, append a new paragraph inside that section — don't add "## Friday (evening)" or "## Friday (continued)" next to it. One heading per day, always.
- Titles under 6 words, punchy and short
- Day-by-day sections (sunday through saturday, selective)
- Include apps summary section at end
- Deploy via `./scripts/deploy.sh` only (never plain `git push`)

## Example

```bash
/journal
# Detects week of 2026-06-16, creates 2026-06-14-week.md entry

/journal 2026-06-21
# Creates entry for 2026-06-21

/journal push
# Deploys current entry to journal.heyitsmejosh.com
```

## Project Location

`/Users/joshua/Documents/Code/journal` (blog split from `inkpress` into its own repo 2026-07-21 — `inkpress` is now the RSS-reader iOS app only, unrelated repo)

## Implementation

Uses Jekyll locally to build, then deploys prebuilt static output to Vercel via the Build Output API.
