#!/usr/bin/env python3
"""Generate one app's brand kit from a few inputs: Icon Composer bundle, flat icon.svg, favicons,
brand/tokens.css, brand/BRAND.md, brand/mark.svg. The reference kit is wordroot/brand.

usage: make_brand.py <repo-dir> <Name> <light-hex> <deep-hex> <glyph.svg-inner-file> "<one line idea>"
The glyph is SVG markup on a 1024 grid, white, no text. Stroke glyphs use stroke="#fff" fill="none"."""
import json, os, re, subprocess, sys

repo, name, light, deep, glyph_file, idea = sys.argv[1:7]
repo = os.path.abspath(repo)
glyph = open(glyph_file).read().strip()
slug = name.lower()

def rgb(h): h = h.lstrip('#'); return [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
def ext(h, mix=0.0): return 'extended-srgb:' + ','.join(f'{c * (1 - mix):.3f}' for c in rgb(h)) + ',1.0'

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w').write(text)

def render(svg_path, png_path, size, flatten=None):
    subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size), svg_path, '-o', png_path], check=True)
    if flatten:  # Apple drops icons with an alpha channel
        subprocess.run(['magick', png_path, '-background', flatten, '-alpha', 'remove', '-alpha', 'off', png_path], check=True)

NS = 'xmlns="http://www.w3.org/2000/svg"'
gradient = f'<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{light}"/><stop offset="1" stop-color="{deep}"/></linearGradient></defs>'
tile = lambda size, rx: f'<svg {NS} width="{size}" height="{size}" viewBox="0 0 1024 1024">{gradient}<rect width="1024" height="1024" rx="{rx}" fill="url(#g)"/>{glyph}</svg>\n'

# flat icon, favicon source, mark
write(f'{repo}/icon.svg', tile(200, 224))
write(f'{repo}/brand/mark.svg', f'<svg {NS} viewBox="0 0 1024 1024" fill="currentColor" color="inherit">{glyph.replace("#fff", "currentColor")}</svg>\n')
write(f'{repo}/brand/icon-tile.svg', tile(1024, 0))

# Icon Composer bundle: glyph layer on a gradient fill, light and dark
bundle = f'{repo}/{name}.icon'
os.makedirs(f'{bundle}/Assets', exist_ok=True)
glyph_svg = f'{repo}/brand/glyph.svg'
write(glyph_svg, f'<svg {NS} width="1024" height="1024" viewBox="0 0 1024 1024">{glyph}</svg>\n')
render(glyph_svg, f'{bundle}/Assets/glyph.png', 1024)
os.remove(glyph_svg)
icon = {
  "fill-specializations": [
    {"value": {"linear-gradient": [ext(light), ext(deep)]}},
    {"appearance": "dark", "value": {"linear-gradient": [ext(deep, .72), ext(deep, .88)]}},
  ],
  "groups": [{"layers": [{"glass": False, "image-name": "glyph.png", "name": name}], "lighting": "individual", "name": name,
              "shadow": {"kind": "neutral", "opacity": 0.3}, "specular": True, "translucency": {"enabled": False, "value": 0}}],
  "supported-platforms": {"squares": "shared"},
}
write(f'{bundle}/icon.json', json.dumps(icon, indent=2) + '\n')

# flat 1024 marketing icon (no alpha) and favicons
render(f'{repo}/brand/icon-tile.svg', f'{repo}/brand/icon-1024.png', 1024, flatten=deep)
rounded = tile(1024, 224)
write(f'{repo}/brand/_r.svg', rounded)
site = next((d for d in ('web', 'public', 'docs', 'landing', 'site', 'static', 'frontend') if os.path.isfile(f'{repo}/{d}/index.html')), '.' if os.path.isfile(f'{repo}/index.html') else None)
if site:
    base = repo if site == '.' else f'{repo}/{site}'
    write(f'{base}/favicon.svg', tile(64, 224))
    render(f'{repo}/brand/_r.svg', f'{base}/favicon-32.png', 32)
    render(f'{repo}/brand/_r.svg', f'{base}/apple-touch-icon.png', 180)
    page = f'{base}/index.html'
    html = open(page).read()
    if 'rel="icon"' not in html and "rel='icon'" not in html and '</head>' in html:
        html = html.replace('</head>', '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n</head>', 1)
        open(page, 'w').write(html)
os.remove(f'{repo}/brand/_r.svg')

# tokens and brand doc
write(f'{repo}/brand/tokens.css', f'''/* {name} brand tokens. The accent is the only colour this app owns; spacing, radii and type come from the shared system. */
:root {{
  --accent: {deep};
  --accent-light: {light};
  --accent-deep: {deep};
  --accent-ring: color-mix(in srgb, {deep} 30%, transparent);
}}
''')
write(f'{repo}/brand/BRAND.md', f'''# {name} brand kit and design system

{idea}

## The mark
One bold flat white glyph on an accent gradient tile. No text, no outline, no emblem.

- `../{name}.icon` is the source of truth (Icon Composer). Light and dark fills are set in it.
- `../icon.svg` is the flat copy for READMEs (shown at 80 px). `icon-1024.png` is the App Store icon, no alpha.
- `mark.svg` is the glyph alone in `currentColor` for your own background.
- Clear space equal to the width of the glyph's thickest stroke. Smallest size 16 px.

## Colour
| Role | Value |
|---|---|
| Accent | `{deep}` |
| Gradient top | `{light}` |
| Text | `#1d1d1f` light, `#f5f5f7` dark |
| Background | `#ffffff` light, `#000000` dark |
| Surface | `#f5f5f7` light, `#1c1c1e` dark |

The accent is for actions, links and the icon. Never brown, beige, purple or teal.

## Type
The system font: `-apple-system, BlinkMacSystemFont, "SF Pro Text", Lato, "Helvetica Neue", Helvetica, Arial, sans-serif`. Scale 34/41 bold, 22/28, 17/24, 15/20, 13/18.

## Space and shape
- Space on the 8 point grid: 4, 8, 12, 16, 24, 32, 48. Side margin 20. Reading column 680.
- Radii: cards 28, grouped lists 20, controls fully round, icon 22 percent.
- Controls are 48 points tall capsules, one height in a row. Focus is a 4 point ring at 30 percent accent.
- Motion is 0.2 s ease and honours reduced motion.

`tokens.css` holds the app's accent. Everything else comes from the shared token file.
''')

# README icon
readme = f'{repo}/README.md'
if os.path.isfile(readme):
    r = open(readme).read()
    if 'icon.svg' not in r:
        lines = r.split('\n')
        i = next((k for k, l in enumerate(lines) if l.startswith('# ')), 0)
        lines.insert(i, '<p align="center"><img src="icon.svg" width="80" height="80" alt="%s icon"></p>\n' % name)
        open(readme, 'w').write('\n'.join(lines))
print('ok', name, 'site:', site)
