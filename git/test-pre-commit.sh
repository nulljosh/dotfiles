#!/bin/bash
# Self-check for hooks/pre-commit in a throwaway repo. Run: bash dotfiles/git/test-pre-commit.sh
set -e
HOOK="$(cd "$(dirname "$0")" && pwd)/hooks/pre-commit"
T=$(mktemp -d); cd "$T"; git init -q; git config core.hooksPath /dev/null
big() { head -c 24000 /dev/zero | tr '\0' a > "$1"; }
ok() { bash "$HOOK" 2>/dev/null && echo "pass: $1" || { echo "FAIL: $1"; exit 1; }; }
no() { bash "$HOOK" 2>/dev/null && { echo "FAIL: $1"; exit 1; } || echo "pass: $1"; }
echo small > a.txt; git add a.txt; ok "small new file"
git commit -qm init
big b.txt; git add b.txt; no "new big file blocked"
SKIP_TOKEN_CHECK=1 bash "$HOOK" && echo "pass: skip flag"
big c.json; git rm -q --cached b.txt; git add c.json; ok "json ignored"
git commit -qm json; big a.txt; git add a.txt; no "file crossing the limit blocked"
SKIP_TOKEN_CHECK=1 git commit -qm cross; echo more >> a.txt; git add a.txt; ok "already-big file passes"
rm -rf "$T"
