---
name: apple-signin-fix
description: Fix or set up Sign in with Apple for an app on the shared spark Supabase project, native (iOS/macOS) and web. Use when Apple sign-in fails, says "authorize with another app", shows the wrong app name or icon (e.g. "sign in to Healstack"), or a new app needs Apple sign-in. Covers the Supabase client ID list, the App ID capability, the entitlement, and the web Services ID's primary app.
---

# Sign in with Apple, end to end

Every app on the spark Supabase project (`tjsxsqlxjmanwvmywwvw`) shares one Apple setup. Most "Apple sign-in is broken" reports are one of four layers below. Check them in order, cheapest first, and verify each with a real probe, not by reading config.

## 1. Which surface is it?

Ask or reproduce first. Native and web are different systems.

- **Web**: reproduce headless. Click the site's Apple button with Playwright and read Apple's page text: `Use your Apple Account to sign in to '<Name>'`. The name and icon come from the Services ID's **primary App ID** (layer 4), not from the site.
- **Native**: the app shows Apple's system sheet. Failures are usually layers 1-3.

## 2. Native layers

1. **Supabase client ID list.** The app's bundle ID must be in `external_apple_client_id` (comma-separated). Read it:
   `T=$(security find-generic-password -s "Supabase CLI" -w); curl -s -H "Authorization: Bearer $T" https://api.supabase.com/v1/projects/tjsxsqlxjmanwvmywwvw/config/auth | jq -r .external_apple_client_id`
   To add one, PATCH the whole list back with the new ID appended, never replace it. This is shared config, so it needs Joshua's approval in auto mode; he can approve it in chat. Native needs no client secret.
2. **App ID capability.** `asc bundle-ids list --paginate` to find the bundle's resource ID, then `asc bundle-ids capabilities list --bundle <ID>`. If `APPLE_ID_AUTH` is missing:
   `asc bundle-ids capabilities add --bundle <ID> --capability APPLE_ID_AUTH --settings '[{"key":"APPLE_ID_AUTH_APP_CONSENT","options":[{"key":"PRIMARY_APP_CONSENT","enabled":true}]}]'`
3. **Entitlement in the signed build.** Both `*.entitlements` files need `com.apple.developer.applesignin` = `[Default]`. Verify the archive, not the source: `codesign -d --entitlements :- <archive>/Products/Applications/<App>.app`. Automatic signing with `-allowProvisioningUpdates` regenerates the profile.
4. **Code.** `ASAuthorizationAppleIDRequest` with a SHA-256 hashed nonce, then `supabase.auth.signInWithIdToken(credentials: .init(provider: .apple, idToken:, nonce:))` with the raw nonce. A canceled sheet is not an error.

## 3. Web layer: the Services ID

The web flow uses one Services ID for every app: `com.heyitsmejosh.websignin` ("Web Sign In"), with the Supabase domain and the `.../auth/v1/callback` return URL. Supabase supports only one web Apple client per project, so every app's web sign-in shows the same name and icon: whichever App ID is **primary**.

To change what Apple shows (the portal is the only way; the `asc` CLI cannot reach Services ID web configuration):

1. Open developer.apple.com, Identifiers, Services IDs, Web Sign In, Sign In with Apple, **Configure**. Joshua signs in himself; never type his Apple ID password or 2FA code.
2. Pick the **Primary App ID**. Changing it **detaches the website URLs** in the dialog: open the URL picker and select both the domain and the return URL again until each shows a Remove button.
3. Click Done, then Continue. **Do not Save until the review page reads `<primary> (2 Website URLs)`.** Zero URLs there breaks web Apple sign-in for every app.
4. Save, wait a moment, then re-run the headless probe and confirm Apple's page now says the new name and still loads, which proves the redirect URI is still accepted.

Tell Joshua that every other app's web Apple sign-in now shows that name too.

## Don'ts

- Don't hide the web Apple button as a "fix". Joshua rejected that on 2026-10-02.
- Don't claim a revert or deploy happened without checking `git log` and the live page. A silent failed `git revert -q` once left the button hidden.
- Don't PATCH Supabase auth config without diffing first; other apps share it.

## Lessons added 2026-10-03 (Lexly iOS rejected 2.1(a), Healstack iOS rejected 4.8)
- **The archive is the test.** Lexly's re-archive failed with "Provisioning profile ... doesn't include the Sign In with Apple capability". Archive with `asc xcode archive ... --xcodebuild-flag=-allowProvisioningUpdates` so Xcode regenerates the profile, then check the **signed archive and the unzipped IPA**: `codesign -d --entitlements - APP` must show `com.apple.developer.applesignin` and `get-task-allow` false for the IPA. Use shell globs for the app path, not `ls -d` output (icons corrupt it).
- **Handler bug that looks like a Sign in with Apple failure.** `signInWithApple(result:)` calls `try result.get()`, which throws when the user dismisses the sheet (`ASAuthorizationError.canceled`, 1001) or when no Apple ID is signed in (1000, typical of a review device). Showing `error.localizedDescription` puts Apple's raw error on screen. Catch `.canceled` silently and show a friendly "use email or Google instead" for other `ASAuthorizationError`s.
- **4.8 is triggered by offering any third-party login (Google) on iOS without an equivalent.** Healstack iOS had Google and a gated-off Sign in with Apple. Either remove Google or turn Sign in with Apple on. Probe the shared project first: `GET /auth/v1/settings` must show `"apple": true`, the bundle ID must be in `external_apple_client_id`, and the App ID needs `APPLE_ID_AUTH` (`asc bundle-ids capabilities list`). Also rewrite review notes that say Sign in with Apple is "intentionally not offered".
- **xcodegen can silently revert pbxproj fixes** (manual signing, iPhone-only). Keep such settings in `project.yml`. Lexly's 6bd67c3 fix lived only in the pbxproj and was lost.
