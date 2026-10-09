---
name: jt-monetization
description: Same as /money, the money plan for the current project, plus Joshua Tree's fixed rules (OS stays free, money is hardware). Use for Joshua Tree, or anywhere Joshua says /jt-monetization.
---

# /jt-monetization

Run the `/money` skill (read `/Users/joshua/Documents/Code/dotfiles/claude/skills/project-business/references/money/PROCEDURE.md` and follow its Steps) on the current project. If the project is not Joshua Tree, that is all this does. If it is Joshua Tree, also apply the rules below, then write the plan into `joshuatree/MONEY.md` (it lives at the repo root) and grill Joshua on anything unverified.

## Fixed, never re-litigate
The OS stays free. No paid OS, license or subscription. Money comes from custom hardware sold alongside it. The kernel has no TLS or accounts by design, which rules out most software monetization anyway.

## Check before claiming hardware-ready
Grep `drivers/` this session. `rtl8139.c`, `ata.c`, `pci.c` target real silicon. `vmmouse.c` is a VMware/QEMU backdoor and does not work on real hardware, so say that out loud. Also grep for QEMU-only assumptions (virtio, fixed framebuffer sizes) and name the real gaps, not only the wins. Future drivers should target real chipsets.

## Ideas, labelled as ideas
- Dev-kit board with JT pre-flashed, for the osdev and retrocomputing crowd.
- Reference device (mic, speaker, small board) that runs v100 voice control end to end, both a demo and a sellable unit.
- Paid integration help for teams wanting a tiny, auditable stack. Support, not a paid OS.

## North star
Port Joshua's own apps to run natively on JT with no runtime between app and CPU, build in LLM integration (Turing), and make the OS extensible by talking to it. Scope new roadmap items against that.

## Ground rules
Never invent a user count, revenue figure or timeline: say "no number yet". Every hardware-ready claim is checked against the driver list in the current session. Pair with `hype-pitch` for tone only.
