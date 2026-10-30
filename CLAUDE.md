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
- `landing/` -> https://dotfiles.jaybulb.com (Cloudflare Worker, `./deploy.sh`; needs `npx wrangler login`)
- `brand/tokens.css` -> copied into `landing/` by `deploy.sh`; edit the brand copy, never `landing/tokens.css`
- `scripts/gen_font.py` -> `landing/fonts/DotfilesSans-*.woff2` (needs fonttools, brotli)
- `scripts/dither.py` -> `landing/art/*.png` (needs Pillow)

## Site rules

- Colours are Catppuccin: Latte page, Mocha page in dark mode, Mocha band and terminals in both. No other palette.
- Headlines are one sentence, no commas, ending on the green dot.
- Bump the `?v=` query on CSS and JS links in `landing/*.html` whenever those files change.
- Art must be public domain; credit it in an HTML comment and in `scripts/dither.py`.
