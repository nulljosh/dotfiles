# dotfiles

macOS shell and terminal config, installed as symlinks by `install.sh`.

## Rules

- No emojis.
- Never commit secrets. They live in `~/.config/zsh/secrets.zsh` and `~/.config/fish/secrets.fish` (gitignored).
- Files are symlinked, so editing the live config edits the repo. Commit from here.
- Keep configs portable across Apple Silicon (`/opt/homebrew`) and Intel (`/usr/local`): no hardcoded Homebrew paths.
- Guard optional tools (`has <tool> && ...` in zsh) so a missing tool never breaks shell startup.
- New config file: add a `link` line to `install.sh` and list it in the README.
- Test with `zsh -i -c exit` and `fish -c exit` before committing.

## Layout

- `zsh/.zshrc` -> `~/.zshrc`
- `fish/config.fish` -> `~/.config/fish/config.fish`
- `ghostty/config` -> `~/.config/ghostty/config`
- `starship/starship.toml`, `starship/starship-terminal.toml` -> `~/.config/`
