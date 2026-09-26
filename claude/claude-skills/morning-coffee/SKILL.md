---
name: morning-coffee
description: Plan Joshua's day over coffee. Pulls today's calendar, what's blocked on him, and open roadmap work, then hands back a short ranked plan for the day. Use when the user says /morning-coffee, "morning coffee", "plan my day", "what's on today", or "what should I do today".
---

# Morning coffee

Read-only. Gather, rank, reply. Never start work or change files unless Joshua picks something.

## 1. Gather (one batched Bash call)

```bash
# Today's calendar (iCloud Calendar.app)
osascript -e '
tell application "Calendar"
	set d1 to current date
	set time of d1 to 0
	set d2 to d1 + 1 * days
	set out to ""
	repeat with c in calendars
		repeat with e in (every event of c whose start date ≥ d1 and start date < d2)
			set sd to start date of e
			set out to out & (summary of e) & " | " & (time string of sd) & "\n"
		end repeat
	end repeat
	return out
end tell'
echo "--- BLOCKED ON JOSHUA"
cat "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Code/wiki/pages/blocked-on-joshua.md"
echo "--- RECENT REPOS (last 3 days)"
for d in ~/Documents/Code/*/; do
  git -C "$d" log -1 --since=3.days --format="$(basename $d): %s (%cr)" 2>/dev/null
done
```

Then skim `roadmap.md` in the 2-3 most recently touched repos for the top open items. Pull ship status from memory (the ASC status ledger, WAITING_FOR_REVIEW apps) rather than hitting `asc`.

## 2. Rank

1. Fixed-time calendar events (these anchor the day).
2. Things only Joshua can do (blocked-on-joshua list: buys, logins, 2FA, approvals). These unblock everything else, so they go first.
3. The one or two roadmap items with the most momentum (repos touched in the last day or two).
4. Anything waiting on Apple review: just a status line, nothing to do.

Cap the plan at 5 items. A day with 12 priorities has none.

## 3. Reply

Jordan Belfort energy, short. Format:

```
Wed Sep 23

10:00  Dentist
       Buy joshuatreeos.com (5 min, unblocks DNS)
       Turing: browser tabs box
       Vancouver Vice: MetaHuman pass
Waiting on Apple: Nimble iOS, Siftbox, Curvely 1.2.4
```

No em dashes. Max 4 lines, no notes or caveats after the block. Then just "Which one?" If Joshua names one, hand off to `/work <project>`.
