#!/bin/bash
# Deletes Apple Notes by id (one id per line on stdin, or as args), then prints
# how many notes are left in the folder so the caller can verify the sweep.
# ponytail: absolute /usr/bin/osascript — a bare `osascript` is not on PATH in
# every shell this gets called from, and the failure is silent-ish.
set -uo pipefail

FOLDER="${FOLDER:-Notes}"
OSA=/usr/bin/osascript

ids=("$@")
if [[ ${#ids[@]} -eq 0 ]]; then
  while IFS= read -r line; do
    # accepts raw ids or notes-list.sh's "<path>\t<noteId>" lines
    id="${line##*$'\t'}"
    [[ -n "$id" ]] && ids+=("$id")
  done
fi

ok=0; fail=0
for id in "${ids[@]}"; do
  if "$OSA" -e "tell application \"Notes\" to delete note id \"$id\"" >/dev/null 2>&1; then
    ok=$((ok+1))
  else
    echo "FAILED to delete: $id" >&2; fail=$((fail+1))
  fi
done

left=$("$OSA" -e "tell application \"Notes\" to get count of notes of folder \"$FOLDER\"" 2>/dev/null)
echo "deleted=$ok failed=$fail remaining_in_$FOLDER=$left"
[[ $fail -eq 0 ]]
