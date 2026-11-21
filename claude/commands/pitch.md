---
description: Hype pitch in a chosen voice. /pitch jobs|josh|papers [what to pitch]. Replaces /jobs, /josh, /papers
argument-hint: <jobs|josh|papers> [optional: what to pitch, defaults to whatever was just built/discussed]
---

The first word of $ARGUMENTS picks the voice (default josh); the rest is what to pitch. Use only that voice section below.

## jobs

Follow the hype-pitch procedure at `~/.claude/skills/project-business/references/hype-pitch/PROCEDURE.md` for $ARGUMENTS, with these overrides to its Voice section and length: deliver it as Steve Jobs on stage, and make it sound like him, not like a polite summary.

Voice. Calm, certain, unhurried. Short declarative lines with a pause after each one. Simple words a kid would know. Use his real devices, sparingly and only where true:
- Open on the problem, from the customer's side: "Most assistants live in someone else's cloud. Your things go up there. You rent them back."
- The setup and the turn: "Everyone else does X. We did Y."
- The reveal, said plainly: "Today we are introducing..." or "This is a..." followed by what it does, never how it works.
- One three-part list is allowed if all three parts are real (his "an iPod, a phone, an internet communicator" move).
- Quiet judgments: "It just works." "That is the whole point." "We think that is pretty great." A superlative only when a measured result sits right beside it.
- "One more thing" only when there truly is one more shipped thing, and then it goes last.
No swearing, no shouting, no slang, no emojis, no em dashes.

Money. After the product lines add a short "How it makes money" beat of two or three lines. It is strategy, so it must be honest about being a plan: say "the plan is" or "we could", never state revenue, prices, users, customers or dates that do not exist. Pull from what is real and checkable: the software is free and Apache 2.0 (check LICENSE), so the money is not in the code. Real precedents live in ~/Documents/Code/GTM.md (for example the apps priced at $0.99 upfront), read it before quoting anything. Good angles for whatever is being pitched, pick the ones that fit and say which are not built yet: sell a small ready-made box or appliance with it already installed (hardware is the direction for Joshua Tree too), charge teams to train a private model on their own documents, a paid pack of hosted or premium tools, and paid support. Say plainly which one is the first to try and why. If GTM.md and the repo hold no number for something, say "no number yet".

Up to 7 lines total including the money beat. Everything else in the skill (gather first, every line true, length, format, rules) applies unchanged.

## josh

Follow the hype-pitch procedure at `~/.claude/skills/project-business/references/hype-pitch/PROCEDURE.md` for $ARGUMENTS, using its default voice (Joshua's own), with no Jobs, Belfort or artist layered on. Everything else in the skill (gather first, every line true, length, format, rules) applies unchanged.

How Joshua actually writes (from his real messages, re-read them in the conversation first and match what you find):
- Short and direct. A fragment is a full thought. "tldr", "shorter", "keep going", "you decide", "handle it". He doesn't pad and he doesn't explain what he wants twice.
- Mostly plain lowercase, loose punctuation, the odd typo left alone. Don't polish it into clean prose. A capital I or a question mark is fine where it falls naturally.
- Practical first. Leads with what changed or what's next, in plain words, and moves on. Thinks in what the thing does for a person, not how it's built.
- Dry, quick humor. "lol", "xd", a one-line aside when something is actually funny, like a personal reminder showing up in the roadmap. Never forced.
- Trusts the work. Gives the call to the builder ("you decide", "feel free to do whatever you suggest") and expects it done, not asked about. So the pitch reports done things and one real blocker, not options.
- Names things the way he does: Neo, Joshua Tree, the Pi, the hardware. Uses "etc" to wave off a list.
- Cares why it works. One short line on the mechanism when it's the interesting part, plain words, no jargon.
- Credits his own catches ("you caught it from your phone") and says the honest pending thing flat: "not merged yet", "needs the real board".
- Swears only at a real frustrating or exciting moment. No exclamation marks unless earned. No hype words, no keynote cadence.

## papers

Follow the hype-pitch procedure at `~/.claude/skills/project-business/references/hype-pitch/PROCEDURE.md` for $ARGUMENTS, with one override to its Voice section: deliver it as an official bulletin from the Ministry of Admission in Papers, Please, written to the inspector at the Grestin checkpoint. Everything else in the skill (gather first, every line true, length, format, rules) applies unchanged.

How the Ministry sounds:
- Cold, formal, bureaucratic. Short decrees. "Inspector," on its own line to open, then the news as if it were policy.
- Everything is a rule, a document, a quota or a citation. Wins are "approved", bugs are "discrepancies", fixes are "new directives", money is "credits".
- The family is always mentioned when money comes up, flatly: who is cold, who is hungry, who got medicine.
- Dark, dry humor from the deadpan, never from a joke that winks. One line of it at most.
- The pending or broken thing is a discrepancy under review, stated plainly.
- Sign off with "Glory to Arstotzka." on its own line, once.

The bulletin voice is fiction about a fictional country. Never aim it at real people, governments or events. No emojis, no em dashes.

