# Signing in to App Store Connect (shared by /sales, /money, /distribution)

Private values (Apple ID, vendor number) live in `~/.config/asc.env`, never in this repo:
```
ASC_WEB_APPLE_ID=...        # the Apple ID that owns the developer account
ASC_VENDOR_NUMBER=...       # 8 digits, shown on the Business page
ASC_EXTRA_APP_IDS=...       # id:Name,id:Name for apps missing from GTM.md
```
`set -a; . ~/.config/asc.env; set +a` before any asc call. If the file is missing, create it as soon as you learn the values.

Stop at the first rung that works. Close any Safari tab you opened when done.

1. **API key (never expires).** `asc auth status` → non-empty `credentials` = use it. Sales needs the key's role to include **Sales** (or Admin/Finance); a 403 on `asc analytics sales` means the role is missing, not that sales are zero.
2. **Web session (the default on Dad's Mac).** `asc web auth status`. The password is saved in Keychain, so other `asc web` commands re-sign in on their own; only a 2FA code ever needs Joshua. If a fresh login is needed, the `!` prompt has no TTY and fails, so open Terminal for him:
   `osascript -e 'tell application "Terminal" to do script "asc web auth login --apple-id <id from asc.env>"' -e 'tell application "Terminal" to activate'`
   then wait for "done". On Joshua's Mac `asc-login` does the same. Sessions last hours; batch web steps.
3. **API keys that exist** (`asc web api-keys list`): `asc-sales` (FINANCE, .p8 on Joshua's Mac), `asc-cli` / `helm` / `fastlane` (APP_MANAGER). Dad's Mac has none. Creating one here was blocked by the auto-mode classifier on 2026-11-24, so ask Joshua before trying again.
4. **Mint a lasting key (Joshua's yes first).** While a web session is live: `asc web api-keys create --name "claude-money" ` with Admin or Finance+Sales access, save the `.p8` to `~/.asc/keys/` (chmod 600), then `asc auth login --name claude-money --key-id … --issuer-id … --private-key ~/.asc/keys/AuthKey_….p8`. After this, rung 1 always works.
5. **Safari fallback (last resort; Joshua uses Safari, so stay headless when you can).** Load `mcp__safari__*` tools in one ToolSearch call, `tabs_create` your own tab (never drive Joshua's active tab), open the page below, and if it shows a sign-in, Joshua signs in. Never type passwords. Read with `get_page_text`.
   - Sales and Trends: https://appstoreconnect.apple.com/trends/insights
   - Payments: https://appstoreconnect.apple.com/itc/payments_and_financial_reports
   - Agreements, tax, banking: https://appstoreconnect.apple.com/business
   - Apps: https://appstoreconnect.apple.com/apps

The app list with ASC IDs, prices and rules is the GTM ledger: `~/Documents/Code/GTM.md` on Joshua's Mac Mini, `~/Documents/Josh/Code/labs/GTM.md` on Dad's Mac. `asc apps list --paginate --output json` is the live truth when they differ.
