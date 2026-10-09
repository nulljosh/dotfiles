---
name: asc-subscription-localization
description: Bulk-localize subscription and in-app purchase display names across all App Store locales using asc. Use when you want to fill in subscription/IAP names for every language without clicking through App Store Connect manually.
---

# asc subscription localization

Bulk-create/update display names (and descriptions) for subscriptions, subscription groups, and IAPs across all App Store Connect locales — no manual per-language clicking.

## Preconditions
- Auth configured (`asc auth login` or `ASC_*` env vars).
- App ID known (`ASC_APP_ID` or `--app`).
- Subscription groups and subscriptions already exist.

## Supported locales
```
ar-SA, ca, cs, da, de-DE, el, en-AU, en-CA, en-GB, en-US,
es-ES, es-MX, fi, fr-CA, fr-FR, he, hi, hr, hu, id, it,
ja, ko, ms, nl-NL, no, pl, pt-BR, pt-PT, ro, ru, sk,
sv, th, tr, uk, vi, zh-Hans, zh-Hant
```

## Workflow: bulk-localize a subscription

```bash
asc subscriptions groups list --app "APP_ID" --output table          # 1. resolve IDs
asc subscriptions list --group-id "GROUP_ID" --output table

asc subscriptions localizations list --subscription-id "SUB_ID" --paginate --output table   # 2. check existing — only create missing locales

# 3. create for each missing locale, e.g. "Monthly Pro" everywhere:
for LOCALE in ar-SA ca cs da de-DE el en-AU en-CA en-GB en-US es-ES es-MX fi fr-CA fr-FR he hi hr hu id it ja ko ms nl-NL no pl pt-BR pt-PT ro ru sk sv th tr uk vi zh-Hans zh-Hant; do
  asc subscriptions localizations create --subscription-id "SUB_ID" --locale "$LOCALE" --name "Monthly Pro"
done

asc subscriptions localizations list --subscription-id "SUB_ID" --paginate --output table   # 4. verify
```

## Workflow: bulk-localize a subscription group

Groups have their own display name per locale (the "group name" shown in the subscription management sheet).

```bash
asc subscriptions groups localizations list --group-id "GROUP_ID" --paginate --output table   # check existing

asc subscriptions groups localizations create --group-id "GROUP_ID" --locale "LOCALE" --name "Group Display Name"

# optional custom app name for the group:
asc subscriptions groups localizations create --group-id "GROUP_ID" --locale "LOCALE" \
  --name "Group Display Name" --custom-app-name "My App"

asc subscriptions groups localizations list --group-id "GROUP_ID" --paginate --output table   # verify
```

## Workflow: bulk-localize an in-app purchase

Same pattern, IAP-specific commands.

```bash
asc iap list --app "APP_ID" --output table                                    # resolve IAP ID
asc iap localizations list --iap-id "IAP_ID" --paginate --output table        # check existing

asc iap localizations create --iap-id "IAP_ID" --locale "LOCALE" --name "Display Name"
# optional description:
asc iap localizations create --iap-id "IAP_ID" --locale "LOCALE" \
  --name "Unlock All Features" --description "One-time purchase to unlock all premium features"

asc iap localizations list --iap-id "IAP_ID" --paginate --output table        # verify
```

## Updating existing localizations
```bash
asc subscriptions localizations update --id "LOC_ID" --name "New Name"
asc subscriptions groups localizations update --id "LOC_ID" --name "New Group Name"
asc iap localizations update --localization-id "LOC_ID" --name "New Name"
```
To bulk-update: list existing localizations first, extract IDs, then update each one.

## Bulk-localize all subscriptions in an app
```bash
asc subscriptions groups list --app "APP_ID" --paginate       # 1. list all groups
# 2. localize each group (group workflow above)
asc subscriptions list --group-id "GROUP_ID" --paginate       # 3. list subscriptions per group
# 4. localize each subscription (subscription workflow above)
```

## Agent behavior
- List existing localizations first — creating a localization for a locale that already exists fails.
- Skip locales that already have one; only create missing.
- Single display name from the user → use it everywhere; per-locale translated names → use those.
- Pass `--description` only when one is provided.
- `--output table` for verification, JSON (default) for intermediate automation steps.
- After bulk creation, always re-run list to verify completeness.
- Many subscriptions: process sequentially per group to keep output readable.
- On a failed create, log locale + error, continue the batch, report all failures together at the end.

## Notes
- Display names are what users see on the subscription management sheet and in purchase dialogs.
- No bulk API — each locale needs a separate create call.
- Always use `--paginate` on list commands.
- Only have app names, not IDs? Use `asc-id-resolver`.
