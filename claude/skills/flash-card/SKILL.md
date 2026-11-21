---
name: flash-card
description: Flash the Joshua Tree Pi microSD card. Use for /flash, "card in the Mac", "flash it", or whenever /Volumes/NO NAME is mounted and Joshua is board testing.
---

# Flash the Pi card

1. `ls /Volumes | grep -i "no name"`. Not mounted: say so in one line and stop. Never loop or poll for it.
2. Pick the build. Default is current `main` (`cd ~/Documents/Code/joshuatree && git checkout main && git pull --ff-only`). If Joshua names a PR or branch that is not merged yet, flash it from a throwaway worktree of that branch (rebased on main if it stacks). Never push, merge or switch a branch that has CI running. `test/all` is stale, do not use it.
3. Run `tools/flash-pi.sh "/Volumes/NO NAME"` from that worktree. Always this script: it sets `TLS_TA` to the relay CA, so Samantha's TLS works. Filter the output to `error:|ejected|flashed`.
4. Reply in one line: what is on the card (branch plus what it carries) and what to look at first. The script ejects the card.

Rules: one flash per "card in" message. Do not flash on a timer, a loop, or a hook; the card is only touched when Joshua says it is in or asks for it. Keys stay in `~/.config/joshuatree/`; never print them.
