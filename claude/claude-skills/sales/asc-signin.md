# Signing in to App Store Connect (shared by /sales, /money, /distribution)

Private values (Apple ID, vendor number) live in `~/.config/asc.env`, never in this repo:
```
ASC_WEB_APPLE_ID=...        # the Apple ID that owns the developer account
ASC_VENDOR_NUMBER=...       # 8 digits, top left of Payments and Financial Reports
```
`set -a; . ~/.config/asc.env; set +a` before any asc call. If the file is missing, create it as soon as you learn the values.

Stop at the first rung that works:

1. **API key (never expires).** `asc auth status` → non-empty `credentials` = use it. Sales needs the key's role to include **Sales** (or Admin/Finance); a 403 on `asc analytics sales` means the role is missing, not that sales are zero.
2. **Web session.** `asc web auth status`. If `authenticated:false`, Joshua types `! asc web auth login --apple-id "$ASC_WEB_APPLE_ID"` (password + 6-digit code are his; on Joshua's Mac `! asc-login` does it). Sessions die in hours, so batch every web step into one login.
3. **Mint a lasting key (ask first, once).** While a web session is live: `asc web api-keys create --name "claude-money" ` with Admin or Finance+Sales access, save the `.p8` to `~/.asc/keys/` (chmod 600), then `asc auth login --name claude-money --key-id … --issuer-id … --private-key ~/.asc/keys/AuthKey_….p8`. After this, rung 1 always works.
4. **Safari fallback.** Load `mcp__safari__*` tools in one ToolSearch call, `tabs_create` your own tab (never drive Joshua's active tab), open the page below, and if it shows a sign-in, Joshua signs in. Never type passwords. Read with `get_page_text`.
   - Sales and Trends: https://appstoreconnect.apple.com/trends/insights
   - Payments: https://appstoreconnect.apple.com/itc/payments_and_financial_reports
   - Agreements, tax, banking: https://appstoreconnect.apple.com/business
   - Apps: https://appstoreconnect.apple.com/apps

The app list with ASC IDs, prices and rules is the GTM ledger: `~/Documents/Code/GTM.md` on Joshua's Mac Mini, `~/Documents/Josh/Code/labs/GTM.md` on Dad's Mac. `asc apps list --paginate --output json` is the live truth when they differ.
