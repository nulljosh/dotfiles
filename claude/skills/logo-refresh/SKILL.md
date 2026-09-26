---
name: logo-refresh
description: Refresh or evolve an ink/engraved logo or badge (Joshua Tree badge, Turing mark, any black-on-paper mark) with ImageMagick + potrace: clean vector trace, erase noisy tiny text, add motifs, render 2x retina PNG, side-by-side preview. Use when the user says /logo-refresh, "refresh the logo", "modernize the badge", on every Joshua Tree minor version bump, or when making a mark more X-inspired.
---

# /logo-refresh

Evolve a logo one small step, never a redesign. Joshua loves the brush-stroke detail; every step keeps it.

## Run

```sh
python3 ~/.Codex/skills/logo-refresh/logo.py SRC.png OUTDIR \
  --erase 60,290,77,690 540,300,557,620 \
  --draw "circle 118,296 124,296" "path 'M 475.5,483 A 12,12 0 1 0 488.5,483'" "line 482,474 482,490"
python3 ~/.Codex/skills/logo-refresh/logo.py --selftest
```

Outputs `logo.svg`, `logo@2x.png` (transparent, for CSS masks), `preview.png` on the page background, `compare.png` (old | new).

## Rules learned the hard way (2026-09-25, Joshua Tree 1.3)

- **No blur before threshold.** Blur + threshold + high `-t` merged the hatching into blobs, broke letters and erased ribbons. Joshua: "simplified too much". Defaults `-t 6 -a 1.1` keep the brush strokes; he called that pass "great detail on the brush strokes".
- **Tiny text traces as garbage** at page resolution ("PEOPI", "BRIGHTFR"). Erase it with `--erase` rects rather than keep it.
- **Motifs are thin strokes in the same ink**, placed in open space, never over detail. Joshua Tree 1.3 turned the scene into a computer window: three window buttons top left, a power-symbol sun over the mountains, a `>_` prompt on the plate. He wants it more computer-inspired each step while keeping the tree.
- **Look before shipping.** Read `compare.png` and a crop of every new motif at 2x. Send the full preview to Joshua with SendUserFile and wait for his OK before merging.
- ImageMagick + potrace only. Never Pixelmator. No text added to app icons (badges already carry lettering; don't add more).

## Joshua Tree specifics

Asset: `landing/badge.png` (mask via `.badge { --src: url(badge.png) }`, aspect 620/900, ship the @2x render). Log each step in `docs/BADGE.md`. The source for the next step is the previous step's `logo@2x.png` downscaled to 620x900, or keep the pbm with motifs from the last run.

- **Never erase with rectangles that cross the subject.** Rect edges left square notches on the Joshua tree's trunk and a flat bottom on a leaf burst; Joshua spotted both on his phone. Cut once, horizontally, where a line (the ground) hides the cut; remove loose specks by connected-component size, not by rect.
- **Zoom QA at 4x** (`rsvg-convert -w 1600`, crop the joints: trunk base, forks, burst bottoms) before sending.

## Joshua Tree 1.4 direction (2026-09-25)

Engraved Joshua tree (the brush strokes he loves) on a short ground line, ONE color (ink). The circuit-root and two-color versions were tried and he called them "mid"; he asked for just the tree. "Grown from scratch" stays as copy, not as roots. Ivory #faf9f5, ink #141413, sans wordmark, lots of air, Anthropic-ad feel. He called plain vector icons "basic as fuck" and the old badge "mid"; the hybrid was "very original". Working files: scratchpad `hybrid-mark.svg`, `poster.svg`.

## Turing specifics

Asset: `web/badge.svg` (CSS mask in `web/index.html`, `.mark-foot .ink`), white ink on black, so draw motifs in white and trace the black. Never edit it by hand: `python3 tools_badge.py --version X.Y.Z` rebuilds it from the frozen `art/badge-source.svg` plus every step in `MOTIFS` (tools_badge.py). Her story is a mind: each minor adds more sky around her. 4.8 was three constellations (a dipper in front of her gaze, Lyra behind her neck, a small dipper below her chin) and loose stars; Joshua asked for "more than just one so it's notable". Shapes must not read as letters or symbols (a W read as M, a diamond as a card suit). Trace at 2048: at 1024 Vision OCR misses SAMANTHA and the gate fails. ImageMagick's SVG renderer draws potrace output blank; preview with `rsvg-convert`.
