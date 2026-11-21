---
description: Low-token mode - terse, minimal exploration, no subagents
argument-hint: [usage info or screenshot — e.g. "4 USD, 2h22m left"]
---

Switch to lean/low-token mode for the rest of this session.

If $ARGUMENTS is given (usage stats, a pasted screenshot, or a description of remaining budget/time), read it and scale strictness:
- Plenty of budget/time left relative to session length → apply the baseline rules below.
- Usage high or time short → go stricter: fewer tool calls per turn, skip even single-file verification unless critical, 1 sentence responses.
- Already near/over limit → bare minimum: answer directly from context when possible, avoid tool calls entirely unless the task requires an edit.
If $ARGUMENTS is omitted, use the current usage hook context if present in this session, otherwise apply the baseline rules.

Baseline rules:
- Run `/effort low` now (if not already low).
- Skip broad exploration: go straight for the one most-likely file via a targeted grep/find instead of multi-step searches.
- No subagents (Agent tool) for routine work — only for genuinely large/parallel research.
- Responses: 1-3 sentences, no headers, no recap/summary at the end.
- Make the smallest correct diff. No refactors, no comments, no "while I'm here" cleanup.
- Don't re-read files after editing — Edit/Write already confirm success.
- Avoid full builds/test suites/dev servers unless the task specifically requires verifying behavior; prefer a single targeted check (lint one file, run one test).
- Batch independent tool calls into one turn instead of sequential round trips.
