# dotfiles brand

The brand is the prompt. Everything comes from what the terminal already shows: the Starship powerline and the dot.

## Mark

`mark.svg`: three powerline chevrons (blue, peach, mauve) running into the green dot. A prompt, waiting.
`../icon.svg`: the mark on a Catppuccin Mocha tile (`#1e1e2e`, 22.5% corner radius).

- Keep the colours in segment order. Never recolour the mark to one ink.
- Minimum size 16 px for the icon; below 24 px drop the tile only if the background is Mocha already.
- The dot also stands alone: green, a true circle, after the wordmark (`.dotfiles`) and at the end of headlines.

## Colour

Catppuccin. Latte for light pages, Mocha for dark pages and for every terminal and band in both themes.

| Role | Light (Latte) | Dark (Mocha) |
| --- | --- | --- |
| Page | `#eff1f5` | `#11111b` |
| Surface | `#e6e9ef` | `#181825` |
| Line | `#ccd0da` | `#313244` |
| Text | `#4c4f69` | `#cdd6f4` |
| Secondary text | `#5c5f77` | `#a6adc8` |
| Links | `#1d58d8` | `#89b4fa` |
| Button | `#1e66f5`, white label | `#89b4fa`, `#11111b` label |
| The dot | `#40a02b` | `#a6e3a1` |

Segments (Mocha, as Starship draws them): blue `#89b4fa`, peach `#fab387`, mauve `#cba6f7`, green `#a6e3a1`.
Blue does the work (links, buttons, the frame). Green is only the dot and success. Peach and mauve are decoration.
Every text pair meets WCAG AA; Latte peach and green are decorative only, never text.

## Type

Dotfiles Sans: Inter (SIL OFL 1.1), renamed, with every dot (i, j, period, colon, semicolon, ellipsis, ! and ?) redrawn
as a true circle 14% larger. Proportional, in the spirit of San Francisco. Built by `scripts/gen_font.py`.

- Headlines: Bold, tracked tight (-0.035em to -0.045em), end on a green dot.
- Labels: Semibold 12 px, uppercase, +0.08em.
- Body: Regular 17/24.
- Code: the system monospace (SF Mono), JetBrains Mono Nerd Font in the terminal itself.

## Motifs

- **Powerline stripe**: the four segments as one hard-stopped bar (`--powerline`), under the nav.
- **Dot field**: a 14 px grid of 1.7 px dots in a segment colour, faded by a mask.
- **Glyph band**: the repo's things (dot, prompt, fish, ghost, star, branch, folder) drawn as a halftone in segment colours.
- **Frame**: a 4 px blue rule down both window edges on wide screens.

## Voice

Short, plain, concrete. Say what it does in the fewest words: "Same shell, every Mac." No emojis.

## Files

- `tokens.css`: the single source for colour, type, space and shape. `deploy.sh` copies it into `landing/`.
- `mark.svg`, `../icon.svg`: the mark and the app tile.
- Live kit: https://dotfiles.jaybulb.com/brand
