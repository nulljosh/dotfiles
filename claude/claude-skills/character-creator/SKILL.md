---
name: character-creator
description: Create or restyle a talking AI character (Samantha by default) from a plain description, a face portrait, three short video loops (idle, listening, talking) and an ElevenLabs voice, saved to ~/.samantha/characters/<name>/. Use when the user says /character-creator, "make her ginger", "change her look", "new character", "give her glasses", "make it look like me", or wants the assistant's face or voice customized.
---

# character-creator

A character is a folder. Everything that shows her face or speaks in her voice reads it.

```
~/.samantha/characters/<name>/
  character.json   description, look prompt, voice id, created date
  portrait.png     the still face (also the thumbnail and the fallback)
  portrait.url     public CDN link to it, what the video model reads
  idle.mp4         mouth closed, breathing, blinking: plays while nothing happens
  listen.mp4       small nods: plays while the user is talking
  talk.mp4         lips moving: plays while her voice is playing
```

The trick that keeps it cheap: the face is rendered **once**. At runtime, `talk.mp4` loops while the ElevenLabs audio plays and `idle.mp4` loops otherwise. No video is generated per reply.

## Steps

1. **Turn the ask into a look prompt.** Start from the current `character.json` look when restyling ("make her ginger" keeps everything else). Always keep: head and shoulders, looking straight into the camera, closed-mouth smile, plain warm cream background, soft window light, photorealistic, centered, clothed. Add the user's traits in plain words.
2. **Portrait (a few cents):** `scripts/portrait.sh ~/.samantha/characters/<name> "<look prompt>"`. Look at `portrait.png` yourself before going on. Wrong hair, extra fingers, odd crop: regenerate, it costs cents. Show the user.
3. **Loops (about $0.70 each at 5s, 480p):** only after the user likes the portrait. `scripts/loop.sh <dir> idle`, then `listen`, then `talk`. Run them one at a time. Pull a frame from each (`ffmpeg -ss 2 -i talk.mp4 -frames:v 1 /tmp/f.png`) and check the face still matches the portrait.
4. **Voice:** list what the key can use (`GET https://api.elevenlabs.io/v2/voices`, header `xi-api-key`). Free plans can only use `premade` voices over the API, library voices return 402. Pick one that fits the look, save its id in `character.json` as `voice_id`. Samantha's is Sarah, `EXAVITQu4vr4xnSDxMaL`.
5. **Write `character.json`:** `{"name", "look", "voice_id", "created"}`.
6. **Say what it cost** in one line (portrait count x cents, loop seconds x $0.14).

## Lip sync that says the words (free, learned the hard way 2026-09-27)

A talk loop filmed without her voice never matches the words, however you reorder its frames (face_bench.py measured it: lip sync stuck at 55/100 or lower for 15 versions). Render once with her voice instead:

1. **Pick a line that works every mouth shape** and that belongs to the project (not filler). Record it with timings: ElevenLabs `POST /v1/text-to-speech/<voice>/with-timestamps` gives the audio plus per-character timing. Save `visemes.wav` (WAV, mono 44.1k; Higgsfield's Speak rejects MP3 with `invalid_audio_format`).
2. **Render the lip sync:** `scripts/lipsync.sh ~/.samantha/characters/<name>`. Free: LatentSync on Hugging Face (needs a free HF read token, `HF_TOKEN` in secrets.fish; signed-out quota is too small). Writes `talk.mp4`.
3. **Cut the frames:** Joshua Tree's `tools/gen/face_frames.py <name>` picks a seamless, eyes-open stretch and crossfades the loop wrap.
4. **Grade it:** Joshua Tree's `tools/bench/face_bench.py a.mp4 b.mp4` scores fluid, smooth, pops, steady, sync, rest and a letter. Ship only if it beats what's live.

What failed, so you don't repeat it:
- Higgsfield Speak (`higgsfield-ai/speak`): "Generation failed" twice with valid inputs. The app account (`higgsfield` CLI) can't run lip sync on the free plan.
- MuseTalk locally on a 16GB Mac: swap hit 12GB and nearly filled the disk. Heavy models go on the external drive, but swap always lives on the internal disk.
- Wav2Lip public Space: renders, then 403s the download.
- Using `idle.mp4` as the lip-sync base: the source blinks a lot, so the talk loop blinked the whole time. Use the still portrait (`lipsync.sh` does).
- Picking talk frames by loudness alone: sync 2 to 46. The render itself scores 66+. Next step is phoneme timing from the ElevenLabs alignment.

## Costs and keys

- Balance, no browser: `scripts/spend.sh` (Higgsfield has no balance API; loop.sh and portrait.sh log every render, `spend.sh set <dollars>` calibrates from the dashboard). Check it before any render and never let a batch run it down.
- Higgsfield key: `HIGGSFIELD_API_KEY` in `~/.config/fish/secrets.fish`, `id:secret` form, sent as `Authorization: Key id:secret`. Prepaid balance; check it before loops. A top-up is the user's to make, never click Pay.
- ElevenLabs key: `ELEVENLABS_API_KEY`, same file. Free plan: 10k credits a month.
- Never print either key. Never commit `character.json` alongside media into a public repo without asking: it is someone's face.

## Rules

- Never generate a real, identifiable person from a name ("make her look like <celebrity>"). "Make it look like me" means the user supplies their own photo, used as the reference image instead of a Soul portrait.
- One render at a time. Poll, don't fan out.
- Portrait first, loops only after the user says the face is right.
- Costs: `scripts/spend.sh` is the developer-API ledger (no balance API; calibrate with `spend.sh set` from open.higgsfield.ai Billing). `spend.sh app` reads the app account live and `spend.sh cost <model> ...` quotes a render for free, both through the official `higgsfield` CLI (brew install higgsfield-ai/tap/higgsfield, `higgsfield auth login` needs port 8765 free). Speak via API needs WAV audio, MP3 returns invalid_audio_format.
