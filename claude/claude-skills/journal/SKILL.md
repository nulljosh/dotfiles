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
- **Title is one word.** Frontmatter `title:` is a single word, no ampersands, no commas, no "X and Y" ("Typeface", "Avatar", "Merge"). Pick the one thing the week was actually about.
- **`scripts/lint-posts.py` in the journal repo now enforces every rule below and runs from `deploy.sh`.** Run it before committing and fix what it reports; do not raise the caps to make it pass. These rules were prose-only twice and ignored twice, which is why the gate exists.
- **Length ceiling: ~350 words per post** (500 for `categories: journal monthly`)**.** Two or three day sections, each 2-4 sentences, plus a two-line Apps line. If it's longer than a phone screen or two, cut. Entries got bloated to 8-12KB walls of text; that's the failure mode to avoid.
- Filename format: `YYYY-MM-DD-slug.md` (slug becomes URL). Slug is a single word — pick whichever topic mattered most that week, don't hyphenate multiple words together (e.g. "renames and widgets" → `renames`, not `renames-and-widgets`).
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
- Explain what a change means in plain terms, not what the code does. "the booking form had been throwing away every lead" beats "the form used alert() with no persistence". Skip function names, parameter names, regex details, commit hashes, build numbers.
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

## Header SVG (house style, not optional)

The header is an **information card summarizing the entry**, never decorative icons.
800x500, rounded border frame, one-word title at 42px weight 300, lowercase subtitle,
hairline rule, repos touched, four or five short lines of what happened, a right-hand
panel (200x280 at x=560) with a label + one big number + in-flight items, date bottom
left. Copy `journal/_includes/headers/2026-08-17-fortified.svg` and edit the text.

Never draw clipart (shields, locks, puzzle pieces) and never fall back to a big title
word on a 1200x200 banner. Both happened and both were reverted 2026-08-18. Use
`currentColor` on every shape, give the file a `viewBox`, and never put colour only
inside a `prefers-color-scheme` block. Save to `_includes/headers/` and reference it
with `{% include headers/<name>.svg %}`.
