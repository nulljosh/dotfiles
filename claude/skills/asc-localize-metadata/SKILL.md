---
name: asc-localize-metadata
description: Automatically translate and sync App Store metadata (description, keywords, what's new, subtitle) to multiple languages using LLM translation and asc CLI. Use when asked to localize an app's App Store listing, translate app descriptions, or add new languages to App Store Connect.
---

# asc localize metadata

Pull source-locale App Store metadata, translate with LLM, push back to App Store Connect — automated.

## Command discovery and output conventions
- Confirm flags with `--help` for the exact `asc` version: `asc localizations --help`, `asc localizations download --help`, `asc localizations upload --help`, `asc apps info edit --help`.
- Prefer explicit long flags (`--app`, `--version`, `--version-id`, `--type`, `--app-info`).
- Default output is JSON; `--output table` only for human verification steps.
- Prefer deterministic ID-based operations — never "pick the first row" via `head -1` unless the user explicitly agrees.

## Preconditions
- Auth configured (`asc auth login` or `ASC_*` env vars)
- Know the app ID (`asc apps list`)
- At least one locale (typically en-US) already has metadata in App Store Connect

## Supported locales
```
ar-SA, ca, cs, da, de-DE, el, en-AU, en-CA, en-GB, en-US,
es-ES, es-MX, fi, fr-CA, fr-FR, he, hi, hr, hu, id, it,
ja, ko, ms, nl-NL, no, pl, pt-BR, pt-PT, ro, ru, sk,
sv, th, tr, uk, vi, zh-Hans, zh-Hant
```

## Two types of metadata
- **Version localizations** (per-release): `description`, `keywords`, `whatsNew`, `supportUrl`, `marketingUrl`, `promotionalText`
- **App info localizations** (app-level, persistent, `--type app-info`): `name`, `subtitle`, `privacyPolicyUrl`, `privacyChoicesUrl`, `privacyPolicyText`

## Workflow

### 1. Resolve IDs
```bash
asc apps list --output table
asc versions list --app "APP_ID" --state READY_FOR_DISTRIBUTION --output table    # or PREPARE_FOR_SUBMISSION for editable
asc apps info list --app "APP_ID" --output table   # app info ID, for name/subtitle
```
Version-localization fields are per-version; app-info fields are app-level (`--type app-info`). Only have names, not IDs? Use `asc-id-resolver`.

### 2. Download source locale
```bash
asc localizations download --version "VERSION_ID" --path "./localizations"
asc localizations download --app "APP_ID" --type app-info --app-info "APP_INFO_ID" --path "./app-info-localizations"
```
Creates `./localizations/en-US.strings` and `./app-info-localizations/en-US.strings`. If download is unavailable: `asc localizations list --version "VERSION_ID" --output table`.

### 3. Translate with LLM

Rules for every locale:
- **Tone**: always formal/polite. Use formal "you" where the language distinguishes it (Russian «вы», German «Sie», French «vous», Spanish «usted», Dutch «u», Italian «Lei», Portuguese «você» formal). App Store copy is professional marketing — never informal register. Respect cultural context (a playful English tone may need adjusting for formal markets like ja, de-DE).
- **description**: natural, fluent translation, adapt tone to local market. Preserve formatting (line breaks, bullets, emoji). Max 4000 chars.
- **keywords**: do NOT literally translate — research what users in that locale actually search for. Comma-separated, max 100 chars total, no duplicates, no app name (Apple adds it automatically).
- **whatsNew**: translate release notes, concise, max 4000 chars.
- **promotionalText**: marketing hook, max 170 chars, can be updated without a new version.
- **subtitle**: translate/adapt tagline, max 30 chars — tight, may need creative adaptation.
- **name**: usually keep the original; translate only if explicitly asked. Max 30 chars.

Prompt template (fill `{source_locale}`, `{target_locale}`, and the field values, then apply the rules above verbatim as the prompt's rule list):
```
Translate the following App Store metadata from {source_locale} to {target_locale}.
[rules as above]

Source ({source_locale}):
description: """{description}"""
keywords: {keywords}
whatsNew: """{whatsNew}"""
promotionalText: {promotionalText}
name: {name}
subtitle: {subtitle}
```

### 4. Upload translations

**Option A — .strings files (bulk).** One file per locale:
```
// nl-NL.strings (version localization)
"description" = "Je app-beschrijving hier";
"keywords" = "wiskunde,kinderen,tafels,leren";
"whatsNew" = "Bugfixes en verbeteringen";
"promotionalText" = "Leer de tafels van vermenigvuldiging!";
```
```
// nl-NL.strings (app-info localization)
"subtitle" = "Leer tafels spelenderwijs";
```
```bash
asc localizations upload --version "VERSION_ID" --path "./localizations"
asc localizations upload --app "APP_ID" --type app-info --app-info "APP_INFO_ID" --path "./app-info-localizations"
```

**Option B — individual commands (fine control).** No `apps info localizations` command exists — app-level fields still go through the app-info `.strings` + upload flow above.
```bash
asc apps info edit --app "APP_ID" --version-id "VERSION_ID" --locale "nl-NL" \
  --description "Je beschrijving..." --keywords "wiskunde,kinderen,tafels" --whats-new "Bugfixes en verbeteringen"
```

### 5. Verify
```bash
asc localizations list --version "VERSION_ID" --output table
asc localizations list --app "APP_ID" --type app-info --app-info "APP_INFO_ID" --output table
```

## Character limits (enforce before upload)
| Field | Limit |
|-------|-------|
| Name | 30 |
| Subtitle | 30 |
| Keywords | 100 (comma-separated) |
| Description | 4000 |
| What's New | 4000 |
| Promotional Text | 170 |

Always validate translated text fits before uploading — if it overflows, shorten it, never truncate mid-sentence.

## Full example: add nl-NL and ru to an app
```bash
asc apps list --output table                                                  # 1. resolve IDs (asc-id-resolver if only names)
APP_ID="APP_ID_HERE"
asc versions list --app "$APP_ID" --state PREPARE_FOR_SUBMISSION --output table
VERSION_ID="VERSION_ID_HERE"
asc apps info list --app "$APP_ID" --output table
APP_INFO_ID="APP_INFO_ID_HERE"

asc localizations download --version "$VERSION_ID" --path "./localizations"   # 2. download source
asc localizations download --app "$APP_ID" --type app-info --app-info "$APP_INFO_ID" --path "./app-info-localizations"

# 3. translate en-US.strings -> nl-NL.strings, ru.strings (LLM step, both dirs)

asc localizations upload --version "$VERSION_ID" --path "./localizations"     # 4. upload
asc localizations upload --app "$APP_ID" --type app-info --app-info "$APP_INFO_ID" --path "./app-info-localizations"

asc localizations list --version "$VERSION_ID" --output table                 # 5. verify
asc localizations list --app "$APP_ID" --type app-info --app-info "$APP_INFO_ID" --output table
```

## Agent behavior
1. Always read the source locale first — never translate from memory or assumptions.
2. Check existing localizations first — don't overwrite unless asked to update.
3. Version fields live under `--version "VERSION_ID"`; subtitle/name/privacy live under `--app ... --type app-info`.
4. Prefer deterministic IDs — no `head -1` guessing; use `--output table` or `asc-id-resolver`.
5. Validate character limits before uploading; re-translate shorter if over.
6. Keywords are special — research locale-appropriate search terms, don't literally translate.
7. Show the user a translations summary table (fields × locales) for approval before uploading.
8. Process one locale at a time when translating many languages — easier to review.
9. On upload failure for a locale, log it, continue with the rest, report all failures at the end.
10. For updates to existing localizations, download current, show a diff, get approval, then upload.

## Notes
- Version localizations are tied to a specific version — create the version first if it doesn't exist.
- `promotionalText` can be updated anytime without a new version submission.
- `whatsNew` only matters for updates, not the first version.
- Only have names, not IDs? Use `asc-id-resolver`. Non-translation metadata ops → `asc-metadata-sync`. Subscription/IAP display-name localization → `asc-subscription-localization`.
