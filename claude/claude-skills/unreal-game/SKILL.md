---
name: unreal-game
description: Build a game in Unreal 5.8 on Mac by agent only, with no hands on the editor. Covers the MCP and file bridge, Blueprint DSL, QA play-tests, Blender props, MetaHuman builds, memory limits and packaging. Use for Vancouver Vice or any new Unreal project.
---

# Unreal game, agent-driven

The reference project is `~/Documents/Code/vancouvervice`. Read its `UNREAL.md` first; it holds the current state and every gotcha found so far. Copy the `unreal/` folder into a new project and change the paths.

## Rules
- Only one agent drives Unreal at a time. Other agents work on files: Blender, DSL, docs.
- Run lean: no idle Play, `t.MaxFPS 30`, `r.ScreenPercentage 60`, Lumen off, `stat none`. Never leave Play running for hours, because GPU memory is only freed by an editor restart.
- Save everything before a restart, then relaunch with `unreal/open.sh`. For Vancouver Vice there is standing approval to restart and rebuild without asking.
- Only parody logos, never real brands.

## Driving the editor
- Launch with `unreal/open.sh`. It starts the MCP server on port 18000 with stats and trace off.
- Run `unreal/doctor.sh` for status (it shows the editor footprint and flags a restart over 20 GB), `doctor.sh lean` (unloads local LLMs and trims the editor), and `doctor.sh heal`. It restarts MCP if the port is stuck, and its RAM guard refuses a relaunch when swap is full.
- `python3 unreal/qa.py '<python>'` runs Python inside the editor through the file bridge (`/tmp/vv_qa`, loaded by `Content/Python/init_unreal.py`). Set `QA_TIMEOUT` for long jobs.
- `unreal/mcp.py` is the MCP client (BlueprintTools: write_graph_dsl, create_node, connect_pins, compile_blueprint). Blueprint logic lives in `unreal/*.dsl` as S-expressions.
- The DSL can't create Enhanced Input events. Make a custom event, `create_node` the input action, then `connect_pins`.

## Play-tests
- `python3 unreal/qa.py` runs the walk test to mission one. `python3 unreal/qa.py drive` runs the car-jack test, driving by `inject_input_vector_for_action` on the EnhancedInputLocalPlayerSubsystem.
- PASS or FAIL is read from the mission index, not from screenshots. Put a catch pad under the spawn, because tile holes swallow the pawn.
- Proof for Joshua: `open -a UnrealEditor` first, then `screencapture -V`, then ffmpeg compress, then SendUserFile.

## Assets
- Props and clothes: Blender 5.2 headless (`blender -b --python unreal/<prop>.py`), exported as fbx and imported with AssetImportTask onto `metahuman_base_skel`. Clothes follow the body through a leader pose set in the construction script.
- MetaHuman: MetaHumanCharacterEditorSubsystem. Run request_auto_rigging, then request_texture_sources, then build_meta_human. Free RAM first (stop oMLX), because a build under memory pressure crashes the editor.
- Keep character textures at 2K and use a low groom LOD.

## Open world memory (16 GB Mac)
- Cesium streams by view. Keep MaximumCachedBytes at 256 MB, frustum and fog culling on, preload of ancestors and siblings off, maximum screen space error 12, and 20 simultaneous loads.
- Watch memory with `footprint <pid>` and `sysctl vm.swapusage`. An editor footprint over 20 GB means it's time to restart.

## Ship
- Build with `unreal/package.sh` (RunUAT BuildCookRun). Close the editor first. Restrict the Cesium token before any public build.
- After every change that lands: commit, push, sync the landing page and README, and send Joshua a screenshot.
