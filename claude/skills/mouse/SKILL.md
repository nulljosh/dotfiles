---
name: mouse
description: Reconnect or re-pair Joshua's Bluetooth mouse (Incase Ergonomic Mouse) when he has no other pointer. Use when the user says /mouse, "connect my mouse", "mouse won't click", or the mouse is disconnected.
---

# Mouse

Joshua has no USB mouse and the keyboard (NuPhy Air96) is the only working input, so never ask him to click anything. Do it all from the shell, fast, no screenshot loops.

Mouse: "Incase Ergonomic Mouse", address `dd-93-ad-cc-ca-29` (re-paired 2026-11-22, stale entries forgotten). It takes a new address on every re-pair, so `blueutil --paired | grep -i incase` first. Fastest fix: `open /Applications/Tether.app` (repo ~/Documents/Code/tether), which tries every paired mouse address at once and reconnects on drops. Never call `blueutil --connect` on several addresses in sequence: each dead one blocks ~15s.

## 1. Already paired (normal case)
```
blueutil --power 1
blueutil --connect dd-93-ad-cc-ca-29
sleep 4; blueutil --connected | grep -i incase
```
If it connects, done. If not, have him toggle the mouse switch off/on, retry once. Still failing: the mouse changes address on re-pair, so the saved entries go stale. Forget every Incase row in Settings (ⓘ, Forget This Device, Forget Device; `blueutil --unpair` silently does nothing), then it shows under Nearby Devices: go to step 2.

## 2. Not paired
`blueutil --inquiry` does NOT see BLE mice, and System Events `click`/AXPress does nothing on the Nearby Devices row. What works is real HID mouse events:

1. `open "x-apple.systempreferences:com.apple.BluetoothSettings"`, then `osascript -e 'tell application "System Settings" to activate'` (the window opens behind cmux otherwise).
2. Mouse must be in pairing mode (hold the pairing button until it blinks fast) and show under Nearby Devices.
3. Run `swiftc -o /tmp/mouseclick ~/.claude/skills/mouse/click.swift && /tmp/mouseclick`. It hovers the row, then clicks the Connect button at the row's right edge.
4. Coordinates are hardcoded for the default window position (590,158). If the Settings window moved, screenshot once, find the row, edit `row`/`btn` in click.swift. If cmux covers Settings, move Settings to x=1180 with System Events (`set position of window 1 to {1180, 30}`); the Nearby row is then about (1600, row y) and its Connect button about x=1860.
6. After pairing, forget the stale "Not Connected" Incase rows: ⓘ at the row's right edge, Forget This Device, Forget Device (real HID clicks, same as above).
5. Verify with `blueutil --connected | grep -i incase`.

Paired once on 2026-10-13, so step 1 should cover it from now on.
