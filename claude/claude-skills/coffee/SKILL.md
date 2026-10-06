---
name: coffee
description: Napkin-math whatever we're doing (a plan upgrade, an API bill, a subscription, a domain, hours saved) against everyday costs like a coffee, a phone bill, groceries or a Compass fare. Use when the user says /coffee, "is it worth it", "napkin math", "compare it to coffee", or asks what something costs in real-life terms.
---

# /coffee: napkin math against real life

Take a cost (and what it buys, usually hours or days) and say it in coffees, phone bills and meals. Fun, short, true.

## 1. Get the numbers

- Cost: from the conversation (a checkout screenshot, a bill, a price). Use CAD. Add BC tax (12%) when the source says "+ tax".
- What it buys: hours, days, sales needed, etc. Pull from the conversation; if it's a guess, say "give or take".
- Normalize to per month, per day (÷30.4) and per hour of benefit when hours are known.
- ARGUMENTS can override anything: `/coffee 40/mo` or `/coffee phone=55`.

## 2. Price sheet (Vancouver, CAD, napkin defaults)

Rough on purpose. Swap in a real number when the user gives one.

| Thing | Price |
|---|---|
| Drip coffee | 3 |
| Latte | 6 |
| Compass fare, 1 zone | 3.35 |
| Big Mac | 8 |
| Lunch out | 20 |
| Dinner out for two | 80 |
| Groceries, one person | 400 / mo |
| Phone bill | 65 / mo |
| Netflix Standard | 19 / mo |
| Spotify Premium | 13 / mo |
| Gas, full tank | 90 |
| Minimum wage, BC | 18 / hr |

## 3. Output

2-6 short lines, one comparison per line, the math visible (`156.80 / 60 h = 2.61/h`). Lead with coffee, then whichever comparisons hit hardest. End on a one-line verdict when the user is deciding something.

## Rules

- Every number traceable to the conversation or the price sheet. Never invent benefits.
- If the comparison makes it look bad, say so. Napkin math cuts both ways.
- No em dashes, no emojis, no headers in the answer.
