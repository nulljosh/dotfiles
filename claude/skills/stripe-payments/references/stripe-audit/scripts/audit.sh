#!/bin/bash
# Read-only Stripe health check. Never writes. Key: $STRIPE_API_KEY, else epiphany/.env.tui.local.
K=${STRIPE_API_KEY:-$(grep -hoE "sk_live_[A-Za-z0-9]+" ~/Documents/Code/epiphany/.env.tui.local | head -1)}
[ -z "$K" ] && { echo "no Stripe key"; exit 1; }
get() { curl -s -u "$K:" "https://api.stripe.com/v1/$1"; }
py() { python3 -c "import sys,json;d=json.load(sys.stdin);$1"; }
echo "== real money"; get "charges?limit=5" | py "print('charges', len(d['data']), [(x['amount'],x['status']) for x in d['data']])"
echo "== checkouts"; get "checkout/sessions?limit=10" | py "[print(x['status'],x['payment_status'],x['amount_total'],x['success_url'].split('?')[0]) for x in d['data']]"
echo "== products"; get "prices?active=true&limit=50" | py "[print(x['unit_amount'],x['currency'],x['product']) for x in d['data']]"
echo "== webhooks (000 = dead host)"; get webhook_endpoints | py "[print(x['url'],x['status'],x['enabled_events']) for x in d['data']]" 2>/dev/null
get webhook_endpoints | python3 -c "import sys,json;[print(x['url']) for x in json.load(sys.stdin)['data']]" | while read u; do printf "%s %s\n" "$(curl -s -o /dev/null -m 8 -w '%{http_code}' -X POST "$u")" "$u"; done
echo "== undelivered checkout events (pending_webhooks > 0)"; get "events?type=checkout.session.completed&limit=10" | py "[print(x['id'],x['created'],'pending',x['pending_webhooks']) for x in d['data'] if x['pending_webhooks']]"
echo "== promo-code box on each checkout"
for f in $(grep -rl --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.wrangler -E "checkout/sessions|checkout\.sessions" ~/Documents/Code/*/{api,server,functions,src} 2>/dev/null); do echo "$(grep -c allow_promotion_codes "$f") ${f#$HOME/Documents/Code/}"; done
