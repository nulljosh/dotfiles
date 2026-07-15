---
name: wrap-up
description: Wind down the session when the user pastes a Claude usage screenshot (usage bar, "5-hour limit", token/cost meter) or says /wrap-up. Finish current work leanly and land everything durable.
---

# Wrap-up

Trigger: user pastes a screenshot of Claude usage/limits, or invokes /wrap-up. No confirmation needed — the screenshot IS the signal.

Immediately switch to lean mode: invoke the `lean` skill first, then:

1. **Finish, don't expand.** Complete only the in-flight step of the current task the shortest way possible. No new scope, no exploration, no subagents, no simulator/Chrome.
2. **Land it.** If edits pass build/tests, commit + push (per standing auto-push preference). If not passing, commit to a WIP branch or stash with a clear message.
3. **Stash the rest.** Write remaining steps into the project's roadmap.md (or TODO section of README if none), one line each, actionable.
4. **Memory.** Update auto-memory project state files so next session resumes cold.
5. **Report.** ≤5 lines: what shipped, what's parked, where to resume.

Do not start anything new after this fires. If mid-response when the screenshot lands, treat the current step as the last one.
