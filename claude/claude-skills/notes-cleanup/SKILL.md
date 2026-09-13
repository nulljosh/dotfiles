---
name: notes-cleanup
description: Scan Apple Notes.app and tidy it up — merge notes that share a header/title into one, delete empty or junk notes, fix obvious formatting. Use when the user says "clean up my notes", "organize notes", or "/notes-cleanup". Does not file content into project roadmaps (see the ingest skill for that).
---

# notes-cleanup

Headless only — read/write Notes.app via `osascript`, never UI-script it (per `feedback_headless_automation`).

## Steps

1. Dump every note: name, folder, body, modification date.
   ```applescript
   tell application "Notes"
     repeat with n in notes
       -- name of n, body of n, container of n, modification date of n
     end repeat
   end tell
   ```
2. Group by header (first line / `name of n`), case-insensitive, trimmed.
3. For each group with >1 note: merge bodies into the oldest note (append newer content under a `---` divider), then delete the duplicates. Skip merging notes that live in different folders unless the user says otherwise.
4. Delete notes that are empty or whitespace-only.
5. Report what was merged/deleted before doing it if the list is long (>10 notes) — this is destructive.

## Deleting/merging in Notes.app

```applescript
tell application "Notes"
  delete note id "x-coredata://..."
end tell
```

No dedicated merge primitive — read both bodies, write the combined text to the note you keep, then delete the other.
