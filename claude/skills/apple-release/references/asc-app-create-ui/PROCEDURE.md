---
name: asc-app-create-ui
description: Create a new App Store Connect app record via browser automation. Use when there is no public API for app creation and you need an agent to drive the New App form.
---

# asc app create (UI automation)

Create a new App Store Connect app by driving the web UI — opt-in, local-only automation, user must be signed in.

## Preconditions
- Browser automation tool available (Playwright, Cursor browser MCP, or equivalent).
- User signed in to ASC (or can complete login + 2FA).
- Bundle ID already registered in the Apple Developer portal.
- Known: app name (max 30 chars), bundle ID (must exist, unused by another app), SKU, platform (iOS/macOS/tvOS/visionOS), primary language, user access (Full/Limited).

## Safety guardrails
Never export/store cookies. Visible browser session only. Pause for final confirmation before clicking "Create" (standalone scripts). Never retry the Create action automatically on failure.

## Workflow

**1. Preflight**
```bash
asc bundle-ids create --identifier "com.example.app" --name "My App" --platform IOS   # if not already registered
asc apps list --bundle-id "com.example.app" --output json                             # confirm no app record exists yet
```

**2.** Navigate to `https://appstoreconnect.apple.com/apps`, confirm signed in.

**3. Open New App form** — the "New App" button (blue "+") opens a dropdown menu, not a dialog directly: click it, then click the "New App" menu item inside (not "New App Bundle") to get the creation dialog.

**4. Fill required fields, in order:**
- **Platform** — checkboxes (not radio), multiple selectable: iOS, macOS, tvOS, visionOS.
- **Name** — text input, max 30 chars.
- **Primary Language** — select/combobox, match by label (e.g. `"English (U.S.)"`).
- **Bundle ID** — `<select>` that loads asynchronously after platform selection (shows "Loading..." first) — wait for it to populate, then select by label including both name and identifier: `"My App - com.example.app"`.
- **SKU** — text input.
- **User Access** (REQUIRED, Create stays disabled without it) — radio buttons `Limited Access`/`Full Access`, wrapped in styled `<span>` overlays that intercept accessibility-based clicks. Fix: `scrollIntoView` on the radio element, then click the radio ref directly.

**5. Click Create** — disabled until all fields + User Access are set. Button text becomes "Creating" while processing. Wait for navigation to `/apps/<APP_ID>/...`.

**6. Verify**
```bash
asc apps view --id "APP_ID" --output json --pretty
asc apps list --bundle-id "com.example.app" --output json
```

**7. Post-create setup**
```bash
asc app-setup info set --app "APP_ID" --primary-locale "en-US"
asc app-setup categories set --app "APP_ID" --primary GAMES
asc web apps availability create --app "APP_ID" --territory "USA,GBR" --available-in-new-territories true
```
Use the experimental `asc web` flow only for the first availability bootstrap — once availability exists, use `asc pricing availability edit --app "APP_ID" ...` for later territory changes.

## Known UI issues
- **"New App" is a dropdown**, not a direct action — must click the menu item, not just the button (menu also has "New App Bundle").
- **User Access radio spans** intercept ref clicks — scroll into view, click the radio ref directly, not via offset or label click.
- **Bundle ID dropdown loads async** — disabled and "Loading..." until platform is picked; wait for it to populate before selecting.
- **`browser_fill` may not trigger Ember.js validation.** If Create stays disabled after filling all fields, retype one text field slowly (character-by-character), or clear and retype.

## Failure handling
Can't locate a field/button → stop, request user help, screenshot, report the last known step. Never retry Create automatically. On failure, user should check the browser for validation errors (red outlines, inline messages).

## Notes
- Workaround for a missing public API — Apple's docs say "Don't use this API to create new apps; instead, create new apps on the App Store Connect website."
- UI selectors can change without notice — prefer role/label/text selectors over CSS.
- Signing in should be the only manual step; everything else is agent-drivable.
