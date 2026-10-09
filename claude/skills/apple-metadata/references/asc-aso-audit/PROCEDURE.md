---
name: asc-aso-audit
description: Run an offline ASO audit on canonical App Store metadata under `./metadata` and surface keyword gaps using Astro MCP. Use after pulling metadata with `asc metadata pull`.
---

# asc ASO audit

Two-phase ASO audit: offline checks against local metadata, then keyword gap analysis via Astro MCP. Include Apple-generated app tags as a discoverability signal when available.

## Preconditions
- Metadata pulled locally via `asc metadata pull --app "APP_ID" --version "1.2.3" --dir "./metadata"`. Metadata from `asc migrate export` or `asc localizations download` needs normalizing into the canonical `./metadata` layout first.
- Astro gap analysis needs the app tracked in Astro MCP (optional — offline checks run without it).
- Apple discoverability tags: `asc app-tags list --app "APP_ID" --output json` (works when the API returns tags for the app).

## Before you start
1. Read `references/aso_rules.md` for the rules each check enforces.
2. Identify the latest version directory under `metadata/version/` (highest semver) — use it for all version-level fields.
3. Primary locale is `en-US` unless the user says otherwise.

## Metadata file paths
- App-info (`subtitle`): `metadata/app-info/{locale}.json`
- Version fields (`keywords`, `description`, `whatsNew`): `metadata/version/{latest-version}/{locale}.json`
- App name: may be missing from exported metadata — fetch via `asc apps info list` or ask the user, don't flag as a missing-field error.

## Phase 1: offline checks (no network)

**1. Keyword waste.** Tokenize `subtitle` (+ `name` if present); flag any token also in `keywords` — already indexed, wastes budget.
`⚠️ Warning — "quran" appears in subtitle AND keywords — remove from keywords to free 6 characters`
- Latin/Cyrillic: split by whitespace, strip punctuation, lowercase.
- CJK: split by `、` `，` `,` or iterate characters — whitespace tokenization doesn't work here.
- Arabic: split by whitespace, also generate prefix-stripped variants (strip ال) since Apple likely normalizes definite articles — e.g. "القرآن" in subtitle should flag both "القرآن" and "قرآن" in keywords.
- Split keywords by comma, trim, lowercase, report intersection (including fuzzy prefix matches).

**Optional: app tag alignment.** App tags are Apple-generated, not editable, but useful evidence of whether Apple's classification matches intended positioning.
```bash
asc app-tags list --app "APP_ID" --output json
asc app-tags view --app "APP_ID" --id "TAG_ID" --output json
```
Note alignment if tags reinforce the subtitle/keyword strategy; recommend metadata/category changes if tags point to an unintended category. Don't promise metadata changes will immediately change Apple-generated tags.

**2. Underutilized fields.**
| Field | Minimum | Limit | Rationale |
|-------|---------|-------|-----------|
| Keywords | 90 chars | 100 | 90%+ usage maximizes indexing |
| Subtitle | 20 chars | 30 | 65%+ usage recommended |

`⚠️ Warning — keywords is 62/100 characters (62%) — 38 characters of indexing opportunity unused`

**3. Missing fields.** Flag empty/missing: `subtitle`, `keywords`, `description`, `whatsNew`. `name` may not be in the export — only flag if the app-info JSON has a `name` key with an empty value.
`❌ Error — subtitle is empty for locale en-US`

**4. Bad keyword separators.** Check `keywords` for spaces after commas (`quran, recitation`), semicolons (`quran;recitation`), pipes (`quran|recitation`).
`❌ Error — keywords contain spaces after commas — wastes 3 characters`

**5. Cross-locale keyword gaps.** Compare `keywords` across locales; flag locales identical to primary (`en-US`) — usually means not localized.
`⚠️ Warning — ar keywords identical to en-US — likely not localized for Arabic market`
Check: load keywords for all locales, compare each non-primary to primary, flag exact matches (case-insensitive).

**6. Description keyword coverage.** Apple doesn't index descriptions for search, but users seeing their search terms reflected convert better — indirectly boosts rankings.
`💡 Info — 3 of 16 keywords not found in description: namaz, tarteel, adhan`
Check each keyword as a substring of the description (case-insensitive), per locale. Account for inflected forms: Arabic root matches, verb conjugations ("memorizar" ≈ "memorices"), case declensions (Russian "сура" ≈ "суры"). Don't flag Latin-script keywords in non-Latin descriptions (e.g. "quran" in Cyrillic text) — separate search paths.

## Phase 2: Astro MCP keyword gap analysis

Run if Astro MCP is available and the app is tracked. **Run per store/locale, not just US** — keyword popularity varies dramatically across markets.

1. `get_app_keywords` — current tracked keywords and rankings.
2. For each locale with a corresponding territory (`ar-SA`→Saudi Arabia, `fr-FR`→France, `tr`→Turkey), use `add_keywords` to add tracking in that store — without it `search_rankings` returns empty for non-US stores.
3. `extract_competitors_keywords` with 3-5 top competitor app IDs — highest-value Astro tool, reveals keywords competitors rank for that you don't. Run per store when possible.
4. `get_keyword_suggestions` — category-based recommendations.
5. `search_rankings` — current rankings for tracked keywords per store.
6. Diff suggested/competitor keywords against tokens in `subtitle`, `name`, `keywords`.
7. Report all gaps ranked by popularity score (highest first), with source (competitor vs. suggestion).

**Cross-field combo strategy**: consider how single words combine across title + subtitle + keywords — e.g. adding "namaz" to keywords when "vakti" is already present matches "namaz vakti" (66 popularity); adding "holy" to keywords when "Quran" is in the subtitle matches "holy quran" (58 popularity). Flag high-value combos.

**Skip conditions**: Astro not connected → "Connect Astro MCP for keyword gap analysis". App not tracked → "Add app to Astro with `mcp__astro__add_app` for gap analysis". Store not tracked for a locale → add with `add_keywords` before querying.

## Phase 3: AppSigma competitor signals (optional)

If `appsigma` MCP is connected, pull competitor review/ranking signals to complement Astro's gaps.
1. For each Phase 2 competitor app ID, fetch recent reviews and rating histogram.
2. Surface recurring complaint themes (e.g. "crashes on iOS 18", "no dark mode") as feature-gap opportunities relevant to `whatsNew`/description positioning (not ASO fields themselves).
3. Fetch chart position/history for the competitor set — a keyword a #3-ranked competitor owns matters more than one from a #400 app.

**Skip condition**: not connected → "Add `appsigma` MCP server for competitor review/chart signals (`claude mcp add --transport http appsigma https://api.appsigma.io/mcp --header \"X-API-Key: YOUR_KEY\"`)"

## Output format

Single audit report, covering only the latest version directory:

```
### ASO Audit Report

**App:** [name] | **Primary Locale:** [locale]
**Metadata source:** [path including version number]

#### Field Utilization
| Field | Value | Length | Limit | Usage |
|-------|-------|--------|-------|-------|
| Name | ... | X | 30 | X% |
| Subtitle | ... | X | 30 | X% |
| Keywords | ... | X | 100 | X% |
| Promotional Text | ... | X | 170 | X% |
| Description | (first 50 chars)... | X | 4000 | X% |

#### Offline Checks
| # | Check | Severity | Field | Locale | Detail |
|---|-------|----------|-------|--------|--------|
| 1 | Keyword waste | ⚠️ | keywords | en-US | "quran" duplicated in subtitle |

**Summary:** X errors, Y warnings across Z locales

#### Keyword Gap Analysis (Astro MCP)
| Keyword | Popularity | In Metadata? | Suggested Action |
|---------|-----------|--------------|-----------------|
| quran recitation | 72 | ❌ | Add to keywords |

#### Recommendations
1. [Highest priority — errors first]
2. [Next — keyword waste]
3. [Utilization improvements]
4. [Keyword gap opportunities]
```

## Notes
- Offline checks read local files only, no network needed. Astro gap analysis is additive — audit still useful without it.
- Run after `asc metadata pull` so canonical metadata is current.
- Keyword-only follow-up: `asc metadata keywords diff --app "APP_ID" --version "1.2.3" --dir "./metadata"`, then `asc metadata keywords apply ... --confirm`, or `asc metadata keywords sync ... --input "./keywords.csv"` for external keyword research.
- Re-run the audit after changes to verify fixes.
- Field Utilization table includes promotional text for completeness, but no check validates its content — Apple doesn't index it.
