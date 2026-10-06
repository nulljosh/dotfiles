#!/bin/bash
# Exports every image/file attachment in Notes.app to OUT_DIR, named <note-title>-<n>.png.
# Prints "<note pk>\t<title>\t<path>" per file so the caller can Read each image and file its content.
# ponytail: AppleScript `save attachment` fails (Notes is sandboxed), so read NoteStore.sqlite
# read-only and copy from the Media folder directly. Link attachments (web previews) have no
# file; get those with: tell application "Notes" to get URL of attachment 1 of note "<title>"
set -euo pipefail
OUT="${1:?usage: notes-attachments.sh OUT_DIR}"; mkdir -p "$OUT"
G="$HOME/Library/Group Containers/group.com.apple.notes"
sqlite3 -readonly -separator $'\t' "$G/NoteStore.sqlite" "
  select n.Z_PK, n.ZTITLE1, m.ZIDENTIFIER, m.ZFILENAME
  from ZICCLOUDSYNCINGOBJECT a
  join ZICCLOUDSYNCINGOBJECT m on a.ZMEDIA = m.Z_PK
  join ZICCLOUDSYNCINGOBJECT n on a.ZNOTE = n.Z_PK
  where coalesce(n.ZMARKEDFORDELETION, 0) = 0;" |
while IFS=$'\t' read -r pk title media file; do
  src=$(find "$G/Accounts" -path "*/Media/$media/*" -type f -name "$file" -print -quit)
  [[ -z "$src" ]] && { echo "MISSING (not downloaded from iCloud?): $title / $file" >&2; continue; }
  slug=$(echo "$title" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')
  n=1; while [[ -e "$OUT/$slug-$n.png" ]]; do n=$((n+1)); done
  dst="$OUT/$slug-$n.png"
  sips -s format png -Z 1600 "$src" --out "$dst" >/dev/null
  printf '%s\t%s\t%s\n' "$pk" "$title" "$dst"
done
