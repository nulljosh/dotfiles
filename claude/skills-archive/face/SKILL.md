---
name: face
description: Iterate a talking face (Joshua's portfolio face, Samantha) one version at a time toward A+: render, bench against a real person, contact sheet, send, log Joshua's grade. Use when the user says /face, /face-loop, "next face version", "loop the mouth/animation", or grades a face video ("v5 is a B+").
---

# face

One version = one specific flaw fixed, rendered, measured, shown. Joshua's eye is the grade; the benchmark only says where to look.

## The pieces (Joshua Tree repo; on branch feat/face-blend / PR 241 until merged)
- Joshua's own face: `/Volumes/LaCie/lipsync/joshua/` (`render.sh` = Seedance 2.5 audio-driven render, `versions.tsv` = his ledger, `voice/` = clones and takes, `align-v2.json` for the v2 voice). Character folder `~/.samantha/characters/joshua/`.
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

## Pick the right tool first
- Fixed line, hero clip (a landing intro, a portfolio demo): render the whole face to the real audio in one pass. Seedance 2.5 on Higgsfield takes `audio_urls` through the developer API (`bytedance/seedance-2.5/reference-to-video`, portrait as `image_urls`, 480p, about $1.12 for 8 s). The audio must be a public URL (the portfolio site works). Joshua's v4 (2026-10-02) came out as real video, bench words 64 against a real person's 72. `/Volumes/LaCie/lipsync/joshua/render.sh` is the working call.
- Live replies in a browser (landing page, Turing's Mac app): a real-time avatar API, not our pipeline. Simli is under 1 cent a minute (PCM16 16 kHz in, WebRTC video out, `simli-client`); HeyGen LiveAvatar lite about $0.10 a minute. Joshua Tree's worker mints the session token (`/api/avatar/session`, off until SIMLI_API_KEY and SIMLI_FACE_ID are set).
- One-off hero clips: a lip-sync render (LatentSync free on HF, sync.so lipsync-2 about $2.40 a minute, Higgsfield Speak about $8.40 a minute and failed twice).
- Inside the kernel (no WebRTC, no GPU): this skill's pipeline, frames the OS already knows how to show.

## Napkin math (2026-10-02, Seedance 2.5 on the Higgsfield API)
- Rates: about $0.14 a second at 480p, $0.33 at 720p, $0.56 at 1080p. A 5 s meme clip is 70 cents, an 8 s talking clip is $1.12 to $4.50.
- A movie: 90 minutes is 5,400 s, so one take of every shot is $756 at 480p, $1,780 at 720p, $3,000 at 1080p. Real shots need 3 to 5 takes (we needed 2 to 3 rolls per keeper), so a feature is roughly $4k to $15k in renders.
- Live replies in the OS: no. One 8 s reply is about $1.12 and takes 5 to 10 minutes to come back, so it cannot be live, and 100 replies a day is $112. Live is a real-time avatar API (Simli, under a cent a minute, WebRTC in the browser over the kernel; Joshua Tree's worker has the `/api/avatar/session` hook stubbed). Pre-rendered frames stay for the kernel itself, which only plays frames fetched over HTTP.
- 1080p is wasted on the kernel: it draws the face at 300 px from 320 px frames, and 720p already out-resolves a phone. Spend the difference on re-rolls, which is where the quality comes from (same prompt, different take: 65 to 75 on the bench).

## What we learned (don't relearn)
- Stitching reads as South Park. The viseme pipeline (face_visemes) pastes a mouth patch onto a base face; Joshua graded it C and called it a South Park character, even once the plan correlated 0.87 with the words (v3, 2026-10-02). A whole-face neural render of the same line was B+ raw (v1) and real-looking with audio (v4). Use the pipeline only where a render per sentence is impossible (inside the kernel, live replies).
- Per-frame percentile mouth measure inverts on some faces. Marking the darkest 12% of the mouth box per frame always marks the same number of pixels, so counting the rows they span read Joshua's open mouth (dark pixels bunched inside) as closed and his closed mouth (scattered shadows) as open; words scored 0 with the plan backwards. Fixed in face_visemes with one clip-wide dark threshold and dark area as openness.
- Loudness-only mouth picking caps at D: mouth follows volume, not words. Measure mouth shapes and target each sound (v23).
- Frame-to-frame jumping reads as "photos stapled together" (v25-v26). Keep a continuous base; swap only the mouth (v27 B).
- A frozen head with a moving mouth reads as a photo. Real talkers drift ~4% of frame height (v29).
- Random-walk sway is janky; use slow overlapping sines (v31, 4x smoother).
- Eyes open forever is a stare; blink every 3-5 s (v32).
- Talk loops cut from a blink stretch blink the whole time (v17): the frame cutter must pick open-eyed stretches.
- The benchmark once graded A- what Joshua called C+. Trust his eye; calibrate the bench to real video.

## Backlog (next ideas, roughly in value order)
Bigger head drift (head score ~28 vs real 100); eyebrow lift on stressed words; eye saccades (small darts); 512px source instead of 320 for a sharper mouth; match grain/sharpness between patch and base; a fresh lip-sync render with an eyes-open, gently moving base (portrait drift) and more open-mouth frames; phoneme timing in the kernel (Turing sends ElevenLabs alignment).
