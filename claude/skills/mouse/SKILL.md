---
name: mouse
description: Reconnect or re-pair Joshua's Bluetooth mouse (Incase Ergonomic Mouse) when he has no other pointer. Use when the user says /mouse, "connect my mouse", "mouse won't click", or the mouse is disconnected.
---

# Mouse

Joshua has no USB mouse and the keyboard (NuPhy Air96) is the only working input, so never ask him to click anything. Do it all from the shell, fast, no screenshot loops.

Mouse: "Incase Ergonomic Mouse", address `dd-93-ad-ca-ca-29` (re-paired 2026-11-16; stale c6/c7 entries linger. App: /Applications/Connect Mouse.app tries every paired Incase address, so `blueutil --paired | grep -i incase` first).

## 1. Already paired (normal case)
```
blueutil --power 1
blueutil --connect dd-93-ad-ca-ca-29
sleep 4; blueutil --connected | grep -i incase
```
If it connects, done. If not, have him toggle the mouse switch off/on, retry once. Still failing: the mouse changes address on re-pair, so the saved entries go stale. Forget every Incase row in Settings (ⓘ, Forget This Device, Forget Device; `blueutil --unpair` silently does nothing), then it shows under Nearby Devices: go to step 2.

## 2. Not paired
`blueutil --inquiry` does NOT see BLE mice, and System Events `click`/AXPress does nothing on the Nearby Devices row. What works is real HID mouse events:

1. `open "x-apple.systempreferences:com.apple.BluetoothSettings"`, then `osascript -e 'tell application "System Settings" to activate'` (the window opens behind cmux otherwise).
2. Mouse must be in pairing mode (hold the pairing button until it blinks fast) and show under Nearby Devices.
3. Run `swiftc -o /tmp/mouseclick ~/.claude/skills/mouse/click.swift && /tmp/mouseclick`. It hovers the row, then clicks the Connect button at the row's right edge.
4. Coordinates are hardcoded for the default window position (590,158). If the Settings window moved, screenshot once, find the row, edit `row`/`btn` in click.swift.
5. Verify with `blueutil --connected | grep -i incase`.

Paired once on 2026-10-13, so step 1 should cover it from now on.
