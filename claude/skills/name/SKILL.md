---
name: name
description: Find an A+ name for a project, using Joshua's own repo names as the style guide. Grades the current name, loops candidates through a rubric until one scores A+, checks collisions, then hands off to /rename only on a clear keep. Use for /name, "find a better name", "A+ name", "rename ideas", or a name that is a fused compound.
---

# /name <project>

## 1. Read the house style first
`ls ~/Documents/Josh/Code` and the first README line of each repo. The names that stuck:
- A real place with a story: blackcomb (mountain above Whistler), gastown, elah (valley of David and Goliath), joshuatree.
- A real person or pop-culture name: turing, costanza, duke.
- One concrete word with a double meaning: tripwire, kernel, bugle, mailbag, cartons, tocks, scrounger, sighting.
The ones that got renamed away were descriptive fused compounds (Healstack, Curbfind, Litigate, Clear Clock).
That is the pattern a new name must follow. Skip Greek and Roman gods ([[feedback-no-greek-gods]]).

## 2. Grade the current name, then loop
Score each candidate 0 to 10 on six axes. A+ means every axis is 9 or more.
1. **Story**: it says what the project does, with a second meaning the README can tell in one "Named after" line.
2. **House fit**: one real word, lowercase, matches step 1. Never a fused compound, coinage or startup root (-ly, -io, Spark-).
3. **Sound**: two syllables at most, said right and spelled right on first hearing.
4. **Clean in its field**: no known tool, product or 100+ star repo with that name in the same domain
   (`gh search repos "<name> <field>"`). Big brands in other fields are fine.
5. **Personal**: ties to Joshua, BC or Vancouver, or the project's own history.
6. **Not cringe**: fine on a resume. No pwn, 1337, cyber, -hub.

Each round: 15+ candidates across different roots (places, people, films, trade words for the craft), score them,
keep the top 3, and brainstorm the next round off what made them score. Stop when one is A+, or after 4 rounds
with the best and its weak axis named. Rounds run in one turn; no wakeups needed.

## 3. Check it is free
- `gh repo view nulljosh/<name>` must 404.
- App Store apps: probe with `asc-name-creator`. Web projects live at `<name>.jaybulb.com`, so no domain buy.

## 4. Report and stop
One line: the pick, its grade, the one-line story, the runner-up. Rename nothing until Joshua says lock it,
then run `/rename <old> <new>`.

Check `~/.claude/usage.json` before starting; skip the gh searches past 90% on the 7-day meter.
