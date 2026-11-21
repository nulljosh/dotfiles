# apple.com: landing and product pages

Measured from the live CSS and HTML of apple.com (the home page, /macbook-air, /airpods-pro and /iphone) on 2026-11-21. Use it when building a marketing site, landing page or product page that should read like Apple's. The numbers come from their stylesheets, not from looking at the pages.

## Page structure

### Home page (a stack of product tiles)
1. **Global nav**, 44 px tall, 12 px links at 80 percent opacity, translucent with `backdrop-filter: blur(20px)` and `saturate(180%)`.
2. **Ribbon**: one line of news (a sale or an event) with a link, on #f5f5f7. Optional.
3. **Hero tiles**: full-bleed, one product per tile, stacked vertically with a 12 px gap. Each has a centred headline (the product name), a subhead of five to ten words, two pill buttons (filled "Learn more", outline "Buy") and a big image or video under the text. Tile height is `max(min(80vh - nav, 1050px), 750px)` on desktop, and shorter on smaller breakpoints.
4. **Promo grid**: two columns of tiles, 12 px gap, same parts at smaller sizes. Light and dark tiles alternate (white with #1d1d1f text, black with #f5f5f7 text).
5. **Media gallery**: a carousel ("Endless entertainment.") with dot navigation.
6. **Footer**: legal footnotes first (12 px, #6e6e73), then a directory of link columns, then copyright and locale.

### Product page (one long story)
1. Global nav, then a **sticky local nav**: product name on the left, section links plus a small blue "Buy" pill on the right, 52 px tall, frosted.
2. **Hero**: product name as a small eyebrow (28 px bold), a short punchline as the big line ("Might takes flight.", 64 to 80 px), an availability line, then one big product shot.
3. **"Get the highlights."**: a horizontal gallery of 28 px radius media cards, each with a one-sentence caption (17 px semibold), and a play/pause control.
4. **Feature chapters**, repeated four to eight times, each built the same way:
   - **section label** (24 to 28 px semibold, the topic: "Design", "Fitness")
   - **section headline** (80 to 96 px semibold, a punchline: "Built to go places.")
   - a short intro paragraph (at most about 692 px wide, 17 to 21 px)
   - one dominant visual, then two to four **caption tiles** or a **stat row** (huge number over a small caption)
   - backgrounds alternate white and #f5f5f7 (`background-alt`), or the whole chapter goes black for drama
5. **"Take a closer look."**: an interactive product viewer (colours and angles).
6. **Upgrade or compare**: "Which [product] is right for you?", two or three models side by side with key specs and icons.
7. **"Why Apple is the best place to buy."**: a row of feature cards (label, headline, body, plus button that opens a modal).
8. **Routers**: accessories and related products, each an eyebrow, headline and link.
9. Footnotes and footer.

### Copy rules
- Headlines are short, declarative and often a pun or a turn of phrase. The period is part of the design: "Love at every sight." "Well connected."
- The product name is the eyebrow; the headline is the benefit.
- One idea per section, one sentence per caption.
- Claims carry a superscript footnote number, explained in the footer.
- Links read "Learn more >" with a drawn chevron, not a bare word.

## Typography

Fonts: `"SF Pro Display"` for 20 px and up, `"SF Pro Text"` below, falling back to `"Helvetica Neue", Helvetica, Arial, sans-serif`. Off Apple devices use `-apple-system, BlinkMacSystemFont` first. Large type is semibold (600); body is 400. Letter spacing gets tighter as size grows and slightly positive at 19 to 32 px.

| Role | Size | Line height | Weight | Tracking | 1068 px / 734 px |
|---|---|---|---|---|---|
| Standalone headline | 96 | 1.04 | 600 | -0.015em | 80 / 48 |
| Section headline, super | 80 | 1.05 | 600 | -0.015em | 64 / 48 |
| Elevated headline | 64 | 1.0625 | 600 | -0.009em | 48 / 40 |
| Tile headline | 56 | 1.07 | 600 | -0.005em | 48 / 32 |
| Headline | 48 | 1.08 | 600 | -0.003em | 40 / 32 |
| Reduced headline | 40 | 1.1 | 600 | 0 | 32 / 28 |
| Eyebrow super | 32 | 1.125 | 600 | 0.004em | 28 / 24 |
| Eyebrow, tile subhead | 28 | 1.14 | 600 (subhead 400) | 0.007em | 24 / 19 |
| Section label | 24 | 1.17 | 600 | 0.009em | 21 / 19 |
| Intro | 21 | 1.19 | 600 | 0.011em | 19 / 17 |
| Body large | 19 | 1.21 | 400 | 0.012em | |
| Body | 17 | 1.47 (1.24 tight) | 400 | -0.022em | |
| Body reduced, buttons | 14 | 1.29 to 1.43 | 400 | -0.016em | |
| Footnotes | 12 | 1.33 | 400 | -0.01em | |

## Colour

| Token | Value | Use |
|---|---|---|
| text | #1d1d1f | primary text on light |
| text-secondary | #6e6e73 | captions, footnotes |
| text-tertiary | #86868b | disabled, meta |
| bg | #ffffff | default section |
| bg-alt | #f5f5f7 | alternate sections, cards, ribbon |
| hairline | #d2d2d7 | dividers |
| accent | #0071e3 | filled buttons (hover #0076df, active #006edb) |
| link | #0066cc light, #2997ff dark | inline links |
| dark bg | #000000 | dark tiles and chapters |
| dark surface | #1d1d1f, #272729 | dark cards, dark-button hover |
| dark text | #f5f5f7 | text on black |

The product photography supplies the colour. The UI stays black, white, grey and one blue.

## Layout

- **Breakpoints**: large is above 1068 px, medium 735 to 1068 px, small 734 px and under. There is an extra-large step at 1441 px and a tiny one at 374 px and under.
- **Content width**: 980 px on large, 692 px on medium, 87.5 percent of the viewport on small (6.25 percent gutters). Wide galleries go to 1068 to 1440 px. Text blocks stay at about 692 px.
- **Section rhythm**: chapters get 80 to 160 px of vertical padding on large screens and about half that on small screens. Inside a chapter: label, then 8 to 12 px, then headline, then 24 to 40 px, then intro, then 48 to 80 px, then the visual.
- **Grids**: tiles 12 px apart, cards 20 to 24 px apart. Desktop uses two or three columns; small screens use one column or a horizontal scroller with peeking cards.
- Centred text in heroes and chapter openers; left-aligned text inside cards.

## Components

- **Buttons** are pills (`border-radius: 980px`).
  - Default: 14 px text, padding 9 by 16, minimum width 60 px.
  - Elevated (in heroes): 17 px text, padding 12 by 22, about 44 px tall.
  - Primary: #0071e3 fill, white text.
  - Secondary: transparent with a 1 px #0071e3 border and blue text; on dark it is a white outline.
  - Dark: #1d1d1f fill, hover #272729.
  - Block buttons in forms and checkout: radius 8 to 12 px, full width.
- **Cards and media**: radius 28 px, background #f5f5f7 (#000 or #1d1d1f on dark), `overflow: hidden`, no border, no shadow.
- **Card controls**: a 44 px round "+" or play/pause button, 13 to 16 px in from the corner, frosted grey `rgba(210,210,215,.64)` on light and `rgba(66,66,69,.72)` on dark.
- **Small labels**: radius 8 px, padding 6 by 8.
- **Nav**: frosted, `backdrop-filter: saturate(180%) blur(20px)` over `rgba(255,255,255,.8)` or `rgba(22,22,23,.8)`.
- **Gallery dots**: small round dots in a frosted pill, play/pause beside them.

## Motion

- Easing: `cubic-bezier(0.4, 0, 0.6, 1)` for most things, and `cubic-bezier(0, 0, 0.2, 1)` for entrances.
- Durations: 0.24 to 0.32 s for UI, 0.5 to 1 s for content fading in on scroll.
- Content fades and rises 20 to 40 px as it enters the viewport. Large visuals pin or scale with scroll. Videos autoplay muted, inline, with a visible pause control.
- With `prefers-reduced-motion`, no scroll animation and no autoplay.

## Starter tokens

```css
:root{
  --font-display:"SF Pro Display",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif;
  --font-text:"SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif;
  --text:#1d1d1f; --text-2:#6e6e73; --text-3:#86868b;
  --bg:#fff; --bg-alt:#f5f5f7; --hairline:#d2d2d7;
  --accent:#0071e3; --accent-hover:#0076df; --link:#0066cc;
  --radius-card:28px; --radius-pill:980px; --radius-label:8px;
  --content:980px; --text-col:692px; --tile-gap:12px;
  --ease:cubic-bezier(.4,0,.6,1); --ease-out:cubic-bezier(0,0,.2,1);
}
@media (max-width:1068px){:root{--content:692px}}
@media (max-width:734px){:root{--content:87.5%}}
.section-content{width:var(--content);margin-inline:auto}
.btn{font:400 17px/1.176 var(--font-text);letter-spacing:-.022em;padding:12px 22px;border-radius:var(--radius-pill);background:var(--accent);color:#fff;border:1px solid transparent}
.btn:hover{background:var(--accent-hover)}
.btn--secondary{background:transparent;color:var(--accent);border-color:var(--accent)}
```

## Don't
- Don't use stock-photo heroes, gradients behind text, drop shadows on cards, borders on tiles, more than one accent or more than two buttons per tile.
- Don't write long headlines. If it doesn't fit on two lines at 56 px, cut it.
- Don't ship Apple's own assets, product names, photography or the SF font files. Copy the system, not the brand.
