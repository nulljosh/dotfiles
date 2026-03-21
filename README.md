![dotfiles](icon.svg)

# dotfiles

![version](https://img.shields.io/badge/version-v1.0.0-blue)

Shell and terminal config for macOS (Apple Silicon).
![architecture](architecture.svg)

## Features

- **fish** - Fish shell config (aliases, abbreviations, tool init)
- **zsh** - Zsh config (PATH, aliases, completions, tool init)
- **ghostty** - Ghostty terminal (JetBrainsMono Nerd Font, fish shell)
- **starship** - Starship prompt (Catppuccin Mocha, Powerline glyphs)

## Run

```bash
git clone https://github.com/nulljosh/dotfiles.git ~/Documents/Code/dotfiles
cd ~/Documents/Code/dotfiles
chmod +x install.sh
./install.sh
```

Prerequisites: [Homebrew](https://brew.sh); fish, starship, eza, bat, fd, fzf, zoxide, atuin, fnm (all via brew); [JetBrainsMono Nerd Font](https://www.nerdfonts.com/); [Ghostty](https://ghostty.org).
Secrets (API keys) are stored in `~/.config/fish/secrets.fish` and `~/.config/zsh/secrets.zsh`, which are not tracked.

## Roadmap

- [ ] Add a bootstrap script to install Homebrew and required packages.
- [ ] Add OS and shell version checks before running install.
- [ ] Add a pre-commit check to ensure secrets files are excluded.

## Changelog

- v1.0.0: Added fish shell config with aliases, abbreviations, and tool init.
- v1.0.0: Added zsh config with PATH, aliases, completions, and tool init.
- v1.0.0: Added Ghostty and Starship configs plus the install.sh symlink installer.

## License

MIT 2026 Joshua Trommel
