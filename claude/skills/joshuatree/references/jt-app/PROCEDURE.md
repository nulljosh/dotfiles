---
name: jt-app
description: Scaffold a new native Joshua Tree app (one kernel header, wired into the desktop, with its own headless check, docs row and version bump). Use for /jt-app <name>, "add an app to Joshua Tree", or any roadmap item that is a new app.
---

Repo: ~/Documents/Code/joshuatree. Headless only. Read docs/ARCHITECTURE.md's Apps section first.

## Shape

One header, `kernel/<name>.h`, included from `kernel/kernel.c`. Pick the template by behaviour:
- Reacts to keys and clicks only: copy `kernel/toroid.h`.
- Redraws on a timer with nobody touching it: copy `kernel/activity.h`, it has the only timer-driven event loop.
- List on the left, detail on the right: copy `kernel/bookrank.h`.
- Saves a file: copy `kernel/reminders.h`, one text file on the FAT disk, write-through on every change, no Save button.

Use `kernel/gui_prompt.h` for any text input. Reuse the draw primitives. No new abstractions. Never add lines to kernel.c beyond the include and the wiring; the god-file guard will fail the PR.

## Wiring in kernel.c (grep an existing app, e.g. `toroid`, to find each spot)

1. `#include "<name>.h"` next to the other app headers.
2. `gui_icon_<name>` drawn from geometry, then its `case N:` in the icon dispatch.
3. `gui_launch_<name>` call in the launch dispatch.
4. Labels and colours tables, and `GUI_APP_COUNT` (the comment says "N real apps + Apps folder + Trash", keep it true).
5. Apps folder only unless asked; the dock is curated.

## The count is pinned in four places

Grep for the old app count and fix each: `tools/gen/inject-landing-facts.py` (then run it), `tools/checks/tourappcount-check.mjs`, `tools/checks/dockslots-check.py`, `docs/WHITEPAPER.md`.

## Finish

- Row in docs/ARCHITECTURE.md's apps table, one plain sentence. Coverage must stay 100%.
- `tools/checks/<name>-check.py` copied from `tools/checks/activity-check.py`'s QMP and pmemsave shape: open the app from the Apps folder, assert pixels changed, do its main action, assert again. Add the line to `tools/checks/ci-suite.sh`.
- Tick the roadmap item. Bump VERSION MINOR and `landing/version.txt`.
- `make kernel.elf && ./check.sh && python3 tools/checks/<name>-check.py && bash tools/checks/check-refs.sh`.
- Then /jt-ship.
