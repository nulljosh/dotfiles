#!/usr/bin/env python3
"""ponytail: add a Product Hunt badge to <app>/README.md. URL from argv[2] or the `Post:` line in launch/producthunt.md. Idempotent."""
import re, subprocess, sys, pathlib
if sys.argv[1] == '--all':
    root = pathlib.Path.home() / 'Documents/Code'
    for ph in sorted(root.glob('*/launch/producthunt.md')):
        if re.search(r'^Post:\s*https://www\.producthunt\.com/\S+', ph.read_text(), re.M):
            subprocess.run([sys.executable, __file__, ph.parent.parent.name])
    sys.exit(0)
app = sys.argv[1]; d = pathlib.Path.home() / 'Documents/Code' / app
ph = d / 'launch/producthunt.md'; url = sys.argv[2] if len(sys.argv) > 2 else None
if not url and ph.exists():
    m = re.search(r'^Post:\s*(https://www\.producthunt\.com/\S+)', ph.read_text(), re.M); url = m and m.group(1)
if not url: print(f'{app}: no PH post URL, skipped'); sys.exit(0)
if ph.exists() and 'Post:' not in ph.read_text(): ph.write_text(ph.read_text().rstrip() + f'\nPost: {url}\n')
r = d / 'README.md'; t = r.read_text()
if 'producthunt.com' in t: print(f'{app}: badge already present'); sys.exit(0)
badge = f'[![Product Hunt](https://img.shields.io/badge/Product%20Hunt-{app}-da552f?logo=producthunt&logoColor=white)]({url})'
lines = t.split('\n'); i = next((i for i, l in enumerate(lines) if 'img.shields.io' in l), None)
if i is None: i = next(i for i, l in enumerate(lines) if l.startswith('# ')) + 1; lines.insert(i, ''); lines.insert(i + 1, badge)
else: lines[i] += ' ' + badge
r.write_text('\n'.join(lines))
subprocess.run(f'git add README.md launch && git commit -qm "readme: Product Hunt badge\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push -q', shell=True, cwd=d, check=True)
print(f'{app}: badge added -> {url}')
