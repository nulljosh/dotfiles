---
name: blender-model
description: Make game-ready 3D models ourselves in headless Blender (props, weapons, furniture, vehicles parts, buildings) or pull free CC0 models and photo textures, then export a compressed GLB and QA it in the game. No Higgsfield credits. Use for /blender-model, "model it in blender", "make a 3D model", "make a gun/prop/chair", or when Higgsfield credits are low.
---

# /blender-model

Build it in code, look at a render, fix it, ship a small GLB. Blender 5.2 is at `/Applications/Blender.app/Contents/MacOS/Blender`.

## 1. Pick the route
- **Hard-surface props** (guns, furniture, signs, street kit, store fixtures, simple vehicles): model in code with `kit.py`. Fast, sharp, free.
- **Organic or detailed things** (plants, rocks, food, a real chair): first look for a CC0 model. With the `blender` MCP connected: `search_assets` (Poly Haven, Poly Pizza, Sketchfab) then `import_asset`. Poly Haven and Poly Pizza are CC0; check each Sketchfab licence before shipping and credit it in docs/ASSETS.md.
- **Photo textures**: Poly Haven's API is free and CC0: `curl -s https://api.polyhaven.com/assets?t=textures&s=<search>` then `curl -s https://api.polyhaven.com/files/<id>` for the 1k/2k jpg URLs (diffuse, rough, normal).
- **People who must walk and fight**: rigging still needs Higgsfield (`image_to_3d` with `enable_rigging`), then `tools/merge-clips.mjs` copies Joshua's clips on by bone name. Ask before spending credits.

## 2. Model in code
Write a model script next to your output (scratchpad), import the kit, build with boxes, cylinders, spheres and tori, each with a bevel so edges catch light (no flat polygon look):

```python
import sys; sys.path.insert(0, "/Users/joshua/.claude/skills/blender-model"); import kit
kit.reset()
steel = kit.mat("steel", (.16, .17, .19), metal=.9, rough=.28)
kit.box("slide", (.19, .028, .034), (0, 0, .03), mat=steel, bevel=.004)
kit.cyl("barrel", .0055, .02, (.1, 0, .03), rot=(0, 90, 0), mat=steel)
kit.finish(sys.argv[-2], sys.argv[-1])
```

Run: `Blender -b --factory-startup --python model.py -- out.glb preview.png`. `example_pistol.py` is a full worked example.

Rules that keep it looking real:
- Real-world metres, Z up, +X forward (the game turns +X to face where the character faces).
- Bevel every box (2 to 5 percent of its smallest side). Smooth by angle is on.
- Three materials at most: a metal (metal .8 to .95, rough .25 to .35), a matte (rough .6 to .8), an accent (wood, glass, paint). Use a photo texture (`tex=`) for anything bigger than a hand.
- Proportions from a reference photo, not memory. Look at the image first.

## 3. Look at it
Read `preview.png` every time. Fix silhouette first, then proportions, then materials. Three passes is normal.

## 4. Shrink and ship
```
npx -y @gltf-transform/cli optimize out.glb final.glb --compress draco --texture-compress webp --texture-size 2048
```
Keep textures at 2048 for anything seen up close (people, weapons, store interiors); 1024 for distant props. A big mesh first goes through `tools/decimate.py` (Vancouver Vice repo).

## 5. QA in the game
Load it with the game's GLTFLoader (Draco on), size it in world units (check the parent chain's world scale: a rig can hide a 0.01 armature scale, which once made every gun invisible), and screenshot it in WebKit (`tests/_gunsee.mjs` pattern) before calling it done. Add a row to the repo's docs/ASSETS.md with source and licence.
