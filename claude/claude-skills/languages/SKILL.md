---
name: languages
description: Sync every app under ~/Documents/Code to full language support + accessibility — audit i18n coverage (master file, locales, wired call sites, Swift catalog) and a11y basics (html lang, alt text, labels, focus, motion, zoom, VoiceOver labels), then fix the gaps. Use when the user says /languages, "language support", "all languages", "accessibility sweep", "a11y", "i18n sync", or after shipping new UI.
---

# /languages — language support + accessibility sync

1. **Audit**: `python3 ~/.claude/skills/languages/audit.py` (add `--json` for machine output). One row per project. Paste the table.

   Columns: `i18n` = master/src-i18n/inline-object/NONE · `coverage` = % translated per locale · `wired` = html/jsx files using `data-i18n` or `t()` · `swiftLit` = hardcoded `Text("…")` · `xcs` = String Catalog exists · then a11y counts (files missing `<html lang>`, `<img>` without alt, icon-only buttons without aria-label, unlabeled inputs, `user-scalable=no`, no `<main>`, `outline:none` without `:focus-visible`, animations without `prefers-reduced-motion`) · `sfimg`/`axlbl` = SF Symbol images vs `.accessibilityLabel/Hidden` calls in Swift.

2. **Fix, worst first**. Priority order: (a) project with UI and i18n `NONE` → (b) master exists but `wired`=0 / `swiftLit` high → (c) locales below ~80% → (d) a11y counts.

   **House locale set**: `en, fr, es, zh, pa` minimum (BC audience: fr, zh, pa; es for reach). Roost has 26, seamark 6 — don't shrink those.

   **i18n, web**: copy `quotestreak/i18n.js` + `quotestreak/scripts/i18n-gen.mjs` (zero-dep, master → `locales/*.json` + `.xcstrings`). Keys are the English literal. Mark each static element `data-i18n="literal"`, dynamic strings `I18N.t("…", {n})`. Runtime sets `document.documentElement.lang`. React/Vite apps: roost's `src/i18n/` pattern instead.

   **i18n, SwiftUI**: `Text("literal")` auto-resolves against the catalog when the key equals the literal — no call-site change. Interpolations become `%lld`/`%@` (gen script handles it). Ternary/helper-param literals bypass extraction; wrap in `String(localized:)`.

   **Translations**: for the first pass use talli's `scripts/i18n-mt.mjs` (DeepL) or write them inline for short UI strings; `review:true` on money/legal strings. Never hand-edit generated files.

   **a11y, web** (all one-liners, do them in the same pass):
   - `<html lang="en">` (runtime overrides per locale)
   - every `<img alt>` (empty `alt=""` for decorative)
   - icon-only `<button>`/`<a>` → `aria-label`
   - inputs → `<label for>` or `aria-label`; placeholder is not a label
   - drop `user-scalable=no` / `maximum-scale=1`
   - one `<main>` landmark, `<nav>` for nav
   - `outline:none` only inside `:focus:not(:focus-visible)`; keep a visible `:focus-visible` ring
   - `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important } }`
   - contrast: body text ≥ 4.5:1 against its background (check tokens.css, not every page)

   **a11y, SwiftUI**: `Image(systemName:)` inside a control → `.accessibilityLabel`, decorative → `.accessibilityHidden(true)`; custom tap targets ≥ 44pt; Dynamic Type — no fixed `.font(.system(size:))` on body text; test with VoiceOver once per app.

3. **Verify**: re-run the audit, counts should drop; open one page per fixed app with `?lang=fr` (or switch `navigator.language`) and tab through it once.

4. **Ship**: commit + push per repo (auto-push rule), deploy web (Cloudflare first). For native, only bump/submit if the change is user-visible and the app is not mid-review.

## Relation to other skills
`/localization-sweep` is the deeper string-extraction pass for one project; `/languages` is the fleet-wide sync that includes accessibility. Run `/languages` first, `/localization-sweep` on whatever it flags red.

## Usage awareness
Audit is one script, no subagents. Fixing is per-project Edit work — batch the a11y one-liners across many repos in one sitting; do i18n wiring one app at a time, highest-traffic first.
