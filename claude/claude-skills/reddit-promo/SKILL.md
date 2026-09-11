---
name: reddit-promo
description: Build a Reddit promo kit for one app under ~/Documents/Code — picks the right subreddits from a vetted list (by app category), writes one story-driven post per subreddit in that sub's required format, and flags which subs need karma/age/flair first. Use when the user says /reddit-promo, "reddit <app>", "advertise on reddit", "promote my app on reddit", or wants Reddit specifically (for a broader kit use /launch).
---

# reddit-promo

`/reddit-promo <app> [--dry]`

Reddit self-promo is mostly banned or filtered. This skill exists because `/launch`'s `reddit.md`
is a one-line stub — this picks real subreddits per app type, respects each sub's actual rule
(self-promo day, flair, karma minimum), and writes a post that reads as a story, not an ad.

## Subreddit map (vetted 2026-09)

Promotion-friendly, no/low karma gate:
| Subreddit | Fits | Rule |
|---|---|---|
| r/SideProject | any app | tell the build story: what/why/tech/feedback wanted, no bare link |
| r/IndieBiz | any paid/indie app | founder framing, revenue/growth angle welcome |
| r/AlphaAndBetaUsers | pre-launch / new build | recruit testers, not buyers — post before public launch |
| r/BetaTestersNeeded | pre-launch | same, TestFlight links fine |
| r/iOSBeta | iOS pre-launch | TestFlight only, no App Store links |
| r/InternetIsBeautiful | polished web app, novel idea | title = what it does, no self-promo speak, low tolerance for "my app" framing |
| r/SoftwareRecommendations | reply-only | don't post; monitor for people asking for what your app does, answer there |

Dev-community, promo tolerated if you participate genuinely first:
| Subreddit | Fits | Rule |
|---|---|---|
| r/iOSProgramming | iOS apps | "Show and Tell" flair required, weekly self-promo thread is safest |
| r/macapps | macOS apps | check pinned self-promo thread before a standalone post |
| r/AndroidApps | Android/KMP builds | same pattern as macapps |
| r/webdev | web tools/utilities | frame as "I built X to solve Y", not an ad |

Category niches (only post if the app is actually about this):
| Subreddit | Fits |
|---|---|
| r/productivity, r/getdisciplined | productivity/habit apps (Windgate, Numen) |
| r/privacy, r/degoogle | privacy-first apps (Siftbox, Lucarne) |
| r/writing, r/PoetrySlam | writing/poetry apps (Co-Stanza) |
| r/languagelearning | language apps (Lexly/pwnlingo) |
| r/dreams | dream journaling (Dream state) |
| r/RealEstate, r/Renters | real estate (Roost) |
| r/lostpets | pet recovery (Homeward state) |
| r/personalfinance (reply-only, no posts) | finance (Epiphany) — answer questions, mention tool only if asked |

Never post to: r/apps, r/Android (general), r/apple, r/technology — auto-removed or banned for self-promo.

## Steps

1. Read `README.md` + `WHITEPAPER.md` for the app (same sources as `/launch`). Determine category → match table above.
2. Check `launch/producthunt.md` if it exists — reuse the maker story instead of re-deriving it.
3. For each matched subreddit, write `launch/reddit/<subreddit>.md`:
   - Title: plain description of what it does, no "Check out my new app!"
   - Body: the problem you personally had, what you built, what it's built with (one line), what you want back (feedback/testers), link last.
   - Note at top: karma/flair/day requirement from the rule column, and whether it's beta-only (TestFlight/no App Store link) or public.
4. `checklist.md` in the same folder: which subs Joshua's Reddit account already has enough karma/age for (ask if unknown — don't guess), which need the weekly self-promo thread instead of a standalone post.
5. Commit + push per `[[feedback_auto_push]]`. `--dry` skips commit.

## Rules

- Never post to Reddit directly — draft only, Joshua posts by hand (Reddit self-promo bans are
  account-wide and permanent; a bad post can burn the account for every future launch).
  → skipped: an autopost path, add only if Joshua explicitly asks for direct posting.
- One post per subreddit, tailored — never the same body pasted twice, Reddit's spam filter and
  mods both catch that.
- No em dashes, no "seamlessly/leverage/delve", story voice per `[[feedback_house_writing_voice]]`.
- If the app has no beta/TestFlight and isn't live yet, only draft the beta-subreddit posts and
  say so — don't draft public-launch posts for something not shippable.

## Report

Table: subreddit · fits because · gate (karma/flair/day) · file. Then one line: which subs need
Joshua to check his account standing first.
