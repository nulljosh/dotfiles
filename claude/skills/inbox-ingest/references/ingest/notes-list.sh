#!/bin/bash
# Lists every active note (all accounts, all folders except Recently Deleted, or only
# folder $1) as <OUTDIR>/<pk>.txt (line 1 = name, rest = plaintext) plus <pk>.html
# (body HTML: plaintext drops link hrefs). Prints "<txt path>\t<noteId>" per note.
# pk = the trailing p<N> of the note id = NoteStore Z_PK, same key notes-attachments.sh uses.
set -euo pipefail
FOLDER="${1:-}"
OUTDIR="${2:-$(mktemp -d /tmp/notes_ingest_XXXX)}"; mkdir -p "$OUTDIR"
OSA=/usr/bin/osascript

ids=$("$OSA" - "$FOLDER" <<'APPLESCRIPT'
on run argv
  set want to item 1 of argv
  set out to ""
  tell application "Notes"
    repeat with f in folders
      set fn to name of f
      if fn is not "Recently Deleted" and (want is "" or fn is want) then
        repeat with n in notes of f
          set out to out & (id of n) & linefeed
        end repeat
      end if
    end repeat
  end tell
  return out
end run
APPLESCRIPT
)

while IFS= read -r noteId; do
  [[ -z "$noteId" ]] && continue
  pk="${noteId##*/p}"
  # ponytail: one bad note (locked) must not kill the run
  name=$("$OSA" -e "tell application \"Notes\" to get name of note id \"$noteId\"" 2>/dev/null) || { echo "skip (unreadable): $noteId" >&2; continue; }
  body=$("$OSA" -e "tell application \"Notes\" to get plaintext of note id \"$noteId\"" 2>/dev/null) || { echo "skip (locked?): $name" >&2; continue; }
  "$OSA" -e "tell application \"Notes\" to get body of note id \"$noteId\"" > "$OUTDIR/$pk.html" 2>/dev/null || true
  { echo "$name"; echo "$body"; } > "$OUTDIR/$pk.txt"
  echo "$OUTDIR/$pk.txt	$noteId"
done <<< "$ids"
