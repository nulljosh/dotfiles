![dotfiles](icon.svg)

# dotfiles

Shell and terminal config for macOS (Apple Silicon or Intel).

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

## Secrets

API keys go in `~/.config/zsh/secrets.zsh` and `~/.config/fish/secrets.fish`. Both are sourced if present and never committed.

## License

MIT 2026 Joshua Trommel
