# Architecture

dotfiles is a monorepo holding macOS shell configuration, Claude Code skills, and reference templates. Managed via symlinks from the repo into home directory config paths. Shell configs (fish/zsh) init tools and set up PATH. Skills are subagents that handle specialized tasks (document processing, deployment, app management). No secrets are committed; all sensitive keys live in gitignored `secrets.fish` and `secrets.zsh`.

## How it runs

**Installation**: `./install.sh` symlinks all tracked files into their target locations (e.g., `fish/config.fish` → `~/.config/fish/config.fish`), backing up any existing files to `.bak`. Run once after cloning, or re-run to sync changes from the repo.

**Shell config**: Zsh/Fish read their respective configs at login, which init tool managers (homebrew, nvm, rbenv), set environment variables and PATH, load fzf/starship/direnv, and source the gitignored `secrets.zsh`/`secrets.fish` for API keys.

**Claude Skills**: Symlinked into `~/.claude/skills/` and `~/.agents/skills/`. Each skill is a self-contained tool: `skill-name/brief.md` (instructions), `skill-name/script.py` or equivalent (the implementation). When invoked via `/skill-name` in Claude Code, the script runs.

## Directories and structure

| Path | What it owns |
|---|---|
| `./install.sh` (42L) | Main symlink installer: backs up existing files to .bak, creates symlinks for all tracked config files |
| `fish/` | Fish shell config: abbreviations, aliases, functions, tool init (homebrew, nvm, rbenv, starship, fzf, direnv), sources secrets.fish |
| `zsh/` | Zsh shell config: PATH setup, plugins (starship, fzf, direnv), aliases, tool init, sources secrets.zsh |
| `ghostty/` | Ghostty terminal emulator config: font (Geist Mono), shell (fish), color theme |
| `starship/` | Starship prompt config: Catppuccin Mocha theme, git status, directory truncation, right-side time |
| `applescripts/` | macOS automation: compile scripts/ shell helpers into `~/.local/bin/`, includes simplify.sh for project scaffolding |
| `claude/commands/` | Claude Code slash commands (symlinked to `~/.claude/commands`): `/work`, `/yo`, etc, entry points that run shell or Python |
| `claude/hooks/` | Git hooks (pre-push, post-checkout) installed into project .git directories via Claude Code config |
| `claude/scripts/` | Utility scripts: usage tracking, setup helpers, env checkers |
| `claude/skills/` | Custom skills symlinked to `~/.claude/skills/` (smaller utilities, often one file per skill) |
| `claude/claude-skills/` | Large skills symlinked to `~/.agents/skills/`, each with full brief.md + subdirectories: architecture-svg, asc-name-creator, checkpoint, docx, duolingo, icon-audit, icon-creator, ingest, landing-demo, languages, launch, lec-quiz, localization-sweep, mcp-builder, pdf, pptx, quotestreak, record-web, roadmap-prune, skill-creator, turnstile-spin, webapp-testing, wizard, xlsx |
| `claude/claude-skills/docx/` | DOCX/Office document processing: accept tracked changes, add comments, merge runs, validate XML/XSD, repair tracked-change markup |
| `claude/claude-skills/xlsx/` | XLSX/Excel processing: mirrors docx/ structure for spreadsheet validation and repair |
| `claude/claude-skills/pptx/` | PPTX/PowerPoint processing: slide/chart/master validation, duplicate theme detection, XML repair |
| `claude/claude-skills/pdf/` | PDF manipulation: extract text/tables/images, merge, split, stamp, OCR via API |
| `claude/claude-skills/turnstile-spin/` | Cloudflare Turnstile widget scaffolder: generates boilerplate Cloudflare Worker + HTML/JS + tests |
| `claude/claude-skills/duolingo/` | Duolingo bot: Playwright script that solves Duolingo lessons (math, chess, language) headlessly, includes macOS menu-bar app for status |
| `claude/claude-skills/skill-creator/` | Interactive skill scaffolder: creates new skill template with brief.md, README, test harness, eval suite |
| `claude/claude-skills/icon-creator/` | App icon generator: creates 1024x1024 icons from SVG templates via Pixelmator or CLI |
| `claude/claude-skills/mcp-builder/` | MCP server scaffolder: generates boilerplate Model Context Protocol server with tool definitions |
| `claude/claude-skills/asc-name-creator/` | App Store Connect name prober: tests candidate app names by temporarily renaming a throwaway ASC record |
| `claude/claude-skills/architecture-svg/` | Architecture diagram renderer: takes hand-written JSON spec, renders house-style boxes-and-lines SVG |
| `infra/` | Infrastructure reference templates: API gateway (Go), KV store (Rust), search engine (Python), graphics renderer (Rust) |
| `notes/` | Personal reference site (Jekyll): health resources, school notes, timeline, master notes index |
| `vibe/` | Portfolio design reference: dark editorial aesthetic template, Figma-aligned CSS tokens, component showcase |
| `scaffold/` | Project template extracted from Tally: Express API server, PWA frontend, iOS/macOS native clients, auth (encrypted cookies, biometric unlock), deployment (Vercel + Blob) |

## Per-category depth

**Shell configs** (fish, zsh, starship): Each is static JSON or shell syntax. No runtime state. Fish uses function definitions (e.g., `function work`), zsh uses aliases + eval'd tool init. Secrets sourced at shell startup, not committed.

**Office document processing** (docx, xlsx, pptx): Python-heavy. Unpack ZIP archives, parse/validate XML against XSD schemas, repair structural errors (tracked changes, duplicate themes, invalid IDs), repack into binary office format. Shared helpers (`office/helpers/`) for ZIP extraction, OPC validation, relationship parsing. Validators split by format (base class + docx/pptx/redlining overrides).

**Skills** (40+ directories): Each is a self-contained tool. Brief describes user intent and instructions. Script (Python, Bash, Node, or Swift) is the implementation. Many inherit from Anthropic's official skill templates (docx/xlsx/pptx share structure). Most have test suites.

**Infra templates**: Go/Rust/Python reference implementations for common building blocks. Not deployed; used as copy-paste templates for new projects.

## Data storage and secrets

No data storage in the repo itself (it's read-only code). Secrets live in:
- `~/.config/fish/secrets.fish` (Fish shell vars, functions)
- `~/.config/zsh/secrets.zsh` (Zsh shell vars, exports)
- Never committed; should be regenerated after clone (`cp secrets.example.fish secrets.fish` if template exists)

API keys, GitHub tokens, Stripe live keys, Supabase PEMs all live in secrets only.

## External services and gotchas

- **Homebrew, nvm, rbenv**: Inited via shell config. Tools must be installed separately.
- **Starship**: Installed separately; config points to it. Catppuccin Mocha theme requires starship >= 1.0.
- **fzf, direnv**: Installed separately; shell config sources their init.
- **Pixelmator Pro** (icon-creator): Headless scripting requires Pro version and AppleScript support. Falls back to CLI rasterizer if unavailable.
- **LibreOffice** (docx/xlsx/pptx validators): Used for some validations; must be installed separately.
- **Vercel, Cloudflare CLI**: Must be installed; many skills assume they're in PATH.
- **GitHub CLI** (gh): Assumed present for pull-request operations.

## Known limitations

- No Windows/Linux support: shell configs are macOS-specific (fish/zsh, Starship, Ghostty all macOS-first).
- Skill execution is sequential (one at a time); no parallel skill runs.
- Office document repair is detection-only for some fault classes (e.g., PowerPoint chart axis mismatches); author must decide the fix.
- Duolingo bot requires live browser session; no API-only mode.
- Icon generator depends on Pixelmator for SVG rendering; vector-to-raster pipeline is not pure CLI.
- Skills that call external APIs (skill-creator eval, pdf OCR) incur per-call costs and have rate limits.
