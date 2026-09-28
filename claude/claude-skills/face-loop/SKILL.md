---
name: face-loop
description: Iterate Samantha's talking-face animation one version at a time toward A+ (render, benchmark against a real person, contact sheet, send, log Joshua's grade). Use when the user says /face-loop, "next face version", "loop the mouth/animation", "until version 100", or grades a face video ("v32 is a C").
---

# face-loop

One version = one specific flaw fixed, rendered, measured, shown. Joshua's eye is the grade; the benchmark only says where to look.

## The pieces (Joshua Tree repo; on branch feat/face-blend / PR 241 until merged)
- `tools/gen/face_visemes.py <lipsync.mp4> <words.json> <speech.wav> <out.mp4>`: builds any sentence from one lip-synced render. Whole-sentence plan (Viterbi), continuous base video, feathered mouth+jaw patch, optical-flow in-betweens, head sway/tilt/nods riding the voice, real blinks (`BLINK_CLIP=` a same-framing clip that still blinks).
- `tools/bench/face_bench.py [--align words.json] a.mp4 ...`: fluid, smooth, pops, steady, sync, rest, eyes, alive, head, whole, words. Calibrated on a real NASA interview close-up (`/Volumes/LaCie/lipsync/real-close.mp4`, public domain): a real person scores about B-.
- Assets on the LaCie: `/Volumes/LaCie/lipsync/` (char18/talk.mp4 = v18 lip-synced render, eyes fixed; char16/talk.mp4 = same with blinks; test.wav + test-align.json = a sentence she never rendered).
- Heavy work stays on the LaCie (UV_CACHE_DIR there). Never run local lip-sync models: MuseTalk swapped the Mac to 12GB. New renders: character-creator's `lipsync.sh` (free LatentSync on Hugging Face, ~1 render a day on the free quota).

## One iteration
1. `scripts/iterate.sh <N> "<what changed>"` renders `samantha-vN.mp4`, benches it next to the real clip and vN-1, makes a contact sheet, appends to the ledger.
2. Look at the sheet yourself (Read the PNG). If it's worse, say so and revert.
3. SendUserFile the mp4 with a one-line caption: the change and the bench total.
4. When Joshua grades it, record it: `scripts/grade.sh <N> "<grade>" "<his words>"`.

## Ledger
`/Volumes/LaCie/lipsync/face-versions.tsv`: version, date, change, bench total, Joshua's grade, his words. Read it first: it says what's been tried.

## What we learned (don't relearn)
- Loudness-only mouth picking caps at D: mouth follows volume, not words. Measure mouth shapes and target each sound (v23).
- Frame-to-frame jumping reads as "photos stapled together" (v25-v26). Keep a continuous base; swap only the mouth (v27 B).
- A frozen head with a moving mouth reads as a photo. Real talkers drift ~4% of frame height (v29).
- Random-walk sway is janky; use slow overlapping sines (v31, 4x smoother).
- Eyes open forever is a stare; blink every 3-5 s (v32).
- Talk loops cut from a blink stretch blink the whole time (v17): the frame cutter must pick open-eyed stretches.
- The benchmark once graded A- what Joshua called C+. Trust his eye; calibrate the bench to real video.

## Backlog (next ideas, roughly in value order)
Bigger head drift (head score ~28 vs real 100); eyebrow lift on stressed words; eye saccades (small darts); 512px source instead of 320 for a sharper mouth; match grain/sharpness between patch and base; a fresh lip-sync render with an eyes-open, gently moving base (portrait drift) and more open-mouth frames; phoneme timing in the kernel (Turing sends ElevenLabs alignment).
