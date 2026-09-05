---
name: localization-sweep
description: Detect hardcoded strings, missing translations, and unwired i18n pipelines across ~/Documents/Code. Use when auditing localization/i18n coverage, after adding UI text, or invoked as /localization-sweep.
---

# localization-sweep

Run `~/.claude/skills/localization-sweep/audit.sh` and report the table.

## What it checks
- Per-project `i18n/strings.json` master files: key count + configured locales.
- Web: whether files actually call `t()`/`I18N.t()`, not just load the runtime script.
- iOS: literal `Text("...")`/`Button("...")` calls vs. `String(localized:)`/`LocalizedStringResource` call sites — a catalog (`.xcstrings`) existing with zero call sites means the UI is still hardcoded English even though translation infra exists (this exact gap was found in talli 2026-08-02: 51-key pipeline generated web JSON + xcstrings, but no Swift file or web literal ever called into it).
- Projects with UI files but no `i18n/strings.json` at all — candidates never localized.

## Fixing what it finds
1. **No master file yet**: create `i18n/strings.json` (see talli's for the schema: `_meta.sourceLanguage`, `_meta.locales`, then `key: {en: "...", fr: "...", ...}`), write a generator script modeled on talli's `scripts/i18n-gen.mjs` (zero deps, master → web JSON + `.xcstrings`).
2. **Catalog exists, nothing wired (the common failure mode)**: this is the real work, not a one-liner —
   - Web: replace hardcoded literals with `I18N.t("key")` / `data-i18n="key"` at each site the audit flags.
   - iOS: replace `Text("English literal")` with `Text(String(localized: "key.name"))` (or give the catalog key = the literal itself and let Xcode's automatic extraction handle it — simpler if keys don't already diverge from the English text).
   - Watch for **interpolated/ternary Text()** (`Text(cond ? "A" : "B")`, `Text("...\(var)...")`) and **literals passed through a helper function param** (e.g. `benefitRow("Hardcoded", ...)`) — both silently bypass Xcode's automatic extraction even when the catalog exists.
3. Re-run `scripts/i18n-gen.mjs` (or equivalent) after adding/editing keys, never hand-edit the generated `.xcstrings`/`web/locales/*.json`.
4. Test locale switching + `Intl`/`Locale` date/number/currency formatting per locale, not just string swap.

## When to run
Manually, per `~/Documents/Code/CLAUDE.md`'s no-background-automation rule — no CI/cron wiring. Good candidates: after shipping new UI in any app, before a release, or periodically across the whole codebase (`/localization-sweep`).

## Usage awareness
`audit.sh` itself is cheap (one script, no subagents) — the cost is in the fixing step. When usage is tight, fix the highest-signal gap first (a catalog with zero call sites, or a project with recent UI commits and no `i18n/strings.json` at all) instead of wiring every flagged project in one sitting. Wiring per-project is manual Edit work, not something to fan out across parallel agents.
