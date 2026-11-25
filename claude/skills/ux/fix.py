#!/usr/bin/env python3
"""Mechanical /ux pass on one app folder: fixed fonts -> text styles, labels on icon-only buttons.

usage: fix.py <app-dir> [--dry]
Skips watchOS, widgets, tvOS, visionOS, tests. macOS folders use the Mac size table.
Files with uncommitted changes are left alone. Prints what it changed and the icon-only buttons it could not name (fix those by hand).
"""
import re, sys, pathlib, subprocess

IOS = {9: 'caption2', 10: 'caption2', 11: 'caption2', 12: 'caption', 13: 'footnote', 14: 'subheadline',
       15: 'subheadline', 16: 'callout', 17: 'body', 18: 'title3', 19: 'title3', 20: 'title3',
       21: 'title2', 22: 'title2', 24: 'title', 26: 'title', 28: 'title', 30: 'largeTitle',
       32: 'largeTitle', 34: 'largeTitle'}
# macOS text styles: caption 10, subheadline 11, callout 12, body 13, title3 15, title2 17, title 22, largeTitle 26
MAC = {10: 'caption', 11: 'subheadline', 12: 'callout', 13: 'body', 15: 'title3', 17: 'title2', 22: 'title', 26: 'largeTitle'}
SKIP = re.compile(r'(watch|widget|Widget|tvos|visionos|Tests|\.build|node_modules|Preview Content|/kmp/)', re.I)

NAMES = {
    'plus': 'Add', 'plus.circle': 'Add', 'plus.circle.fill': 'Add', 'gearshape': 'Settings', 'gearshape.fill': 'Settings',
    'gear': 'Settings', 'xmark': 'Close', 'xmark.circle': 'Close', 'xmark.circle.fill': 'Clear', 'magnifyingglass': 'Search',
    'square.and.arrow.up': 'Share', 'trash': 'Delete', 'trash.fill': 'Delete', 'ellipsis': 'More', 'ellipsis.circle': 'More',
    'bell': 'Notifications', 'bell.fill': 'Notifications', 'arrow.clockwise': 'Refresh', 'info.circle': 'Info',
    'pencil': 'Edit', 'square.and.pencil': 'New', 'chevron.left': 'Back', 'chevron.right': 'Next', 'chevron.down': 'Expand',
    'person.crop.circle': 'Account', 'person.circle': 'Account', 'line.3.horizontal.decrease.circle': 'Filter',
    'line.3.horizontal.decrease': 'Filter', 'play.fill': 'Play', 'pause.fill': 'Pause', 'stop.fill': 'Stop',
    'mic.fill': 'Record', 'mic': 'Record', 'doc.on.doc': 'Copy', 'arrow.up.arrow.down': 'Sort', 'calendar': 'Calendar',
    'sidebar.left': 'Toggle sidebar', 'arrow.uturn.backward': 'Undo', 'questionmark.circle': 'Help',
    'slider.horizontal.3': 'Options', 'arrow.left': 'Back', 'arrow.right': 'Forward', 'house': 'Home',
    'bookmark': 'Bookmark', 'heart': 'Favorite', 'speaker.wave.2.fill': 'Play audio', 'speaker.wave.2': 'Play audio',
    'list.bullet': 'List', 'map': 'Map', 'checkmark': 'Done', 'paperplane.fill': 'Send', 'arrow.up.circle.fill': 'Send',
    'arrow.up.left.and.arrow.down.right': 'Expand', 'location.fill': 'Current location', 'location': 'Current location',
    'mappin.circle.fill': 'Show on map', 'arrow.up.doc': 'Upload', 'square.and.arrow.down': 'Save', 'printer': 'Print',
    'shuffle': 'Shuffle', 'forward.fill': 'Skip', 'backward.fill': 'Previous', 'person.2': 'People',
}
IMG = re.compile(r'Image\(systemName:\s*"([^"]+)"\)')
OPEN = re.compile(r'(Button\s*\{|Button\(action:|Button\(role:[^)]*\)\s*\{|\}\s*label:\s*\{|NavigationLink\s*\{|Menu\s*\{|Toggle\(isOn)')
IMAGE_ONLY = ('.resizable', '.renderingMode', '.interpolation', '.antialiased')


def font_args(args, table):
    m = re.fullmatch(r'size:\s*(\d+)(?:\s*,\s*weight:\s*([^,]+?))?(?:\s*,\s*design:\s*([^,]+?))?\s*', args)
    if not m or int(m.group(1)) not in table:
        return None
    style, weight, design = table[int(m.group(1))], m.group(2), m.group(3)
    if not weight and not design:
        return None  # whole call becomes .font(.style)
    out = f'.{style}'
    if design: out += f', design: {design}'
    if weight: out += f', weight: {weight}'
    return out


def fix_fonts(src, table):
    n = 0
    def plain(m):
        nonlocal n
        size = int(m.group(1))
        if size not in table: return m.group(0)
        n += 1; return f'.font(.{table[size]})'
    src = re.sub(r'\.font\(\.system\(size:\s*(\d+)\)\)', plain, src)
    def full(m):
        nonlocal n
        new = font_args(m.group(1), table)
        if not new: return m.group(0)
        n += 1; return f'.system({new})'
    src = re.sub(r'\.system\(((?:size:\s*\d+)(?:\s*,\s*(?:weight|design):\s*[^,()]+(?:\([^()]*\))?)*)\)', full, src)
    return src, n


def fix_labels(path, lines):
    named, unnamed = 0, []
    for i, l in enumerate(lines):
        if not OPEN.search(l): continue
        end = min(i + 7, len(lines))
        blk = '\n'.join(lines[i:end])
        if re.search(r'Text\(|Label\(|accessibilityLabel|Button\("|Toggle\("|TextField|SecureField|\.help\(', blk): continue
        for j in range(i, end):
            m = IMG.search(lines[j])
            if not m: continue
            nxt = lines[j][m.end():].lstrip() or (lines[j + 1].lstrip() if j + 1 < len(lines) else '')
            name = NAMES.get(m.group(1))
            if not name or nxt.startswith(IMAGE_ONLY):
                unnamed.append(f'{path}:{j + 1} {m.group(1)}'); break
            lines[j] = lines[j][:m.end()] + f'.accessibilityLabel("{name}")' + lines[j][m.end():]
            named += 1; break
        else:
            if 'Image(systemName:' in blk:
                unnamed.append(f'{path}:{i + 1} (dynamic symbol)')
    return named, unnamed


def main():
    root, dry = pathlib.Path(sys.argv[1]), '--dry' in sys.argv
    fonts = labels = 0; todo = []
    # never touch files with someone's uncommitted work in them
    top = subprocess.run(['git', '-C', str(root), 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip()
    st = subprocess.run(['git', '-C', str(root), 'status', '--porcelain'], capture_output=True, text=True).stdout
    dirty = {pathlib.Path(top, l[3:].split(' -> ')[-1]).resolve() for l in st.splitlines()} if top else set()
    for p in sorted(root.rglob('*.swift')):
        rel = str(p.relative_to(root))
        if SKIP.search('/' + rel) or p.resolve() in dirty: continue
        table = MAC if re.search(r'(^|/)(macos|mac)(/|$)|Mac', rel) else IOS
        src = p.read_text()
        out, n = fix_fonts(src, table)
        lines = out.split('\n')
        k, u = fix_labels(rel, lines)
        out = '\n'.join(lines)
        fonts += n; labels += k; todo += u
        if out != src and not dry: p.write_text(out)
    print(f'fonts={fonts} labels={labels} unnamed={len(todo)}')
    for t in todo: print('  ', t)


def demo():
    s, n = fix_fonts('.font(.system(size: 13, weight: .bold, design: .rounded)) .font(.system(size: 17)) .font(.system(size: 56))', IOS)
    assert s == '.font(.system(.footnote, design: .rounded, weight: .bold)) .font(.body) .font(.system(size: 56))', s
    L = ['Button {', '  go()', '} label: {', '  Image(systemName: "plus")', '}']
    assert fix_labels('x', L)[0] == 1 and L[3].endswith('.accessibilityLabel("Add")'), L


if __name__ == '__main__':
    demo(); main()
