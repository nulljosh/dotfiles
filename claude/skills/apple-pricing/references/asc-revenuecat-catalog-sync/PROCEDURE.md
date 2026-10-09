---
name: asc-revenuecat-catalog-sync
description: Reconcile App Store Connect subscriptions and in-app purchases with RevenueCat products, entitlements, offerings, and packages using asc and RevenueCat MCP. Use when setting up or syncing subscription catalogs across ASC and RevenueCat.
---

# asc RevenueCat catalog sync

Keep App Store Connect (ASC) and RevenueCat aligned: create missing ASC items and map them into RevenueCat.

## When to use
Bootstrap RevenueCat from an existing ASC catalog; create missing ASC subscriptions/IAPs then map into RevenueCat; drift audit before release; deterministic product mapping by identifier.

## Preconditions
- `asc` auth configured (`asc auth login` or `ASC_*` env vars).
- RevenueCat MCP configured and authenticated (OAuth in Cursor/VS Code, or API key).
- Known: ASC `APP_ID`, RevenueCat `project_id`, target RC app type (`app_store`/`mac_app_store`) and bundle ID for create flows.
- Write-enabled RevenueCat API v2 key for applying changes.

## Safety defaults
Start in audit mode (read-only). Require explicit confirmation before writes. Never delete resources in this workflow. Continue past per-item failures, report all at the end.

## Canonical identifiers
Cross-system key: ASC `productId` == RevenueCat `store_identifier`. Keep `productId` stable once live. Never use display names as unique identifiers.

## Scope boundary
RevenueCat MCP configures RevenueCat resources only — it doesn't create ASC products. Use `asc` to create missing ASC groups/subscriptions/IAPs first, then map into RevenueCat.

## Modes

**1) Audit (default)**: read ASC catalog → read RevenueCat catalog → diff (missing in ASC, missing in RevenueCat, mapping conflicts) → present plan, wait for confirmation.

**2) Apply (explicit)**, in order: ensure ASC groups/subscriptions/IAP exist → ensure RC app/products exist → ensure entitlements + product attachments → ensure offerings/packages + package attachments → verify and print final reconciliation summary.

## Step-by-step

**A. Read ASC catalog**
```bash
asc subscriptions groups list --app "APP_ID" --paginate --output json
asc iap list --app "APP_ID" --paginate --output json
asc subscriptions list --group-id "GROUP_ID" --paginate --output json   # per group
```

**B. Read RevenueCat catalog (MCP)**, with `project_id` and pagination: `mcp_RC_get_project`, `mcp_RC_list_apps`, `mcp_RC_list_products`, `mcp_RC_list_entitlements`, `mcp_RC_list_offerings`, `mcp_RC_list_packages`.

**C. Build mapping plan.** Product type mapping: ASC subscription → RC `subscription`; IAP `CONSUMABLE` → `consumable`; `NON_CONSUMABLE` → `non_consumable`; `NON_RENEWING_SUBSCRIPTION` → `non_renewing_subscription`. Entitlement policy: one per subscription group (or explicit user-provided map) for subscriptions; one per product for non-consumable IAP; none by default for consumable IAP unless asked.

**D. Ensure missing ASC items** (if requested) — create first, then re-read ASC to capture canonical IDs:
```bash
asc subscriptions groups create --app "APP_ID" --reference-name "Premium"
asc subscriptions create --group-id "GROUP_ID" --reference-name "Monthly" --product-id "com.example.premium.monthly" --subscription-period ONE_MONTH
asc iap create --app "APP_ID" --type NON_CONSUMABLE --ref-name "Lifetime" --product-id "com.example.lifetime"
```

**E. Ensure RC app and products** — `mcp_RC_create_app` if missing; `mcp_RC_create_product` with `store_identifier` = ASC `productId`, `app_id` = RC app ID, `type` from the mapping above.

**F. Ensure entitlements and attachments** — `mcp_RC_list_entitlements`/`mcp_RC_create_entitlement`, `mcp_RC_attach_products_to_entitlement`, verify with `mcp_RC_get_products_from_entitlement`.

**G. Ensure offerings and packages (optional)** — `mcp_RC_list_offerings`/`mcp_RC_create_offering`/`mcp_RC_update_offering` (`is_current=true` only if requested); `mcp_RC_list_packages`/`mcp_RC_create_package`; `mcp_RC_attach_products_to_package` with `eligibility_criteria: "all"`.

Recommended package keys: `ONE_WEEK`→`$rc_weekly`, `ONE_MONTH`→`$rc_monthly`, `TWO_MONTHS`→`$rc_two_month`, `THREE_MONTHS`→`$rc_three_month`, `SIX_MONTHS`→`$rc_six_month`, `ONE_YEAR`→`$rc_annual`, lifetime IAP→`$rc_lifetime`, custom→`$rc_custom_<name>`.

## Expected output format
Final summary with ASC created counts (groups/subscriptions/IAP), RC created counts (apps/products/entitlements/offerings/packages), attachment counts (entitlement-products, package-products), skipped existing items, failed items with actionable errors.

```text
ASC: created groups=1 subscriptions=2 iap=1, skipped=14, failed=0
RC: created apps=0 products=3 entitlements=2 offerings=1 packages=2, skipped=27, failed=1
Attachments: entitlement_products=3 package_products=2
Failures:
- com.example.premium.annual: duplicate store_identifier exists on another RC app
```

## Agent behavior
- Always audit first, even in apply mode. Confirm before create/update.
- Match by `store_identifier` first. Full pagination (`--paginate` for ASC, `starting_after` for RC).
- Continue past per-item failures, report all together. Never auto-delete resources.

## Common pitfalls
Wrong RC `project_id`/app ID; creating RC products under the wrong platform app; assigning consumables to entitlements by accident; skipping the post-create ASC re-read; missing offering/package verification after product creation.

## Additional resources
Workflow examples: [examples.md](examples.md) · Source references: [references.md](references.md)
