# dotfiles

## Overview
Shell and terminal configuration for macOS (Apple Silicon). Manages fish, zsh, ghostty, and starship configs via symlinks.

## Structure
```
dotfiles/
  fish/           # Fish shell config (aliases, abbreviations, tool init)
  zsh/            # Zsh config (PATH, aliases, completions, tool init)
  ghostty/        # Ghostty terminal config (font, shell, theme)
  starship/       # Starship prompt config (Catppuccin Mocha)
  install.sh      # Symlink installer (backs up existing files)
  icon.svg        # Repo icon
  architecture.svg # Architecture diagram
```

## Commands
- `./install.sh` -- symlinks all configs to their target locations. Backs up existing files as `.bak`.
- Secrets are NOT managed. They live in `~/.config/fish/secrets.fish` and `~/.config/zsh/secrets.zsh`.

## Rules
- NEVER commit secrets (API keys, tokens). They live in secrets.fish / secrets.zsh.
- Repo copies must match live configs minus secrets (replaced with source lines).
- After editing a live config, copy the sanitized version into the repo.
- install.sh symlinks repo files to their target locations. Update it if new files are added.
- Test changes by sourcing the config in a new shell before committing.
