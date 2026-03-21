# dotfiles

v1.0.0

## Rules

- No emojis.
- Project scope is macOS (Apple Silicon) shell and terminal configuration managed via symlinks.
- NEVER commit secrets (API keys, tokens); secrets are not managed in this repo.
- Secrets live in `~/.config/fish/secrets.fish` and `~/.config/zsh/secrets.zsh`.
- Repo copies must match live configs minus secrets (replaced with source lines).
- After editing a live config, copy the sanitized version into the repo.
- `install.sh` symlinks repo files to their target locations; update it if new files are added.
- Test changes by sourcing the config in a new shell before committing.

## Run

```bash
git clone https://github.com/nulljosh/dotfiles.git ~/Documents/Code/dotfiles
cd ~/Documents/Code/dotfiles
chmod +x install.sh
./install.sh
```

## Key Files

- `fish/` - Fish shell config (aliases, abbreviations, tool init).
- `zsh/` - Zsh config (PATH, aliases, completions, tool init).
- `ghostty/` - Ghostty terminal config (font, shell, theme).
- `starship/` - Starship prompt config (Catppuccin Mocha).
- `install.sh` - Symlink installer that backs up existing files.
- `icon.svg` - Repo icon.
- `architecture.svg` - Architecture diagram.
