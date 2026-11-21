---
name: craigslist-post
description: Post a new listing to Craigslist, Facebook Marketplace, or Kijiji by driving the real posting form in Chrome. Use when the user wants to sell/post an item, or invokes /craigslist-post, /marketplace-post, or /kijiji-post.
---

Neither Craigslist nor Facebook Marketplace has a posting API (Curbfind only
reads/searches Craigslist). The only way in is the real form in the user's
own logged-in Chrome session — see the Craigslist section or the Facebook
Marketplace section below depending which the user wants (ask if unclear;
default to Craigslist if they just say "post this").

Shared prep for either platform:
- HEIC photos (default on iPhone) don't reliably upload to either site's
  posting form — convert first: `sips -s format jpeg in.heic --out out.jpg`.
- Get missing details from the user before starting: item, price, city/area,
  category, description, condition, make/model if relevant, photos (local
  file paths or none).
- Never click the final publish/submit yourself unless the user has
  explicitly said to (e.g. "hit publish") in this conversation — draft it,
  screenshot the result, and ask. Craigslist additionally gates on a captcha
  + email-confirmation click that only the user can complete even after
  "publish" is clicked.

## Craigslist

1. Load Chrome tools if deferred:
   `ToolSearch("select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__form_input,mcp__claude-in-chrome__find,mcp__claude-in-chrome__file_upload,mcp__claude-in-chrome__javascript_tool")`
2. Also ask whether to use their email on the listing (ask once, then reuse
   it — trommatic@icloud.com for this user).
3. Navigate to `https://<city-subdomain>.craigslist.org/` (e.g.
   `vancouver`), then follow the real "post to classifieds" link
   (`https://www.craigslist.org/post/<code>`, `code` from that link — for
   vancouver it's `van`) rather than guessing a `/post` path on the
   subdomain directly, which 404s.
4. The flow is a multi-step wizard, one radio-button screen per step
   (sub-area -> posting type -> category -> edit form). It **silently
   defaults to the last category/type used in this browser** (session
   cookie) and auto-skips steps to jump straight to the edit form — so
   always check the breadcrumb at the top of the edit page
   (e.g. "for sale > electronics - by owner") before filling anything in.
   If it's wrong, navigate back to that step's URL (swap the `?s=` query
   param: `subarea` -> `type` -> `cat` -> `edit`) and reselect.
5. The posting form itself lives in a cross-origin iframe
   (`post.craigslist.org`) inside the `www.craigslist.org` wrapper page —
   `read_page`/`find` on the wrapper URL only see a chat-widget overlay, not
   the real fields, no matter how you filter. If a lookup comes back empty,
   check `document.querySelectorAll('iframe')` via `javascript_tool` and
   `navigate` directly to that iframe's `src` URL so the form becomes the
   top-level document — then `read_page`/`find`/`file_upload` work normally.
   Until then, click fields by coordinate from a screenshot and `type`.
6. The Chrome tab group can drop mid-task (tools error "couldn't determine
   which page" / tab group missing) — Craigslist's create-flow URL tokens
   are single-use/session-bound, so you can't just resume the old tab; call
   `tabs_context_mcp` again and restart the wizard from step 3 in the new
   tab.
7. Fill title/price/city/description/condition/make/model on the edit form
   (see step 5 for locating it) -> upload photo(s) with `file_upload`
   against the *modern* drag-drop uploader's file input (found via `find`,
   e.g. "Add Images button or file input") — the "classic image uploader"
   fallback accepts a file being set but silently drops it (posting still
   shows "0 images" after), so don't use it.
8. Craigslist may insist on a ZIP/postal code on the edit form and then an
   "add map" step to confirm the region (e.g. Fraser Valley vs. Vancouver,
   BC) before the photo step — expect both.
9. Stop before the final submit/publish button and hand control back to the
   user — Craigslist gates posting behind a captcha and email confirmation
   click that only they can complete, and address is usually the user's own
   to add (leave the "show address" map checkbox off by default; it's a
   privacy tradeoff to publish an exact address for a low-value item, not
   your call to opt them into). Tell them exactly what's left and that the
   draft is otherwise ready.
10. If the user says to actually publish: click publish, then the site
    emails a one-time confirmation link. Pull it from Mail.app (the `mail`
    skill's AppleScript pattern) — search INBOX for subject containing
    "craigslist", read `source of m` (not `content of m`, which strips the
    HTML and the link with it), and regex out the
    `https://accounts.craigslist.org/login/onetime?key=...` URL; the raw
    source is quoted-printable encoded (`=3D`, soft line breaks), so decode
    it (Python's `quopri.decodestring`) before regexing or the key gets
    mangled. Navigate to that URL in the same tab to complete the publish.

If the user is logged into a Craigslist account with saved postings, offer
to "repost/renew" an existing listing instead of drafting new (faster, no
captcha wait) — check their account posting list first.

## Facebook Marketplace

Requires the user's own logged-in Facebook session in Chrome (check
`facebook.com` cookies are live — if not, tell the user to log in first,
don't attempt it yourself since that's a password/login action).

1. Navigate to `https://www.facebook.com/marketplace/create/item` directly
   (skip the marketplace browse page — this URL goes straight to the
   listing form for a generic item; swap `item` for `vehicle`/`rental`/etc.
   if the user is posting one of those categories).
2. Facebook requires at least one photo before most other fields unlock —
   upload photo(s) first via `find` ("add photos button" or similar) +
   `file_upload`, same HEIC-to-JPG conversion caveat as Craigslist.
3. Facebook's DOM is heavily obfuscated (generated class names) but the
   fields carry real `aria-label`s, so `find`/`read_page` generally work
   here (unlike Craigslist's iframe problem) — use `find` with the visible
   label text ("Title", "Price", "Category", "Condition", "Description",
   "Location") rather than guessing coordinates. `form_input` works
   directly on the Title/Price/Description text fields found this way.
4. Category and Condition are custom comboboxes, not real `<select>`s —
   `form_input` won't set them. Click the combobox to open its option list,
   then click the option by coordinate. Category in particular is a long
   scrollable tree (Home & Garden, Entertainment, Electronics, Hobbies,
   ... not alphabetical, "Electronics & computers" sits between "Family"
   and "Hobbies") — typing to filter does nothing, you have to scroll and
   read each screenshot to find the right one.
5. Location defaults to the user's Facebook profile location/radius — leave
   it unless the user gives a different city.
6. Stop before "Publish" and hand back to the user, same as Craigslist —
   Marketplace posts under the user's real name/profile, so publishing is
   always their call, not gated by a technical captcha but still a
   never-assume action.
7. If the user says to actually publish: click "Publish", then wait ~3s —
   it redirects to `facebook.com/marketplace/you/selling` and a toast
   confirms "Listing published" (new listings often show "This listing is
   being reviewed" briefly, that's normal, not a failure).

## Kijiji

Biggest classifieds site in Canada outside Facebook — worth defaulting to
alongside Craigslist for anything in the Lower Mainland. Requires the
user's own logged-in Kijiji account (email/password or Google/Facebook
login) — same rule as Marketplace: if not logged in, tell the user to log
in first rather than attempting it yourself.

1. Navigate to `https://www.kijiji.ca/p-post-ad.html`. If not logged in, it
   redirects to `id.kijiji.ca/login` — stop and tell the user to log in
   themselves (password territory). After they say they've logged in,
   re-navigate to the same URL to check — Kijiji's session is per-tab-group,
   so if you get a fresh `tabId`/tab group mid-conversation (e.g. the
   Chrome extension reconnected), re-check login state on the new tab
   rather than assuming the old one's session carries over.
2. Type the item into the "Ad title" box on the first screen (no separate
   search field) and click Next — it shows one "Suggested category" plus a
   manual category tree; the suggestion is usually right (e.g. "printer"
   correctly suggested "Printers, Scanners & Fax" under Buy & Sell >
   Computer Accessories) — click it directly rather than drilling the tree.
3. The ad-details form (title, description, price, condition, photos) is a
   normal same-origin page — `read_page`/`find` work directly here, no
   iframe workaround needed like Craigslist. Condition is a real `<select>`
   — `form_input` works on it directly (unlike Facebook's fake combobox).
4. Location: a "Postal code or street address" field with a live-typeahead
   dropdown — type the postal code and click the one suggestion that
   appears (e.g. "Langley, BC V3A 2X7"); don't skip clicking it, the raw
   typed text alone doesn't resolve to a place. Resulting map preview is a
   fuzzed radius circle, not an exact pin — no separate privacy toggle
   needed like Craigslist's.
5. Photos: same HEIC-to-JPG conversion caveat. Find the file input via
   `find` ("photo upload file input") and use `file_upload` directly — no
   classic/modern uploader split like Craigslist, the plain input just
   works.
6. Kijiji nudges toward paid add-ons ("Feature your ad", "Urgent", bump
   packages, Top Ad) on the way to publish — leave every checkbox
   unchecked (confirm "Total Price: $0.00" before posting) unless the user
   explicitly asked for one (that's a real charge).
7. Stop before the final "Post Your Ad" button and hand back to the user,
   same rule as the other two platforms.
8. If the user says to actually publish: click "Post Your Ad" and wait
   ~3s — it redirects straight to the live listing page
   (`kijiji.ca/v-<category>/<city>/<slug>/<id>`), no review/confirmation
   step, no email verification like Craigslist.
