---
name: vibe-sync
description: Audit UI/design-token drift across all projects under ~/Documents/Code, rank best-to-worst, and bring outliers in line with the best-scoring reference projects. Companion to /vibe (which pulls tokens from an external URL) — this works project-to-project, internally. Use when asked to check design consistency across the codebase, fix "vibe drift", or invoked as /vibe-sync.
---

# Vibe Sync: Internal Design Drift Auditor

Where `/vibe` pulls tokens from an *external* URL into one project, `/vibe-sync`
looks *inward* — across every project under `~/Documents/Code` — ranks them by
UI/vibe quality, and brings the worst offenders in line with the best.

## Usage

```
/vibe-sync                # full audit + apply fixes to worst offenders
/vibe-sync --audit-only   # ranking table only, no edits
```

## 1. Survey

List every top-level project dir, then for each one find its stylesheets:

```bash
cd ~/Documents/Code && ls -d */
find "$project" -iname "*token*.css" -o -iname "design-tokens.css" -o -iname "*.css" \
  | grep -v node_modules | grep -v build
```

For each stylesheet found, pull:
- font-family declarations (pairing intentionality — a body sans + a display serif/mono is a signal of intent; system-default-everywhere is neutral, not bad)
- color tokens (`--bg`, `--text`, accent) and whether light/dark are both defined
- gradient usage: `grep -rl "linear-gradient\|radial-gradient" "$project" --include="*.css" --include="*.tsx" --include="*.jsx" --include="*.html" | grep -v node_modules`
- anything matching the banned list below

## 2. Score & rank (do not skip — this is a judgment table, not a checkbox count)

Score each project low→high on:
- **Gradient restraint**: 0 gradient files = best. Gradients in `archive/`, dead code, or unused variants don't count against a project — only live/imported CSS.
- **Palette discipline**: near-neutral bg/text with a single restrained accent beats multi-hue or saturated palettes.
- **Font pairing intent**: a considered sans+serif or sans+mono pairing beats browser-default-only, which beats a random web-font grab-bag.
- **Light/dark parity**: both modes defined via `prefers-color-scheme` and/or `data-theme` beats light-only.
- **Banned patterns** (instant demerit, from standing user preference): border-stripe accents, purple, gradients as a primary background/hero treatment, emoji in UI copy, monospace fonts used for UI chrome/labels (mono is fine only for literal char-grid content).

Output a markdown table: project | score rationale (1 line) | verdict (reference / fine / needs fix).

## 3. Pick the reference set

Default to the 2-3 top scorers as the palette/type source of truth. Don't
hardcode which projects those are — let the scoring decide; today's baseline
(2026-07) is portfolio (nulljosh.github.io) > lexly > echo, but re-score each run.

## 4. Apply — scoped, no cross-repo centralization

For each project flagged "needs fix":
- Edit **that project's own** token/landing CSS file to match the reference
  palette conventions and remove banned patterns (e.g. replace a gradient hero
  background with a flat/tonal one using the project's existing `--bg`/accent
  tokens).
- Never introduce a shared/imported stylesheet across repos — these are
  separate deployables. Fix drift in place, per project.
- If the project has iOS/macOS/watchOS counterparts, mirror the same
  palette/type decisions there too — don't fix only the web layer.
- Skip anything in `archive/`, `dist/`, `build/`, `node_modules`, or vendored
  checkout dirs.

## Guardrails (standing preferences — apply without re-asking)

- No border-stripe accents, purple, gradients, or emoji in UI — this has been
  corrected before; the user finds it reads as generic "AI UI".
- No monospace fonts for UI chrome/labels — mono is reserved for literal
  character-grid content.
- Mirror any UI change across web/iOS/macOS/watchOS variants of the same app,
  don't wait to be asked per-platform.
- Don't open Chrome to visually verify unless asked — read the CSS diff instead.
- Don't auto-commit/push across multiple repos without confirming — this
  touches several independent git repos in one run, more blast radius than a
  single-repo change.

## Output

End with: the ranking table, and a short list of files changed per project
(no essay). Keep it scannable — this runs periodically, not as a one-off report.
