---
name: jt-monetization
description: Reasoning frame for Joshua Tree (the from-scratch i386 kernel) monetization and hardware strategy. Use whenever the user asks about JT's business model, revenue, hardware plans, or wants monetization ideas for the kernel project. Keeps ideas grounded in what's actually built, never invents numbers.
---

# Joshua Tree monetization

## The one fixed decision
The OS itself stays free. Never pitch a paid OS, paid license, or subscription
for the kernel/GUI/apps. This was decided already, don't re-litigate it.
Money comes from hardware sold alongside it.

## Why hardware, not software, is the real lever
This kernel has zero TLS/crypto anywhere (deliberate, standing constraint) and
no accounts system. That alone rules out most software monetization (IAP,
subscriptions, licensing servers) without a large, unplanned scope add. Hardware
sidesteps that entirely: you sell a box, the box runs free software.

## What's actually real hardware-facing right now (check before pitching)
Grep `drivers/` and confirm before claiming anything targets real silicon:
- `rtl8139.c` — a real, extremely common NIC chip (still shipped on real boards
  and used as the reference NIC in QEMU precisely because it's a real part)
- `ata.c` — real ATA/IDE protocol, not QEMU-specific
- `pci.c` — real PCI enumeration
- `vmmouse.c` — the opposite case: a VMware/QEMU-only absolute-pointer backdoor
  protocol, does NOT work on real hardware. Flag this honestly as a known gap
  (real hardware needs a real PS/2 or USB HID mouse driver first) rather than
  implying the input stack is hardware-ready.

Before pitching "we're hardware-ready," grep for anything else QEMU-specific
(virtio, `-vga std` assumptions, fixed 1920x1080 framebuffer assumptions) and
name the real gaps, don't just count the wins.

## Monetization ideas (label these as ideas, not commitments)
- **Dev-kit board**: a small single-board computer, JT pre-flashed, sold to
  the from-scratch-OS/retrocomputing hobbyist crowd (the same audience that
  buys Raspberry Pi Pico boards and reads osdev.org). Real market, unverified
  size, don't quote a number without a source.
- **Reference hardware for the roadmap's own north star**: v100 is real voice
  control per roadmap.md. A physical device (mic, speaker, small board) built
  specifically to run JT and demo that end-to-end is both a marketing artifact
  and a sellable unit, two birds.
- **Support/consulting**: embedded teams wanting a tiny, fully auditable,
  freestanding stack (no Linux, no libc, every line readable) are a real
  niche. Paid integration help, not a paid OS.

## The real long-term thesis (Joshua's own words, 2026-09-14)
Not just "sell hardware alongside a free OS." The actual shape:
- Port Joshua's own apps (epiphany, curvely, etc, the whole fleet in the
  ~/Documents/Code CLAUDE.md table) to run natively ON Joshua Tree, no
  Swift/ObjC/scripting-language layer between app and bare metal. The pitch
  is raw speed: a Bloomberg-terminal-style trading app with zero runtime
  between it and the CPU.
- LLM integration built in (Turing, the local LLM pipeline, is the natural
  fit, see the Turing memory) so these become terminal+trading-bot hybrids.
- The OS itself should eventually be dummy-proof enough that a non-coder
  bootstraps and extends it by talking to an LLM, not by writing C. This is
  the "v100 real voice control" roadmap item's actual end state: not just
  "control the OS by voice" but "build the OS by voice."
Treat this as the north star when scoping future JT roadmap items — apps
that are candidates for native ports, and LLM-driven OS-building UX, are
both on-thesis even if not yet in roadmap.md.

## Ground rules when pitching this
- Never invent a user count, revenue figure, or timeline. If asked for one
  and none exists, say "no number yet" instead of estimating one to sound
  confident.
- Every claim about "hardware-ready" must be checked against the driver list
  above in the current session, not assumed from memory of a past pitch.
- Pair with `hype-pitch` for delivery voice; this skill supplies the content
  guardrails, hype-pitch supplies the tone.
