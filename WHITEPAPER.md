# dotfiles Technical Whitepaper

**v2.0.0** | September 2026

A machine set up by hand once is a machine that can't be rebuilt after a wipe
or handed to a second Mac without redoing every choice from memory. dotfiles
is the shell and terminal configuration for a macOS Apple Silicon
machine: fish, zsh, Ghostty, Starship, plus the Claude Code config that makes
the coding sessions reproducible, all committed so the setup survives past
one machine.

## Design

- **Symlinks, not copies.** `install.sh` links each directory into
  `~/.config/<tool>`. Editing the live config edits the repo; there is no
  sync step to forget, because a copy-based setup only stays current as long
  as someone remembers to copy the change back.
- **Two shells, one intent.** fish is the daily shell, chosen for its
  interactive defaults. zsh mirrors the PATH, aliases and tool init so a
  `#!/bin/zsh` script or a remote session behaves the same, since scripts and
  some remote tooling assume zsh or bash and fish would silently break them.
- **Secrets are excluded by path.** API keys live in
  `~/.config/fish/secrets.fish` and `~/.config/zsh/secrets.zsh`, both
  untracked, so the repo itself can be pushed to GitHub without ever holding
  a credential. Every config `source`s them if present and continues if not.
- **Tool init is declarative.** starship, zoxide, atuin, fnm and fzf each get
  one init line guarded by `command -v`, so a missing tool degrades to a
  plain shell instead of an error on every prompt, which matters on a fresh
  machine where not every tool is installed yet.

## Layout

| Dir | Contents |
|---|---|
| `fish/`, `zsh/` | shell config, aliases, abbreviations |
| `ghostty/` | terminal: JetBrainsMono Nerd Font, fish as shell |
| `starship/` | prompt: Catppuccin Mocha, Powerline glyphs |
| `claude/` | Claude Code settings, commands, hooks |
| `infra/`, `scaffold/` | machine bootstrap and new-repo templates |
| `applescripts/` | the few GUI automations that have no CLI, kept small on
  purpose since the house rule is CLI first and AppleScript only when there
  is truly no other way in |

## Install

```bash
git clone https://github.com/nulljosh/dotfiles.git ~/Documents/Code/dotfiles
cd ~/Documents/Code/dotfiles && ./install.sh
```

Prerequisites via Homebrew: fish, starship, eza, bat, fd, fzf, zoxide, atuin,
fnm. Plus Ghostty and JetBrainsMono Nerd Font.

## License

MIT 2026, Joshua Trommel
