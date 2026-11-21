---
name: asc-name-creator
description: Find an available App Store app name by probing Apple's real duplicate check, then lock it. Use for any app name hunt, rename, "find a better name", or when a name is taken. Also bulk domain checks for company and product names.
---

# /asc-name-creator

Thin entry point. The full procedure, `probe.sh` and `domains.sh` live in
`~/.claude/skills/apple-metadata/references/asc-name-creator/` (they were folded into apple-metadata, which is why
this skill used to vanish from the list). Read `PROCEDURE.md` there first, then probe.

## Fast path
1. Brainstorm 20+ one-word candidates in the app's own metaphor; no startup roots (Spark-, Flow-, -ly).
2. iTunes search is only a pre-filter; Apple's answer is the truth.
3. Probe: `ASC_PROBE_APP=<id> ~/.claude/skills/apple-metadata/references/asc-name-creator/probe.sh Foo Bar` against a
   record with no live or in-review version. When the app being renamed has an editable app info (create the next
   version first), probe it directly with `asc apps rename --app ID --app-info INFO_ID --locale en-US --name X`
   (`asc apps info list --app ID` shows the editable one) and read the name back 3 times after.
4. Expect misses: about 2 of 80 plain words are free. Budget 150+ probes; rare real words clear most often. Never fused compounds (Rootward, Thinkpond): two words glued together are two words.
5. Lock only on a clear keep, then run `/rename`. Apps live at `<name>.jaybulb.com`, no domain purchase needed.
