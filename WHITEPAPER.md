# dotfiles Technical Whitepaper

**v2.0.0** | September 2026

dotfiles is the shell and terminal configuration for a macOS Apple Silicon
machine: fish, zsh, Ghostty, Starship, plus the Claude Code config that makes
the coding sessions reproducible.

## Design

- **Symlinks, not copies.** `install.sh` links each directory into
  `~/.config/<tool>`. Editing the live config edits the repo; there is no
  sync step to forget.
- **Two shells, one intent.** fish is the daily shell. zsh mirrors the PATH,
  aliases and tool init so a `#!/bin/zsh` script or a remote session behaves
  the same.
- **Secrets are excluded by path.** API keys live in
  `~/.config/fish/secrets.fish` and `~/.config/zsh/secrets.zsh`, both
  untracked. Every config `source`s them if present and continues if not.
- **Tool init is declarative.** starship, zoxide, atuin, fnm and fzf each get
  one init line guarded by `command -v`, so a missing tool degrades to a
  plain shell instead of an error on every prompt.

## Layout

| Dir | Contents |
|---|---|
| `fish/`, `zsh/` | shell config, aliases, abbreviations |
| `ghostty/` | terminal: JetBrainsMono Nerd Font, fish as shell |
| `starship/` | prompt: Catppuccin Mocha, Powerline glyphs |
| `claude/` | Claude Code settings, commands, hooks |
| `infra/`, `scaffold/` | machine bootstrap and new-repo templates |
| `applescripts/` | the few GUI automations that have no CLI |

## Install

```bash
git clone https://github.com/nulljosh/dotfiles.git ~/Documents/Code/dotfiles
cd ~/Documents/Code/dotfiles && ./install.sh
```

Prerequisites via Homebrew: fish, starship, eza, bat, fd, fzf, zoxide, atuin,
fnm. Plus Ghostty and JetBrainsMono Nerd Font.

## License

MIT 2026, Joshua Trommel
