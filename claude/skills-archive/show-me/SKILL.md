---
name: show-me
description: Run the app, walk the flow that was just built, and send Joshua a short video of it working so he never has to click through it himself. Use for /show-me, "show me", "record the new flow", "prove it works", or after shipping a visible feature.
---

# Show me

Goal: one short video (under 60 s) of the new flow working in the real app, sent to Joshua. A video of it failing counts as a finding: say so, don't dress it up.

1. **Pick the flow.** Read the last commits or the task in this conversation. Write the steps as 3 to 8 plain actions ("open Saved, tap the first listing, tap Share"). If the flow is unclear, ask in one line.
2. **Run the app** the way the `run` skill or the repo's own CLAUDE.md says. Use real data from the gitignored `.env`, never a demo account.
3. **Record the flow, headless first:**
   - **Web:** a Playwright script with `recordVideo` (`uvx --from playwright python script.py`) that does the steps with real clicks, waits about 1 s between them, and saves the video to the scratchpad. Playwright names it `page@<hash>.webm`; loop over `*.webm`, because the `ls` alias pads names with a space. For a page with no interaction, the `app-screenshots` record-web mode is enough.
   - **iOS:** only when the flow is iOS only. Boot one simulator, `xcrun simctl io booted recordVideo --codec h264 out.mov`, drive the steps with XcodeBuildMCP (or a UI test), stop the recording with Ctrl-C (`kill -INT`), then shut the simulator down.
   - **macOS:** `screencapture -v -V <seconds> out.mov` while the steps run. Don't put windows in front of Joshua while he's working; if the app has to be visible, say so first.
4. **Check it yourself.** Pull 3 or 4 frames with `ffmpeg -i out.mov -vf fps=1/5 frame-%02d.png` and Read them. The new thing has to be visibly on screen. If it isn't, fix it or report it, and don't send a video that shows nothing.
5. **Shrink and send.** `ffmpeg -i out.mov -vf "scale=-2:720" -c:v libx264 -crf 28 -an show-me.mp4`, then SendUserFile it with one line on what it shows.

Never commit the video. Close the simulator, the browser and anything else you opened.
