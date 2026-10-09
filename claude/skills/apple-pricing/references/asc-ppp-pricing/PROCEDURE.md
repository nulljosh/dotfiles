---
name: asc-ppp-pricing
description: Set territory-specific pricing for subscriptions and in-app purchases using current asc setup, pricing summary, price import, and price schedule commands. Use when adjusting prices by country or implementing localized PPP strategies.
---

# PPP pricing (per-territory pricing)

Create/update localized pricing across territories based on purchasing power parity (PPP) or a regional pricing strategy.

Prefer current high-level flows: `asc subscriptions setup` / `asc iap setup` for new products; `asc subscriptions pricing ...` for subscription pricing; `asc iap pricing summary` / `asc iap pricing schedules ...` for IAP pricing.

## Preconditions
- Credentials set (`asc auth login` or `ASC_*` env vars). Prefer `ASC_APP_ID` or `--app`.
- Decide base territory (usually `USA`) and baseline price.
- `asc pricing territories list --paginate` for supported territory IDs.

## Subscription PPP workflow

**New subscription — bootstrap with `setup`** (creates group, subscription, first localization, initial price, and availability in one verified flow; verifies by default, `--no-verify` for speed over readback; use `--tier`/`--price-point-id` instead of `--price` for tier-driven work):
```bash
asc subscriptions setup --app "APP_ID" --group-reference-name "Pro" --reference-name "Pro Monthly" \
  --product-id "com.example.pro.monthly" --subscription-period ONE_MONTH --locale "en-US" \
  --display-name "Pro Monthly" --description "Unlock everything" --price "9.99" \
  --price-territory "USA" --territories "USA,CAN,GBR" --output json
```

**Inspect current pricing** — `summary` for quick before/after spot checks, `prices list` for raw records:
```bash
asc subscriptions pricing summary --subscription-id "SUB_ID" --territory "USA"
asc subscriptions pricing summary --subscription-id "SUB_ID" --territory "IND"
asc subscriptions pricing prices list --subscription-id "SUB_ID" --paginate
```

**Preferred bulk PPP update — CSV import** (safest subscription batch path). Required columns: `territory`, `price`. Optional: `currency_code`, `start_date`, `preserved`, `preserve_current_price`, `price_point_id` (omit to auto-resolve the matching price point for territory+price). Territory can be 3-letter ID, 2-letter code, or common name.

```csv
territory,price,start_date,preserved
IND,2.99,2026-04-01,false
BRA,4.99,2026-04-01,false
MEX,4.99,2026-04-01,false
DEU,8.99,2026-04-01,false
```
```bash
asc subscriptions pricing prices import --subscription-id "SUB_ID" --input "./ppp-prices.csv" --dry-run --output table
asc subscriptions pricing prices import --subscription-id "SUB_ID" --input "./ppp-prices.csv" --output table
```
`--dry-run` validates rows and resolves price points without creating prices. `--continue-on-error=false` for fail-fast.

**One-off territory changes** — canonical `set` command, handles both initial pricing and later changes. `--start-date "YYYY-MM-DD"` schedules a future change; `--preserved` preserves the current price relationship.
```bash
asc subscriptions pricing prices set --subscription-id "SUB_ID" --price "2.99" --territory "IND"
asc subscriptions pricing prices set --subscription-id "SUB_ID" --tier 5 --territory "BRA"
asc subscriptions pricing prices set --subscription-id "SUB_ID" --price-point "PRICE_POINT_ID" --territory "DEU"
```

**Raw price points** (inspect Apple's localized ladder / pin exact IDs):
```bash
asc subscriptions pricing price-points list --subscription-id "SUB_ID" --territory "USA" --paginate --price "9.99"
asc subscriptions pricing price-points equalizations --price-point-id "PRICE_POINT_ID"
```

**Verify after apply** — re-run summary and raw list:
```bash
asc subscriptions pricing summary --subscription-id "SUB_ID" --territory "IND"
asc subscriptions pricing summary --subscription-id "SUB_ID" --territory "BRA"
asc subscriptions pricing prices list --subscription-id "SUB_ID" --paginate
```
For a newly created subscription, `asc subscriptions setup` with verification enabled can replace separate create+pricing steps.

**Availability** — enable territories explicitly for an existing subscription:
```bash
asc subscriptions pricing availability edit --subscription-id "SUB_ID" --territories "USA,CAN,IND,BRA"
asc subscriptions pricing availability view --subscription-id "SUB_ID"
```

## IAP PPP workflow

**New IAP — bootstrap with `setup`** (creates product, first localization, initial price schedule; verifies by default; `--start-date` for scheduled pricing; `--tier`/`--price-point-id` for deterministic setup):
```bash
asc iap setup --app "APP_ID" --type NON_CONSUMABLE --reference-name "Pro Lifetime" \
  --product-id "com.example.pro.lifetime" --locale "en-US" --display-name "Pro Lifetime" \
  --description "Unlock everything forever" --price "9.99" --base-territory "USA" --output json
```

**Inspect current pricing** — `asc iap pricing summary` returns base territory, current price, estimated proceeds, and scheduled changes:
```bash
asc iap pricing summary --iap-id "IAP_ID" --territory "USA"
asc iap pricing summary --iap-id "IAP_ID" --territory "IND"
```

**Discover price points**:
```bash
asc iap pricing price-points list --iap-id "IAP_ID" --territory "USA" --paginate --price "9.99"
asc iap pricing price-points equalizations --id "PRICE_POINT_ID"
```

**Create/update a price schedule** (for intentional create/replace of schedule entries):
```bash
asc iap pricing schedules create --iap-id "IAP_ID" --base-territory "USA" --price "4.99" --start-date "2026-04-01"
asc iap pricing schedules create --iap-id "IAP_ID" --base-territory "USA" --tier 5 --start-date "2026-04-01"
asc iap pricing schedules create --iap-id "IAP_ID" --base-territory "USA" --prices "PRICE_POINT_ID:2026-04-01"
```
Deeper inspection:
```bash
asc iap pricing schedules view --iap-id "IAP_ID"
asc iap pricing schedules manual-prices --schedule-id "SCHEDULE_ID" --paginate
asc iap pricing schedules automatic-prices --schedule-id "SCHEDULE_ID" --paginate
```

**Verify after apply** — future-dated schedules show as scheduled changes, not an immediately updated current price:
```bash
asc iap pricing summary --iap-id "IAP_ID" --territory "USA"
asc iap pricing summary --iap-id "IAP_ID" --territory "IND"
```

## Common PPP strategy patterns
- **Base territory first**: pick one baseline (usually `USA`), set price there, derive other territories from it.
- **Tiered regional pricing**: high-income markets close to baseline, mid-income moderate discounts, lower-income stronger PPP adjustments.
- **Spreadsheet-driven rollout**: build target territory CSV → dry-run import → fix resolution failures → apply → re-run summary for key territories.

## Notes
- Prefer canonical families: `asc subscriptions pricing ...`, `asc iap pricing ...`. Older `asc subscriptions prices ...` paths still exist but are less clear.
- `asc subscriptions pricing prices import --dry-run` is the safest subscription batch PPP path.
- `setup` commands include built-in post-create verification.
- No single before/after PPP diff command yet — use summary before and after apply.
- Price changes may take time to propagate to App Store Connect and storefronts.
