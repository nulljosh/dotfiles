# Terminal Shortcuts

## cmux
- `⌘B` / `⌘⌥B` -- toggle sidebars
- `⌘T` / `⌘W` -- new / close tab
- `⌘⇧]` / `⌘⇧[` -- next / previous tab
- `⌘D` / `⌘⇧D` -- split right / down
- `⌘⇧P` -- command palette
- `⌘P` -- switch workspaces
- `⌘F` / `⌘⇧F` -- find / directory search
- `⌘R` -- reload (browser)
- `⌘⇧T` -- reopen closed tab
- `⌘⇧↩` -- zoom pane

## Ghostty
- config lives at `dotfiles/ghostty/config`
- `⌘T` / `⌘W` -- new / close tab
- `⌘D` / `⌘⇧D` -- split right / down
- `⌘]` / `⌘[` -- cycle splits
- `⌘⇧,` -- reload config

## Other terminals/shells worth knowing for Claude Code
- **iTerm2** -- most mature, broadest scripting/automation API, no native agent panes
- **Warp** -- built-in AI/agent blocks, workflows, but closed-source and telemetry-heavy
- **WezTerm** -- GPU-accelerated, Lua config, cross-platform, good multiplexing
- **kitty** -- fast, scriptable via kittens, minimal chrome
- **Zellij** / **tmux** -- terminal multiplexers (not full terminal apps); pair with any of the above for persistent sessions Claude Code can be attached/detached from
- cmux and Ghostty remain the daily drivers; no need to switch unless multiplexing across machines is needed (then tmux on top of Ghostty)
