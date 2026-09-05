---
name: docs-sweep
description: Find every app under ~/Documents/Code missing a README.md or WHITEPAPER.md and write them in the house voice. Use when the user asks to document all apps, fill in missing docs, or invokes /docs-sweep.
---

# /docs-sweep — fill in missing docs, house voice

1. **Scan**: for each top-level dir in `~/Documents/Code` that's a real project (has its own git repo or package/Package.swift/wrangler.toml — skip `scripts`, `notes`, `os`, `supabase`, dotfiles, loose files), check for `README.md` and `WHITEPAPER.md`.

2. **Missing README.md**: write one following `~/Documents/Code/README-TEMPLATE.md` exactly (see [[readme-voice-template]] memory) — problem punch, "That's the gap", mechanism, "That's it. That's the whole product.", one metaphor, v0/v1/business, then code blocks with real commands/URLs pulled from the project's own package.json/wrangler.toml/Package.swift/scripts.

3. **Missing WHITEPAPER.md**: same voice, prose only, never code (per house voice) — what it is, why it exists, how it works at a systems level, where it's going.

4. Base every doc on what's actually in the repo (read package.json, main source files, existing roadmap.md) — never invent features or URLs. Skip a project entirely if you can't tell what it does from the code in under a minute; flag it instead of guessing.

5. **Report**: TLDR list of which projects got which doc, and which were skipped/flagged.

## Usage awareness
Many small independent projects — fan out with fork subagents (a handful at a time, not all ~40 at once) since each doc-write is read+write on one project with no cross-project dependency. Keep going until every missing doc is filled or flagged.
