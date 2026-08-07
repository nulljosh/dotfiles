---
name: architecture-svg
description: Generate a repo's architecture.svg in the house Apple node-and-line style. Use when a repo is missing architecture.svg, or when its structure changed enough that the diagram is stale.
---

# architecture-svg

Every repo under `~/Documents/Code` needs an `architecture.svg` (Repo Standards in `~/Documents/Code/CLAUDE.md`): 200×200 isn't the rule here — icons are 200×200, architecture SVGs are wider (roughly 640×360, whatever fits the node count), white background, inline styles only, Apple node-and-line look.

This is a manual-per-repo pass, not full codegen — every repo's shape is different (web vs iOS vs backend vs static). Don't build a generic layout engine for this (ponytail: one-off diagrams don't earn an abstraction).

## Steps

1. Read the target repo's `README.md` and `CLAUDE.md` — pull out: entry points (web/iOS/macOS/CLI), the core engine/logic module, external APIs/services it calls, and where data lands (KV/DB/file).
2. Group into 2-4 rows top-to-bottom: **clients** (web/iOS/macOS/watchOS) → **core logic** (the one module doing the real work) → **external services/APIs** → **storage/output**. Skip rows that don't apply.
3. Copy `reference/template.svg` in this skill folder and edit boxes/text/paths to match. Keep the same fill/stroke tokens:
   - Neutral box: `fill="#f5f5f7" stroke="#d1d1d6"`
   - Highlighted/core box: pick the repo's accent color (never purple/teal, house rule) at `fill-opacity=".15"` with matching `stroke`
   - Connector lines: `stroke="#d1d1d6"` or `#ccc`
   - Title: `font-size="16" font-weight="600"` centered at top
4. Save as `<repo>/architecture.svg`. Open it once (`open architecture.svg` or view raw) to sanity-check no overlapping boxes/text before committing.

## Reference

See `nimble/architecture.svg` or `curvely/architecture.svg` for real worked examples of this exact style.
