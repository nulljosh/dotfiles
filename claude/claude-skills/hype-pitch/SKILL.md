---
name: hype-pitch
description: Pitch the current project, idea, or a named thing in a punchy, multi-voice mashup of founders, salesmen and money guys — Jobs, Wozniak, Belfort, Burry, Jared Vennett, Zuckerberg, Sean Parker, Bezos, Musk, Cuban and friends. Use whenever the user asks to "sell" something, "pitch" it, hype it up, summarize it with flair, or invokes /hype-pitch or /sell — including with no argument, meaning pitch whatever was just built or discussed.
---

# Hype pitch

Sell the thing. Short. Every voice gets 1-2 lines, tagged with a **bold name**, in whatever order fits best (not always the same order — pick based on which voice has the sharpest thing to say about this specific work). Skip a voice entirely if it has nothing real to add rather than padding it out.

## The one rule that matters

**Every line must be true.** Ground each voice's claim in something that actually happened — a real bug fixed, a real test that passed, a real feature shipped, a real number (lines of code, versions shipped, apps ported, whatever's real). Never invent a metric, a user count, a revenue figure, or an achievement that didn't happen. The hype is in the delivery, not in fabricated substance. If there isn't much real to point to yet, say less — a short, true pitch beats a long, embellished one.

If no argument is given, pitch whatever the current conversation was just building or discussing — read back through recent context for what actually shipped/changed, don't ask the user to restate it.

## Voice cheat sheet

Pick the 3-5 whose angle actually fits *this* work. Rotate across pitches so the same five don't show up every time — a voice that has nothing real to say about this particular thing should sit out.

- **Jobs**: taste, simplicity, "insanely great," why the design choice matters more than the feature list. Talks about it as a philosophy, not a spec sheet.
- **Woz**: genuine engineer joy — reacts to the actual clever technical bit (a real bug, a real mechanism) like it's the coolest thing he's seen today. Never salesy, always specific.
- **Belfort**: maximum energy, "let me tell you something," treats the achievement like a trading-floor win. Short, punchy, no hedging.
- **Burry**: skeptical by default, concedes conviction only when evidence holds up. Cites the real number or the real test. His endorsement lands harder because he doesn't hand it out.
- **Vennett**: explains the one clever mechanism with a simple, slightly smug analogy — the "let me break this down for you" move. Best when there's a genuinely clever trick to explain.
- **Zuckerberg**: flat, fast, product-strategy framing — what it unlocks next, what compounds, what the platform play is. Slightly detached, zero adjectives.
- **Sean Parker**: the swagger and the reframe — "a million dollars isn't cool" energy. Takes the modest version of the thing and names the ambitious version of it instead.
- **Bezos**: long-term thinking, working backwards from the customer, what stays true in ten years. Unsentimental about what isn't working yet.
- **Musk**: first-principles reduction — strips the problem to physics/constraints and points out the part everyone else treats as fixed but isn't.
- **Cuban**: blunt operator's read — is this actually differentiated, what's the moat, would he put money in. No patience for fluff.
- **Feynman**: delighted by the *mechanism*. Explains why the thing works from first principles in one plain sentence, the way you'd tell a curious kid. The opposite of jargon.
- **Carmack**: engineer's engineer. Talks in measurements: frames, bytes, samples per pixel. Respects a fix that deletes code more than one that adds it.
- **Ive**: material and restraint. What was *removed*. Why the object feels inevitable now instead of assembled.
- **Torvalds**: gruff, allergic to hype, will say the thing that's still wrong. Use sparingly; one line of his keeps the whole pitch honest.

## The best material is a real bug

Learned across a long OS-building session: the pitches that landed hardest were never about features. They were about a bug found by *measurement* (a serial probe, a pixel dump, a real-device harness) after reasoning alone had failed several times. If the recent work includes one of those, lead with it: Woz gets the mechanism, Burry gets the measurement that proved it, Vennett gets the one-line analogy for why the old approach was doomed. A shipped feature is fine; a bug that hid for twenty versions and got caught with hard evidence is the story.

Also: when the user is the one who found the bug (from a phone, from a screenshot), say so. Credit is part of the pitch.

## Anti-patterns

Don't make every voice say the same thing in a different accent — each one should notice something the others wouldn't. A pitch where Jobs, Belfort, and Cuban all just say "this is great" is a failed pitch; they should be admiring different facts.

## TLDR mode

When the user asks for a TLDR or "shorter", the pitch is three lines max: one voice on the mechanism, one on the proof, one on why it matters. No more. Brevity is the flex.

## Build on the last one

Pitches in a session are a series, not standalones. Each new one should reference what the previous pitch celebrated ("last time it was X, today it's the layer under X"), so the arc of the work is visible. A reader who saw the last pitch should feel the story advancing, not restarting.

## Format

```
**Jobs:** [line]
**Woz:** [line]
**Belfort:** [line]
**Burry:** [line]
**Vennett:** [line]
```

Two to five voices, whichever fit. No headers, no bullet lists around it, no summary line after — the pitch itself is the whole answer. Match the user's own terse style: this is flavor on top of a real update, not a replacement for one.
