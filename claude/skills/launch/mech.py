#!/usr/bin/env python3
"""ponytail: the mechanical half of /launch. gallery + og.png + meta tags + robots/sitemap + deploy + commit. Copy is written by Claude."""
import sys, os, re, glob, json, subprocess as sp
app, url, tagline, desc = sys.argv[1:5]
root = os.path.expanduser('~/Documents/Code/' + app); os.chdir(root)
def sh(c, **k): return sp.run(c, shell=True, capture_output=True, text=True, **k)
# landing source
land = next((p for p in ['docs/index.html','landing/index.html','index.html','web/index.html'] if os.path.exists(p)), None)
ldir = os.path.dirname(land) or '.'
# gallery
shots = [p for p in sorted(glob.glob('screenshots/**/*.*', recursive=True)) if p.lower().endswith(('.png','.jpg','.jpeg')) and 'raw' not in p][:5]
os.makedirs('launch/gallery', exist_ok=True)
def dims(p):
    o = sh(f"magick identify -format '%w %h' '{p}'").stdout.split(); return int(o[0]), int(o[1])
wide = [p for p in shots if dims(p)[0] > dims(p)[1]]
tall = [p for p in shots if p not in wide]
if wide:
    sh(f"magick '{wide[0]}' -resize 1270x760^ -gravity center -extent 1270x760 launch/gallery/01-hero.png")
elif tall:
    parts = ' '.join(f"\\( '{p}' -resize x700 \\) -gravity center -geometry {g:+d}+0 -composite" for p, g in zip(tall[:3], [-400,0,400][:len(tall[:3])] if len(tall)>=3 else [0]))
    sh(f"magick -size 1270x760 xc:'#111111' {parts} launch/gallery/01-hero.png")
for i, p in enumerate([p for p in shots if not (wide and p == wide[0])][:4], 2):
    sh(f"cp '{p}' launch/gallery/{i:02d}-{os.path.basename(p)}")
if os.path.exists('launch/gallery/01-hero.png'):
    sh(f"magick launch/gallery/01-hero.png -resize 1200x630^ -gravity center -extent 1200x630 {ldir}/og.png")
# meta
fixes = 0
if land:
    h = open(land).read()
    tags = {'og:title': f'<meta property="og:title" content="{tagline}">',
            'og:description': f'<meta property="og:description" content="{desc}">',
            'og:image': f'<meta property="og:image" content="{url}/og.png">',
            'og:url': f'<meta property="og:url" content="{url}/">',
            'twitter:card': '<meta name="twitter:card" content="summary_large_image">',
            'twitter:image': f'<meta name="twitter:image" content="{url}/og.png">',
            'rel="canonical"': f'<link rel="canonical" href="{url}/">'}
    if 'name="description"' not in h:
        tags = {'name="description"': f'<meta name="description" content="{desc}">', **tags}
    add = [v for k, v in tags.items() if k not in h]
    if add:
        fixes = len(add)
        h = re.sub(r'(<title>.*?</title>)', lambda m: m.group(1) + '\n' + '\n'.join(add), h, count=1, flags=re.S)
        open(land, 'w').write(h)
    for f, body in [('robots.txt', f'User-agent: *\nAllow: /\nSitemap: {url}/sitemap.xml\n'),
                    ('sitemap.xml', f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{url}/</loc></url></urlset>\n')]:
        p = os.path.join(ldir, f)
        if not os.path.exists(p): open(p, 'w').write(body); fixes += 1
# deploy: try the repo's own way, don't debug
dep = 'skip'
if fixes:
    if os.path.exists('deploy.sh'): dep = 'deploy.sh'; r = sh('sh deploy.sh', timeout=300)
    elif glob.glob('wrangler.toml') + glob.glob('wrangler.jsonc'):
        cfg = open((glob.glob('wrangler.toml') + glob.glob('wrangler.jsonc'))[0]).read()
        if 'pages_build_output_dir' in cfg: dep = 'pages'; r = sh('npx -y wrangler pages deploy --commit-dirty=true', timeout=300)
        else: dep = 'worker'; r = sh('npx -y wrangler deploy', timeout=300)
    else: dep = 'pages:' + ldir; r = sh(f'npx -y wrangler pages deploy {ldir} --project-name={app} --branch=main --commit-dirty=true', timeout=300)
    dep += ' ok' if r.returncode == 0 else ' FAIL ' + (r.stderr or r.stdout)[-160:].replace('\n', ' ')
# commit
sh('git add launch ' + (ldir if land else ''))
c = sh(f'git commit -qm "launch: kit + seo for {app}\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push -q')
live = sh(f"curl -s -o /dev/null -w '%{{http_code}} %{{content_type}}' {url}/og.png").stdout
print(json.dumps({'app': app, 'landing': land, 'shots': len(shots), 'seo_fixes': fixes, 'deploy': dep, 'og_live': live, 'push': 'ok' if c.returncode == 0 else 'FAIL'}))
