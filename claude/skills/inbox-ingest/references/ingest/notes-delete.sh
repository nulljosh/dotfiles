#!/bin/bash
# Deletes Apple Notes by id (args, or stdin lines of raw ids / notes-list.sh output),
# then prints the active note count across every account and folder (Recently Deleted excluded).
# ponytail: absolute /usr/bin/osascript; a bare `osascript` is not on PATH in every shell.
set -uo pipefail
OSA=/usr/bin/osascript
ids=("$@")
if [[ ${#ids[@]} -eq 0 ]]; then
  while IFS= read -r line; do id="${line##*$'\t'}"; [[ -n "$id" ]] && ids+=("$id"); done
fi
ok=0; fail=0
for id in "${ids[@]}"; do
  if "$OSA" -e "tell application \"Notes\" to delete note id \"$id\"" >/dev/null 2>&1; then ok=$((ok+1))
  else echo "FAILED to delete: $id" >&2; fail=$((fail+1)); fi
done
left=$("$OSA" -e 'tell application "Notes"
set c to 0
repeat with f in folders
if name of f is not "Recently Deleted" then set c to c + (count of notes of f)
end repeat
return c
end tell' 2>/dev/null)
# ponytail: key name kept as remaining_in_Notes; /work greps for it. It now counts every active folder.
echo "deleted=$ok failed=$fail remaining_in_Notes=$left"
[[ $fail -eq 0 ]]
