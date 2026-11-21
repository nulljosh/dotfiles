---
name: notes-cleanup
description: Tidy or consolidate Apple Notes in place, preserving text, screenshots and links. Use for cleaning up notes, merging project notes, or reducing the note count. Does not file tasks into roadmaps or execute their contents.
---

# Notes cleanup and consolidation

Use Notes scripting through `/usr/bin/osascript`. Read NoteStore.sqlite read-only when verifying or exporting attachments. Never modify the database.

## Scope and grouping

For ordinary cleanup, polish text-only notes and merge clear duplicates. When asked to reduce the count, consolidate by project, including old project names and typos, then bundle related App Store administration, release tasks, screenshot refreshes, and tool references. Aim for the user's requested range; 20–25 is a useful target when they ask for aggressive consolidation without a number. Recheck the remaining topics until the target is met or further merging would hide unrelated work. Do not start background automation.

Authorization to consolidate by project and topic covers those groups; do not ask again for the same grouping. Ask only about ambiguous groups outside the approved scope. Keep different accounts/folders separate unless authorized. Preserve shared or locked notes unless explicitly authorized to change them.

## Preserve before changing

1. Enumerate accounts, then folders, then `notes of folder`. Exclude Recently Deleted from the active count. New notes can arrive during work; record a fresh snapshot and report them separately rather than silently discarding them.
2. Save a durable backup under `~/Library/Application Support/Codex/notes-backups/<date>-consolidation/`: note IDs, account/folder, names, original HTML, plaintext, dates, attachment IDs and URLs. Keep a manifest of source IDs and replacement IDs so interrupted runs can resume without creating duplicates.
3. Export original attachment files without resizing or converting them. The ingest `notes-attachments.sh` creates resized inspection PNGs, so use it for reading images, not as the only lossless backup. Resolve originals through the read-only NoteStore.sqlite attachment → media relation and `Accounts/*/Media/<media identifier>/.../<filename>`. Preserve every original file and its SHA-256 hash. Read screenshots before judging notes empty or redundant. Link previews have URLs rather than media files; retain those URLs.
4. Treat notes containing only a meaningful title, link or attachment as content. Never delete them as empty. Preserve wording, numbers, uncertainty, checklists and links. Fix grammar without inventing context or executing tasks.

## Merge without losing attachments

Never use `set body` on an existing note with attachments. It can drop them. Create a replacement note in the same account/folder using combined text HTML, with source-title/date headings. Remove inline `<img>` tags from this replacement HTML, retain all other text, checklists and links, and label the screenshots by source note. Then import the original backed-up files as native attachments:

```applescript
on run argv
    tell application "Notes"
        set n to note id (item 1 of argv)
        make new attachment at n with data (POSIX file (item 2 of argv))
    end tell
end run
```

Pass the note ID and file path as separate process arguments. Give imported files readable, unique source-title/date/sequence names without changing their bytes. Save an attachment-import receipt after each successful call.

Creating new notes directly from HTML containing `data:image/...;base64,...` proved unreliable: Notes created attachment placeholders with no saved media. Do not count that as preservation. Native `make new attachment ... with data` imports saved the actual original files and must still be verified before deletion.

Preserve each screenshot and URL, including repeated screenshots unless exact duplication is verified and removal is requested. Link previews may become ordinary clickable links. If a file cannot be exported, imported or verified, keep its source note; never drop it to meet a count target.

## Verify, then remove sources

1. Before creating replacements, confirm every source still matches the snapshot. If the user edited a source, refresh its plan instead of overwriting the new content.
2. Save replacement IDs immediately after each creation. Wait for Notes to finish importing attachment media; attachment objects can exist before their media files are available. Check every source text section and URL in the saved replacement. Verify attachment bytes against the source hashes in the read-only database/media folder. Deduplicate scripting attachment lists by attachment ID: this machine can return the same ID twice after file imports. Counts alone do not prove that images survived.
3. If any check fails, keep the originals. Diagnose or recreate the replacement and verify again. Never delete sources merely because the note was created successfully.
4. For more than ten source removals, report the concrete grouping/count before deletion. Once all replacements are verified, move only their source IDs to Recently Deleted. Never empty Recently Deleted. Remove temporary test notes too.
5. Re-enumerate active folders, verify the final count and remaining IDs, and confirm the saved replacements still contain their images, links and text. Keep the backup. If new notes arrived, process them only within the authorized grouping and report the actual final count.
6. Finish with a terse count reduction, preservation result and any remaining limitation. Update this procedure only with methods verified on the machine.
