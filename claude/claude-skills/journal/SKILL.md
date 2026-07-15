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

1. Checks if an entry exists for the current (or specified) week
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

- Write like a person recapping their day to a friend, not a changelog. Full sentences, first person.
- A day section is 2-5 sentences. Pick the 1-3 things that mattered; drop the rest. Never enumerate every commit or repo.
- No commit hashes, no version numbers unless the release itself is the story, no file paths, no tool names unless essential.
- Ban list: "shipped X, Y, Z" comma trains; "various fixes"; "cleanup"; starting every sentence with a repo name; bullet lists inside day sections (prose only).
- Read it back once: if a sentence could appear in `git log`, rewrite it or cut it.
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

`/Users/joshua/Documents/Code/journal`

## Implementation

Uses Jekyll locally to build, then deploys prebuilt static output to Vercel via the Build Output API.
