---
name: homeroom
description: Drive the running Homeroom app (LEC Pre-Calc course on D2L/StudyForge) from Codex. Open a quiz, read what's on screen, press Start/Next, pick answers, ask the local tutor to solve or check. Use when the user says /homeroom, "open U2 exam", "what's on my quiz", or wants to control Homeroom.
---
Prefer the `homeroom` MCP tools (state, open, act, choose, fill, solve, check, back, reload). Without them, use the same commands directly:

- `open -g "homeroom://open?quiz=U2%20Exam"` (also `link=Grades`, `url=https://...`)
- `open -g "homeroom://act?label=Start"`, `choose?q=1&c=2`, `fill?q=3&v=42`, `solve`, `check`, `back`, `reload`
- Read the screen: `~/Library/Mobile Documents/com~apple~CloudDocs/Documents/School/math/Raw/captures/page.json` (url, page questions/actions/text, quizStatus, outline).

Rules: never press Start New Attempt, Submit or Finish unless Joshua says so in this conversation. Starting uses an attempt and starts the clock; submitting is final. Questions and choices are 1-based. Launch with `-dump` to save the live DOM as dom.html when a page reads blank.
