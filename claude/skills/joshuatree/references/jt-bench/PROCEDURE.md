---
name: jt-bench
description: Take clean Joshua Tree benchmark numbers and refresh docs/BENCHMARKS.md, the README table and the landing page tiles. Use for /jt-bench, "rerun the benchmarks", or at every Joshua Tree release.
---

Repo: ~/Documents/Code/joshuatree. The kernel times itself (`kernel/bench.h`: boot to shell, heap alloc+free, memcpy, context switch, disk read, rdtsc calibrated against the PIT). `tools/bench.sh` boots it headless and reads the numbers over serial.

## Steps

1. Nothing else may be running. `pkill -f qemu-system-i386 || true` and check no `ci-suite` or `ci-local` is live. Numbers taken beside a running suite come out two times slower; that happened on 2026-09-26.
2. `make kernel.elf && ./tools/bench.sh --write`. It fills `docs/BENCHMARKS.md` and the `<!-- bench:start -->` blocks in `README.md` and `landing/index.html`.
3. Run it twice more without `--write` and eyeball: if a number moves more than about 20 percent between runs the host was busy, run again.
4. `python3 tools/checks/landing-facts-check.py` must still pass. Commit "bench: clean numbers", then ship with /jt-ship or fold into the release PR.

The regression check `tools/checks/bench-check.sh` only proves every number comes back nonzero; values are host dependent and never asserted in CI.
