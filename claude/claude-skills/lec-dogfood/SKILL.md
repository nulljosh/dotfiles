---
name: lec-dogfood
description: Build, install and launch the LEC school app against real D2L, confirm sign-in and that it landed on Ratcliffe's Pre-Calc 12, screenshot the window headlessly, and append a line to docs/DOGFOOD.md. Use when the user says /lec-dogfood or "try the LEC app".
---
1. `sh ~/.claude/skills/lec-dogfood/run.sh` builds, installs to /Applications, relaunches in the background (`open -g`, never steal focus), waits 25s, prints the detected course and saves a window screenshot to /tmp/lecshot/dogfood.png.
2. Read the screenshot. Expected: course 184298 (RATCLIFFE). 198889 is Dhiman's old section and means detection regressed.
3. Append one dated plain-English line to `~/Documents/Code/lec/docs/DOGFOOD.md` under Log.
Never answer or submit a graded quiz. The app coaches and records; the student submits.
