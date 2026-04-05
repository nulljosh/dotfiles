# scaffold

Project template extracted from Tally. Express API + PWA + iOS/macOS companions on Vercel.

## What's included

```
api/
  server.js          Express skeleton: auth, session, CSRF, security headers, blob helpers
  auth-cookie.js     AES-256-GCM encrypted auth cookies (serverless-safe)
  cors-utils.js      CORS origin parsing + validation
  session-store.js   Upstash Redis session store (optional, falls back to MemoryStore)
web/
  login.html         Login page: session check redirect, Remember Me, theme toggle
  sw.js              Service worker: cache-first static, network-first API, offline fallback
  design-tokens.css  Light/dark CSS tokens, spacing scale, spring transitions
  manifest.json      PWA manifest template
ios/
  API/APIClient.swift    URLSession client with cookie persistence, typed generics
  KeychainHelper.swift   Keychain credential storage
  Models/AppState.swift  @Observable state: session check bootstrap, biometric login, offline
  ContentView.swift      Tab shell with login/authenticated split
macos/
  API/MacAPIClient.swift     Simplified macOS API client
  Models/MacAppState.swift   Observable state with widget sync
vercel.json          Serverless deployment config
package.json         Express + dependencies
```

## Usage

1. Copy the files you need into your new project
2. Search and replace these placeholders:
   - `yourapp.heyitsmejosh.com` -- your app's domain (in Swift files)
   - `com.heyitsmejosh.app` -- your iOS service identifier (KeychainHelper)
   - `group.com.jt.app` -- your app group (MacAppState)
   - `App` -- your app name (login.html, manifest.json, ContentView)
   - `app-cache/` -- your blob prefix (server.js)
   - `app:sess:` -- your session prefix (session-store.js)
   - `app-salt` -- your encryption salt suffix (server.js)
   - `app-static-v1` / `app-api-v1` -- your cache names (sw.js)
3. Implement `validateCredentials()` in server.js with your auth logic
4. Add your app routes after the auth routes in server.js
5. Set environment variables on Vercel:
   - `SESSION_SECRET` -- required in production (random 64-char hex)
   - `CORS_ORIGINS` -- comma-separated allowed origins
   - `BLOB_READ_WRITE_TOKEN` -- auto-set if using Vercel Blob integration

## Architecture

- **Auth**: Encrypted cookies survive serverless cold starts. Session middleware rehydrates from cookie on each request. User-Agent fingerprinting detects token theft. CSRF check with Referer fallback for native apps.
- **PWA**: Service worker caches static assets (cache-first) and API responses (network-first with offline fallback). design-tokens.css provides light/dark theme with system preference detection.
- **iOS/macOS**: `bootstrap()` tries a fast `/api/session-check` before full login. Credentials stored in Keychain with biometric unlock. Offline mode via NWPathMonitor.
- **Blob**: `loadUserBlob(userId, key, fallback)` / `saveUserBlob(userId, key, data)` for per-user JSON persistence on Vercel Blob. HMAC-prefixed paths prevent enumeration.

## Design system

- Monochrome palette, system font stack, no external fonts
- 640px max-width, single-column, mobile-first
- Theme toggle: `[data-theme="dark"]` + View Transitions API
- Spring hover: `cubic-bezier(0.34, 1.56, 0.64, 1)`
- No gradients, no shadows, no emojis
