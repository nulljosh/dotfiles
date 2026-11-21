---
name: atlin-deals
description: Find the best rentals (or US sale homes) in any city through Atlin's live deal ranking. Use when the user asks for good apartments, cheap rent, "deals in Vancouver", or invokes /atlin-deals.
---

Atlin already ranks homes by percent under the typical price for the same bedroom count. This skill calls it and shows the top of the list. Never rescore here.

```
curl -s "https://atlin.jaybulb.com/api/deals?place=<city>&mode=rent&beds=<n>&maxPrice=<n>&type=<house|condo|townhouse>&sort=deal&limit=10"
```

Or in plain words: `.../api/deals?place=Vancouver&q=2 bed under 2500, best value`. The same tools are on the MCP endpoint `https://atlin.jaybulb.com/mcp` (`search_deals`, `ask_atlin`).

Default place Vancouver, default mode rent. Sale only returns homes where a sale feed is on (US). Show 5 to 10 lines:

```
<currency><price>/mo, <beds> bd <baths> ba, <sqft> ft2, <deal>% under typical, <address>  <url>
```

Read `listings[].deal`: 0 means nothing fair to compare against, not "no deal". If `listings` is empty, say so; never invent homes. A listing whose photo is an ad ("2 months free rent") is still a real unit, the photo is just the manager's graphic.
