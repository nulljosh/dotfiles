---
name: buy-domain
description: Buy a domain on Cloudflare Registrar (at-cost, no markup). Use for /buy-domain <name.tld>, "register a domain", "buy jaybulb.com".
---

# buy-domain

`/buy-domain <name.tld>`

Cloudflare Registrar sells at wholesale (.com about $10.50/yr, same on renewal). Prefer it over Namecheap.

## Steps

1. **Availability**: `whois <domain>` ("No match" = free). Also try `.com` first, then alternates.
2. **Price**: tell Joshua the price. Spend needs his yes unless he already named domain and price in the request.
3. **Buy via API** (needs a Registrar-scoped token; the wrangler OAuth token and `CLOUDFLARE_DNS_TOKEN` both lack it):
   - Token lives in macOS Keychain item `cloudflare-registrar` (`security find-generic-password -s cloudflare-registrar -w`). Never export it into the shell env (see reference_cloudflare_access).
   - Account id: `~/.wrangler/cache/wrangler-account.json` -> `.account.id`
   - Check: `POST /accounts/$A/registrar/domain-check {"domains":["x.com"]}`
   - Register: `POST /accounts/$A/registrar/registrations {"domain_name":"x.com"}` (see https://developers.cloudflare.com/api/resources/registrar/)
4. **No token yet**: open `https://dash.cloudflare.com/?to=/:account/domains/register/<domain>` (needs a card on file and the registrant contact filled once). Joshua clicks Buy. Then mint a Registrar token for next time: dash -> My Profile -> API Tokens -> Create -> Account / Registrar Domains: Edit -> save to Keychain.
5. **After purchase**: confirm the zone exists (`npx --no-install wrangler` can't list; use the DNS token on `/zones?name=<domain>`), then record it in memory and the migration roadmap.

## Verified 2026-10-11 (jaybulb.com, $10.46)
Dashboard path works end to end: Domains > Registrations > search > checkout. Form needs name, phone (+1 picker), country, street, city, postal, province. Apple Pay opens on the payment page (Joshua authorizes with Touch ID), then: tick BOTH checkboxes (ToS, charge + autorenew), set billing State, click Register, accept the suggested postal address. Success URL: /domains/registrations/success. Pre-2026-11-01 .com is $10.46, then $11.17.
