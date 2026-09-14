---
name: fleet-beautify
description: Fleet-wide code-beauty sweep across ~/Documents/Code — junk files, dead code, debug leftovers, style noise. Use when the user asks to clean up/beautify "the whole codebase", "all my apps", or invokes /fleet-beautify.
---

# fleet-beautify

Steve Jobs ethos: the code should be beautiful even where no one but you looks at it. This is a survey-first sweep across every repo in `~/Documents/Code`, not a per-project deep read — a mature shipped fleet is usually already clean, so don't force reads where the survey finds nothing.

## Excludes (always)
```
node_modules|\.build|/dist/|/build/|/\.next/|Pods|DerivedData|\.git/|\.gradle|\.venv|xcuserdata|\.swiftpm|chrome-data|ds-bundle|\.pw-profile|pentest/juice-shop
```
Vendored code, build output, and pentest targets (e.g. hackrange's Juice Shop clone) are not yours to touch.

## 1. Junk files
```
find . \( -name ".DS_Store" -o -name "*.bak" -o -name "*.orig" -o -name "*~" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.build/*"
find . -type f -size 0 -not -path "*/node_modules/*" -not -path "*/.git/*"
```
For each hit, `git check-ignore -v <file>`. Gitignored/untracked → delete directly, no confirmation. Tracked and zero-byte → check `git log -1 -- <file>` before touching; empty `__init__.py`/`.gitkeep` markers are intentional, leave them.

## 2. Debug/dead-code survey
Grep fleet-wide (respecting excludes above):
- `console\.log\(` / `\bdebugger;` / `\balert\(` — JS/TS
- `^\s*print\(` — Swift (not Python, `print` is normal there)
- `TODO|FIXME` — flag, don't auto-fix (may reflect a real open item)
- `^\s*//\s*(const|let|var|function|if|for|return|import)\b` — commented-out code
- Trailing whitespace: `grep -rlE ' +$'`
- 3+ consecutive blank lines: `grep -rlPz '\n\n\n\n'`

Zero hits across the whole fleet = report clean, stop. Non-zero = read only the matching files, fix the obvious ones (delete debug prints/dead code/trailing whitespace), leave TODOs as a flagged list for the user.

## 3. What this does NOT do
No per-file read pass through every repo when the survey is clean. No refactors, no re-architecture, no touching living docs (roadmap.md, GTM.md). No touching vendored/pentest dirs. This is noise removal, not a rewrite — see the `lint` skill's rules for the same discipline scoped to one project.

## Report
One line: junk files deleted (count + list), debug/dead-code hits fixed (file: what), TODOs flagged (file: text) if any, or "fleet already clean, N repos surveyed, 0 hits."
