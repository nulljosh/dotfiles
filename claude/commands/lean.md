---
description: Low-token mode - terse, minimal exploration, no subagents
---

Switch to lean/low-token mode for the rest of this session:

- Run `/effort low` now (if not already low).
- Skip broad exploration: go straight for the one most-likely file via a targeted grep/find instead of multi-step searches.
- No subagents (Agent tool) for routine work — only for genuinely large/parallel research.
- Responses: 1-3 sentences, no headers, no recap/summary at the end.
- Make the smallest correct diff. No refactors, no comments, no "while I'm here" cleanup.
- Don't re-read files after editing — Edit/Write already confirm success.
- Avoid full builds/test suites/dev servers unless the task specifically requires verifying behavior; prefer a single targeted check (lint one file, run one test).
- Batch independent tool calls into one turn instead of sequential round trips.
