---
name: asc-apple-ads
description: Use when managing Apple Ads with asc, including auth, org lookup, campaigns, ad groups, ads, keywords, reports, raw API calls, and safe live testing.
---

# asc Apple Ads

For any Apple Ads / `asc ads` task.

## Ground rules
- Run `asc ads --help` or the subgroup help before scripting a command.
- Apple Ads auth is separate from ASC auth — `asc auth login` doesn't configure `asc ads`.
- `--output json` for automation.
- Most commands need an org ID — `--org` for one-offs, `ASC_ADS_ORG_ID` for a scoped session.
- Never guess payload fields — put Apple Ads request JSON in a file, pass with `--file`.
- Don't mutate a live account until the user names the org and approves the resource type. Read-only checks first.

## Auth
```bash
# stored profile
asc ads auth login --name "Marketing" --client-id "$ASC_ADS_CLIENT_ID" --team-id "$ASC_ADS_TEAM_ID" \
  --key-id "$ASC_ADS_KEY_ID" --private-key "$ASC_ADS_PRIVATE_KEY_PATH" --org "$ASC_ADS_ORG_ID" --network

# environment auth
export ASC_ADS_CLIENT_ID="SEARCHADS_CLIENT_ID"
export ASC_ADS_TEAM_ID="SEARCHADS_TEAM_ID"
export ASC_ADS_KEY_ID="KEY_ID"
export ASC_ADS_PRIVATE_KEY_PATH="$HOME/.asc/apple-ads-private-key.pem"
export ASC_ADS_ORG_ID="123456"

# short-lived token auth
export ASC_ADS_ACCESS_TOKEN="ACCESS_TOKEN"
export ASC_ADS_ORG_ID="123456"
```
Checks: `asc ads auth status --validate --output json`, `asc ads auth doctor --output json`, `asc ads me view --output json`, `asc ads acls --output json`.

## Org resolution
Unknown org ID → `asc ads acls --output json`, then use the returned ID: `asc ads campaigns --org "123456" --limit 10 --output json`.
Precedence: `--org` → `ASC_ADS_ORG_ID` → stored profile `org_id` → config `ads.org_id`.

## Read workflows
```bash
asc ads campaigns --org "123456" --limit 100 --output json
asc ads campaigns --org "123456" --paginate --output json
asc ads campaigns view --org "123456" --campaign 987654321 --output json
asc ads ad-groups list --org "123456" --campaign 987654321 --output json

asc ads apps search --org "123456" --query "My App" --limit 10 --output json
asc ads product-pages list --org "123456" --adam-id 1234567890 --states VISIBLE --output json
asc ads creatives list --org "123456" --limit 100 --output json
asc ads geo search --org "123456" --query "San Francisco" --country-code US --limit 10 --output json

asc ads reports campaigns --org "123456" --file reporting-request.json --output json
asc ads reports keywords --org "123456" --campaign 987654321 --file reporting-request.json --output json
```
Reporting and find endpoints keep pagination in the JSON body.

## Mutating workflows
```bash
asc ads campaigns create --org "123456" --file campaign.json --output json
asc ads campaigns update --org "123456" --campaign 987654321 --file campaign-update.json --output json
asc ads ad-groups create --org "123456" --campaign 987654321 --file ad-group.json --output json

# bulk endpoints often need arrays
asc ads targeting-keywords create-bulk --org "123456" --campaign 987654321 --ad-group 123456789 --file keywords.json --output json
```
Delete requires `--confirm`:
```bash
asc ads targeting-keywords delete-bulk --org "123456" --campaign 987654321 --ad-group 123456789 --file keyword-ids.json --confirm --output json
asc ads campaigns delete --org "123456" --campaign 987654321 --confirm
```
For live tests, create paused resources named `ASC CLI Live Test <timestamp>`; clean up only the parent campaign/ad group created for that test. Apple may reject direct deletion of default product page creative ads — deleting the test parent campaign/ad group still cleans it up.

## Raw API
Use when Apple adds a field before the first-class command surface catches up:
```bash
asc ads api request --method POST --path v5/campaigns/find --org "123456" --file selector.json --output json
```
Accepts only Apple Ads v5 paths or `https://api.searchads.apple.com/api/v5/...` URLs. `DELETE` still needs `--confirm`.

## Live test checklist
Start with `asc ads me view` and `asc ads acls` → print target org ID before mutating → create paused/future-dated resources with a unique test name → save created IDs from JSON output → delete only the test parent campaign/ad group → run a final campaigns find/list to confirm cleanup.
