#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-.}"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
PROJECT_NAME="$(basename "$TARGET_DIR")"

cd "$TARGET_DIR"

echo "# Audit: ${PROJECT_NAME}"
echo
echo "## Repo Snapshot"
echo "- Path: ${TARGET_DIR}"
echo "- Git branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo n/a)"
echo "- Tracked files: $(git ls-files 2>/dev/null | wc -l | tr -d ' ')"
echo

echo "## Potential Issues"

echo "### Secrets Scan"
if rg -n --hidden -S "(api[_-]?key|secret|token|password|PRIVATE KEY)" . -g '!node_modules' -g '!.git' >/tmp/audit-secrets.txt 2>/dev/null; then
  sed -n '1,30p' /tmp/audit-secrets.txt
else
  echo "- No obvious secret patterns found."
fi
echo

echo "### Large Files (>1MB)"
if find . -type f -size +1M -not -path "*/.git/*" | sed -n '1,20p' | rg -q "."; then
  find . -type f -size +1M -not -path "*/.git/*" | sed -n '1,20p'
else
  echo "- No large files detected."
fi
echo

echo "### Basic Hygiene"
[[ -f .gitignore ]] && echo "- .gitignore present" || echo "- Missing .gitignore"
[[ -f README.md ]] && echo "- README.md present" || echo "- Missing README.md"
[[ -d tests || -d test ]] && echo "- test directory present" || echo "- No test directory detected"
echo

echo "## Suggested Next Steps"
echo "- Fix any exposed secrets immediately (rotate credentials)."
echo "- Add/expand automated tests around core flows."
echo "- Remove or externalize oversized artifacts."

