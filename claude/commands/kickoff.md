---
description: Interview the user about a new project ("$ARGUMENTS"), pin down the core decision it's meant to drive, then break it into small agile buckets built one at a time with a review checkpoint after each.
---

The user is building: **$ARGUMENTS**

1. **Interview first.** Before any coding or writing, ask focused questions (use AskUserQuestion where there's a concrete choice) to identify:
   - The actual goal of "$ARGUMENTS"
   - The core decision this project is meant to drive (what choice/outcome does finishing this enable?)
   Do not proceed until both are explicit and confirmed back to the user in one or two sentences.

2. **Break into buckets.** Once the goal and core decision are confirmed, decompose the project into small, agile buckets (independently shippable chunks of work). List them in build order with a one-line rationale each. Confirm the bucket list with the user before starting bucket 1.

3. **Build one bucket at a time.**
   - For each bucket: present a short plan for just that bucket, then implement it.
   - After implementing, stop at a checkpoint — summarize what was built/output and explicitly ask the user to review before moving to the next bucket.
   - Do not start the next bucket until the current one is reviewed.

4. **Guard against drift.** Before/during each bucket, briefly check the bucket's output against the original goal and core decision from step 1. If something drifts, flag it explicitly and confirm with the user whether to adjust course or continue.
