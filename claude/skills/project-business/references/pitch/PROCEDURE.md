---
name: pitch
description: The full pitch. Runs every voice (Josh, Jobs, Jordan, Jay-Z, Lil B, Future, MC Ride, valley girl) around one table, each taking a different true angle, then synthesizes them into one closing pitch, then updates the repo's MONEY.md. Use on /pitch, "pitch it all", "run all the pitches", or "synthesized pitch".
---

# Pitch

Every voice at one table, then one pitch that takes the best of each, then MONEY.md gets the update. The rules in the `hype-pitch` skill (gather first, every line true, no AI rhetoric, no emojis, no em dashes, original lines only) apply to every line here. Read it if it isn't loaded.

## 1. Gather

Same as hype-pitch step 1, done once for all voices: this conversation, `git log --oneline -5`, `gh pr list`, `gh run list --limit 3`, the live URL's version. Write down 5-8 true facts, including the one thing pending or broken. Every voice below draws only from this list.

## 2. The table

One line each, in this order, each on a **different** fact or angle so it isn't eight repeats. Prefix each with the voice name in bold.

| Voice | Angle |
|---|---|
| Josh | the bug and why it happened, dry aside |
| Jobs | the problem from the user's side, then the reveal |
| Jordan | the next move, hard close, pressure from real facts only |
| Jay-Z | ownership and where the money comes from |
| Lil B | who to thank, credit for whoever found it (often Joshua) |
| Future | the flex: what shipped, said like it's nothing |
| MC Ride | the honest broken or pending thing, ALL CAPS |
| Valley girl | the whole thing for someone who has never touched code |

## 3. The synthesis

Heading `**The pitch**`, then 3-5 lines in Joshua's own voice. Steal the best line from the table and cut the rest: lead with the measured bug or what Joshua spotted, one plain-words line on what it does, the honest line, one money line straight from MONEY.md, the next move. It must read as one person talking, not a collage.

## 4. MONEY.md, every time

Repo root `MONEY.md` of the project being pitched (fleet ledger is `~/Documents/Code/GTM.md`, read-only here). If the repo has none, say so and skip; don't create one unasked.

- **Where we are**: add one line `- YYYY-MM-DD: <what's real today, plain words>`. Same date already there? Rewrite that line instead of adding a second. Keep only the newest 5 lines.
- **Next**: rewrite only if the first dollar's next step actually changed.
- Update the `*Set YYYY-MM-DD.*` footer.
- Never touch price, revenue, or the million/billion/trillion numbers. Those are plans. Revenue changes only when money actually arrives, from a real source.
- Commit per the repo's own rules (Joshua Tree: branch + PR + squash auto-merge, and hold it if a big PR is waiting to merge). Message: `MONEY.md: pitch update <date>`.

## 5. Output

Table, synthesis, then one line: `MONEY.md: <what changed> (<commit or PR>)`. Nothing else.
