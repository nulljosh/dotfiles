---
name: complexity-audit
description: Scan ~/Documents/Code to find the most complicated project (real source line counts, per-component breakdown, duplicated-file detection across platform targets) and propose how to simplify it. Use when the user asks which project is most complex, wants to simplify/break up a bloated app, or invokes /complexity-audit.
---

# Complexity audit

Find the most over-grown project across the whole codebase, then find the specific fork/duplication driving its size.

## 1. Rank projects by real source (exclude vendor/build noise)

```bash
cd ~/Documents/Code && for d in */; do
  n=$(find "$d" \( -path "*/node_modules/*" -o -path "*/build/*" -o -path "*/.git/*" \
       -o -path "*/.wrangler/*" -o -path "*/DerivedData/*" -o -path "*/Pods/*" \
       -o -path "*/dist/*" -o -path "*/.next/*" -o -path "*/.venv/*" -o -path "*/venv/*" \) -prune \
       -o \( -name '*.swift' -o -name '*.ts' -o -name '*.tsx' -o -name '*.kt' -o -name '*.js' -o -name '*.py' \) -print 2>/dev/null \
       | xargs wc -l 2>/dev/null | tail -1)
  echo "$n $d"
done | sort -rn | head -20
```

A huge number from one project is often vendored deps (a stray `.venv`, checked-in `SourcePackages`), not real code — spot-check the top few with `find <dir> -name '*.py' | xargs wc -l | sort -rn | head` before trusting the ranking.

## 2. Break the winner into components

```bash
cd ~/Documents/Code/<winner> && for d in */; do
  [ -d "$d" ] || continue
  n=$(find "$d" \( -path "*/node_modules/*" -o -path "*/dist/*" -o -path "*/build/*" \) -prune \
       -o \( -name '*.swift' -o -name '*.ts' -o -name '*.tsx' -o -name '*.kt' -o -name '*.js' \) -print \
       | xargs wc -l 2>/dev/null | tail -1)
  echo "$n $d"
done | sort -rn
```

## 3. Check for platform-fork duplication

If there are two native targets (ios/ + macos/, or similar), check how many files share a name — same-named files across targets usually means duplicated logic that should live in one shared module (a Swift Package, or the project's `kmp/` dir) instead of two copies.

```bash
comm -12 <(find ios -name '*.swift' -exec basename {} \; | sort -u) \
         <(find macos -name '*.swift' -exec basename {} \; | sort -u) | wc -l
```

## 4. Report

- Total real-source lines and per-component split.
- Duplicate-filename count between platform targets, if any.
- Near-zero components (cli/, tradingview/, etc.) — flag as YAGNI candidates, don't assume dead without checking a `git log -1` on the dir.
- 2-4 concrete simplification moves, ranked by impact (kill the biggest duplication first).

Don't apply fixes — this is a report only, like ponytail-audit and repo-cleanup.
