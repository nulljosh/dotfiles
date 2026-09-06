#!/bin/bash
# Fails if a data-provider button names a provider whose OAuth flow doesn't actually work.
#
# Probes /auth/v1/authorize and asserts a 302 (Supabase will hand the user to the
# provider). Do NOT check /auth/v1/settings instead: its "provider": true only means
# the toggle is on, which for Apple is true for NATIVE sign-in while the web flow
# still 400s for want of a Services ID + secret. That false pass shipped broken
# Apple buttons to three apps on 2026-08-24.
FILES=(
  ~/Documents/Code/litigate/web/index.html
  ~/Documents/Code/bookrank/library.html
  ~/Documents/Code/lexly/app/index.html
  ~/Documents/Code/homeward/app/login/page.tsx
)
rc=0
for p in $(grep -rho "data-provider=[\"'][a-z]*[\"']" "${FILES[@]}" 2>/dev/null | sed "s/.*[\"']\([a-z]*\)[\"']/\1/" | sort -u); do
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    "$SPARK_SUPABASE_URL/auth/v1/authorize?provider=$p&redirect_to=https://example.com" \
    -H "apikey: $SPARK_SUPABASE_ANON_KEY")
  if [ "$code" = "302" ]; then echo "ok   $p"; else echo "FAIL $p (HTTP $code, button would break)"; rc=1; fi
done
exit $rc
