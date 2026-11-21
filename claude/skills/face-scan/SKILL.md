---
name: face-scan
description: Scan a real person (family, friends) into Vancouver Vice as a MetaHuman from a Live Link Face iPhone recording. Use when the user drops a LiveLinkFace zip in Downloads, says "scan <name> in", "import a face", "put my mom in the game", or invokes /face-scan.
---

# face-scan

Turns a Live Link Face take (iPhone TrueDepth, the Face ID camera) into a MetaHuman Character shaped like that person, inside the Vancouver Vice Unreal project.

## What the person records (tell them this)
- Live Link Face app, MetaHuman Animator mode. Set the **slate name to their first name** (takes with the same slate collide on import).
- Good light, phone at arm's length, face centered. Glasses and headphones off if possible (it still worked with both on for Joshua).
- First 2 seconds: look straight at the phone, neutral face. Then turn left, right, smile with teeth. About 10 seconds is plenty.
- Share the take as a zip, AirDrop it to the Mac (lands in ~/Downloads).

## Run it
Unreal must be open with the QA bridge (unreal/open.sh). Then:

```
cd ~/Documents/Code/vancouvervice/unreal
python3 face_scan.py ~/Downloads/LiveLinkFace_<...>.zip <Name> [neutral_frame]
```

- Default neutral frame is 60 (1 s in at 60 fps). Check `/tmp/<Name>_neutral.jpg` first; if they are not looking straight and neutral there, rerun with a better frame number (seconds x 60).
- Output: `/Game/VancouverVice/Faces/<Name>` (the character) and `MHI_<Name>` (the solved identity).
- Run it in the background and wait on the output; ingest takes about 2 minutes for a 1 minute take, the solve under a minute.

## After (cloud step)
Rig, skin textures and the final build need the Epic MetaHuman cloud service and the user's Epic login. Open the character in the MetaHuman Creator: Create Full Rig, Download Texture Sources, set skin tone, hair, clothes, then Assemble. Scriptable later via `MetaHumanCharacterEditorSubsystem.request_auto_rigging / request_texture_sources / build_meta_human` (see the engine's MetaHumanCharacter/Content/Python/test_character_assembly.py).

## Gotchas
- Never call the `_sync` ingest or `MetaHumanCaptureSourceSync` from the bridge: they block the game thread and deadlock the editor. `face_scan.py` uses the async ingest.
- Unreal cannot decode iPhone .mov itself; the script turns on the ffmpeg encoder (/opt/homebrew/bin/ffmpeg) in Capture Manager settings.
- Details and history: vancouvervice/UNREAL.md.
