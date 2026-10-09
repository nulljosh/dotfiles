---
name: asc-whats-new-writer
description: Generate engaging, localized App Store release notes (What's New) from git log, bullet points, or free text using canonical metadata under `./metadata`. Optionally pairs with promotional text updates.
---

# asc What's New Writer

Generate engaging, localized release notes from flexible input, optionally paired with promotional text updates.

## Preconditions
- Metadata pulled locally via `asc metadata pull --app "APP_ID" --version "1.2.3" --dir "./metadata"`, or user provides keywords manually.
- Auth configured for upload (`asc auth login` or `ASC_*` env vars).
- Primary locale is `en-US` unless specified otherwise.

## Before you start
1. Read `references/release_notes_guidelines.md` for tone, structure, examples.
2. Identify the latest version directory under `metadata/version/` (highest semver) — use it for all metadata reads.
3. Enumerate existing locales from the JSON files in that version directory.

## Phase 1: gather input (auto-detect one of three)
- **Git log**: `git describe --tags --abbrev=0` for latest tag, then `git log <tag>..HEAD --oneline --no-merges`. Filter out merge commits, dependency bumps, CI changes, formatting-only commits — extract user-facing changes.
- **Bullet points**: rough bullets like "improved search", "fixed crash on launch", "added sleep timer".
- **Free text**: conversational description ("We made search faster, fixed that crash on open, added a sleep timer") — extract and structure the changes.
- **No input**: ask "What changed in this release? You can paste git log output, bullet points, or just describe the changes."

## Phase 2: draft notes (primary locale)
1. **Classify** into New / Improved / Fixed per the guidelines. Omit empty sections — if everything's a fix, show only "Fixed."
2. **Write benefit-focused copy** — user impact not implementation, direct address ("you") and action verbs, specific concrete improvements.
3. **Front-load the hook** — first ~170 chars is all that's visible before "more"; lead with the single most impactful change as a complete, compelling sentence.
4. **Echo keywords for conversion** — read `keywords` from `metadata/version/{latest}/{primary-locale}.json` (same file `asc metadata keywords ...` reads/writes); skip if empty; weave relevant ones in naturally, never stuff.
5. **Character limits** — total 500-1500 chars in the primary locale (leaves room for locales that expand 30-40%); hard limit 4000.
6. **Optional promotional text** — 170-char punchy line summarizing the update's theme, can reference seasonal events, updatable without a new submission.
7. **Present the draft with character count, wait for approval before localizing.**

## Phase 3: localize
Translate approved notes to all existing locales.
- Formal register, formal "you" forms (Russian вы, German Sie, French vous, Spanish usted, Dutch u, Italian Lei). Adapt tone to local market — playful English may need to be more formal for ja, de-DE. Don't literally translate idioms — adapt to local equivalents.
- Per locale: read `keywords` from `metadata/version/{latest}/{locale}.json`, echo naturally if present, skip if empty.
- Validate: all translations ≤4000 chars, promo text ≤170 chars per locale. Over limit → shorten, never truncate mid-sentence.

## Phase 4: review & upload
1. Present a summary table of all locales with notes and character counts:
```
| Locale | What's New (first 80 chars...) | Chars | Promo Text | Chars |
|--------|-------------------------------|-------|------------|-------|
| en-US  | Search just got faster — ...   | 847   | New sleep… | 142   |
| ar-SA  | البحث أصبح أسرع — ...           | 923   | نوم جديد…  | 138   |
```
2. Wait for user approval — never upload without it.
3. Upload (verify exact syntax with `asc --help`):
```bash
asc apps info edit --app "APP_ID" --version-id "VERSION_ID" --locale "en-US" --whats-new "Your release notes here"   # individual locale
# bulk, after writing ./metadata/version/<version>/<locale>.json:
asc metadata push --app "APP_ID" --version "1.2.3" --dir "./metadata" --dry-run
asc metadata push --app "APP_ID" --version "1.2.3" --dir "./metadata"
```
If promo text was drafted, include `--promotional-text "..."` on the direct update, or write `promotionalText` into the canonical JSON before `asc metadata push`.
4. On partial upload failure, report which locales succeeded/failed, offer to retry failed ones.

## Metadata file paths
- Keywords and current What's New: `metadata/version/{latest-version}/{locale}.json` → `keywords` / `whatsNew` fields.
- Latest version = highest semver directory under `metadata/version/`.
- Same canonical `./metadata` tree that `asc metadata pull/push` and `asc metadata keywords ...` operate on, and the same resolution conventions as `asc-aso-audit`.

## Notes
- What's New isn't indexed for App Store search — write for humans, not algorithms.
- Promotional text is the only field updatable without a new submission.
- The 170-char visible window is the most important part of the notes.
- Each update triggers algorithm re-evaluation — the act of updating matters even if the text doesn't affect ranking. Ideal cadence: every 2-4 weeks.
- Full metadata translation (all fields) → `asc-localize-metadata`. Keyword research/optimization → `asc-aso-audit` first.
- Stale local keyword field before drafting → refresh with `asc metadata pull`, or inspect planned changes with `asc metadata keywords diff`.
