---
name: calendar-ingest
description: Add or check events in the user's iCloud Calendar (Calendar.app, not Google Calendar) via AppleScript. Use when the user pastes a text message, screenshot, or note containing an appointment/event and wants it added to their calendar, or asks what's on the calendar for a date range.
---

# Calendar ingest

The user's calendar lives in macOS Calendar.app, synced via iCloud — not Google Calendar. Drive it with `osascript`, no MCP/OAuth needed.

Default calendar for new events: **Misc**. Ask only if the event is clearly work/health/bills-specific and the user hasn't said which calendar.

## Check for existing/duplicate events first

Always check the date range before adding — sources like screenshots often describe something already on the calendar.

```bash
osascript -e '
tell application "Calendar"
	set d1 to date "September 15, 2026"
	set d2 to date "September 20, 2026"
	set out to ""
	repeat with c in calendars
		set evts to (every event of c whose start date ≥ d1 and start date ≤ d2)
		repeat with e in evts
			set out to out & (summary of e as string) & " | " & (start date of e as string) & " | " & (name of c as string) & "\n"
		end repeat
	end repeat
	return out
end tell'
```

## Add a one-off event

```bash
osascript -e '
tell application "Calendar"
	tell calendar "Misc"
		set startDate to date "September 17, 2026 9:30:00 AM"
		set endDate to date "September 17, 2026 10:30:00 AM"
		make new event with properties {summary:"CT Scan - Langley Memorial Hospital", start date:startDate, end date:endDate, location:"Langley Memorial Hospital"}
	end tell
end tell'
```

## Add a recurring event

Set `recurrence` as an RRULE string property on the event AFTER creation — `make new recurrence` does not exist as a class and will fail.

```bash
osascript -e '
tell application "Calendar"
	tell calendar "Misc"
		set startDate to date "September 17, 2026 1:30:00 PM"
		set endDate to date "September 17, 2026 2:30:00 PM"
		set newEvent to make new event with properties {summary:"Leeton", start date:startDate, end date:endDate}
		set recurrence of newEvent to "FREQ=WEEKLY;INTERVAL=1"
	end tell
end tell'
```

## Notes

- AppleScript date parsing is locale-dependent but `"September 17, 2026 9:30:00 AM"` format works reliably.
- If the source is a screenshot/note with a "come N minutes early" instruction, put that in the event's `description` (notes) field, not the title.
- No confirmation needed to add — this is a reversible, local, non-destructive action (delete via Calendar.app if wrong).
