![dotfiles](icon.svg)

# dotfiles

Shell and terminal config for macOS (Apple Silicon or Intel).

Site: https://dotfiles.jaybulb.com

![architecture](architecture.svg)

## What's here

- `zsh/.zshrc` - PATH, aliases, completions, tool init
- `fish/config.fish` - same setup for fish, plus git abbreviations
- `ghostty/config` - Ghostty terminal (JetBrainsMono Nerd Font, launches fish)
- `starship/` - Starship prompt (Catppuccin Mocha powerline, plus a plain variant for Terminal.app)

## Install

```bash
git clone https://github.com/nulljosh/dotfiles.git ~/Documents/Code/dotfiles
cd ~/Documents/Code/dotfiles
brew install fish starship eza bat fd fzf zoxide atuin fnm
brew install --cask font-jetbrains-mono-nerd-font ghostty
./install.sh
```

`install.sh` symlinks each file into place and backs up anything it replaces as `*.bak`. Missing tools are skipped, not errors.

## Site

https://dotfiles.jaybulb.com is a Cloudflare Worker serving `landing/`. `./deploy.sh` copies the brand files in and publishes it (needs `npx wrangler login` once).

- `brand/` - the brand kit: `tokens.css` (the single source for colour, type and space), `mark.svg`, `BRAND.md`. Live at `/brand`.
- `scripts/gen_font.py` - builds Dotfiles Sans: Inter (OFL) with every dot redrawn as a circle.
- `scripts/dither.py` - dithers the public domain art (Janus, Velazquez's Forge of Vulcan) into the masks in `landing/art/`.

## Secrets

API keys go in `~/.config/zsh/secrets.zsh` and `~/.config/fish/secrets.fish`. Both are sourced if present and never committed.

## License

MIT 2026 Joshua Trommel
