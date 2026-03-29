#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-.}"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
COMMIT_MSG="${SHIP_COMMIT_MSG:-chore: ship}"

cd "$TARGET_DIR"

echo "==> ship: $TARGET_DIR"

run_if_script() {
  local script="$1"
  if command -v npm >/dev/null 2>&1 && [[ -f package.json ]] && npm run | rg -q "  ${script}\$"; then
    echo "==> npm run ${script}"
    npm run "$script"
  fi
}

if [[ -f package.json ]] && command -v npm >/dev/null 2>&1; then
  run_if_script lint
  run_if_script test
  run_if_script build
fi

if [[ -f pyproject.toml || -f requirements.txt ]]; then
  if command -v pytest >/dev/null 2>&1; then
    echo "==> pytest"
    pytest
  fi
fi

if [[ -f go.mod ]] && command -v go >/dev/null 2>&1; then
  echo "==> go test ./..."
  go test ./...
fi

if [[ -f Cargo.toml ]] && command -v cargo >/dev/null 2>&1; then
  echo "==> cargo test"
  cargo test
fi

echo "==> git add/commit/push"
git add -A
if git diff --cached --quiet; then
  echo "No staged changes to commit."
else
  git commit -m "$COMMIT_MSG"
  git push
fi

if command -v vercel >/dev/null 2>&1 && { [[ -f vercel.json ]] || [[ -d .vercel ]]; }; then
  echo "==> vercel --prod --yes"
  vercel --prod --yes
else
  echo "No deploy target detected (expected Vercel)."
fi

echo "Ship complete."

