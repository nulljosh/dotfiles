#!/usr/bin/env python3
"""Fix stale Product Hunt product pages (name, tagline, URL, description, pricing, logo) in the signed-in Safari. usage: ph_fix.py <slug>... Edit REN and PRICING first."""
import os,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import ph_submit as ph,time,json,subprocess,sys
RAW='https://raw.githubusercontent.com/nulljosh/'
# slug: (name, tagline, site, desc, pricing, logo-or-None)
FREE_OPT='free_options'
PRICING={'voxprint':'free_options','doorstock':'free','bookrank':'free_options','curvely':'free_options','talli-2':'free_options','inkpress':'free_options','quotestreak':'free','wordroot':'free_options','lexly':'free','epiphany-3':'free_options','sparkjar':'free_options','nyc-survive':'free_options','blockframe':'free_options','sidewise-2':'free','toroid':'free_options','plaintxt-2':'free','nimble-answers':'free_options','joshua-tree':'free','curbfind':'free','plank':'free','healstack':'free_options'}
REN={
'inkpress':dict(name='Bugle',tagline='Every feed, one timeline',site='https://bugle.jaybulb.com',desc='An RSS and Atom reader for iPhone, iPad, Mac and the web. Add any blog, paper or Hacker News, and read everything in one timeline, newest first. No account needed.',logo=RAW+'labs/main/bugle/brand/icon-1024.png'),
'quotestreak':dict(name='Coda',tagline='Here is the line. Name the movie.',site='https://coda.jaybulb.com',desc='Name the movie, show, game, song or book from one line. 14,434 lines, a speed round, a daily quote, live duels and seasons.',logo=RAW+'labs/main/coda/brand/icon-1024.png'),
'lexly':dict(name='Patois',tagline='Learn the way people really talk',site='https://patois.jaybulb.com',desc='Short lessons in 18 languages and 110 other courses. Hear it, say it, keep your streak. Free on iPhone, Mac and the web.',logo=RAW+'patois/main/brand/icon-1024.png'),
'sparkjar':dict(name='Melete',tagline='A new idea every morning',site='https://melete.jaybulb.com',desc='A new idea every morning. Vote, see what is already on the App Store, and build the one nobody has. On the web, iPhone and Mac.',logo=RAW+'melete/main/brand/icon-1024.png'),
'nyc-survive':dict(name='Gastown',tagline='Lead a crew through rainy Vancouver',site='https://gastown.jaybulb.com',desc='Lead a small crew through rainy Vancouver. Send them to work, build drills and generators that run on their own, and raise the Gastown Steam Clock. On Mac, iPhone and iPad, and in your browser.',logo=RAW+'gastown/main/brand/icon-1024.png'),
'blockframe':dict(name='Icelus',tagline='Describe a screen. It takes shape.',site='https://icelus.jaybulb.com',desc='A design tool for people and agents. Describe a screen in a sentence and it takes shape on a real canvas. Text underneath, so it pastes anywhere. Free on the web.',logo=RAW+'icelus/main/brand/icon-1024.png'),
'healstack':dict(name='Machaon',tagline='Track what you take, and what it does',site='https://machaon.jaybulb.com',desc='A personal substance tracker and educational wiki. Log doses, browse harm reduction info and track patterns over time. Your data stays yours.',logo=RAW+'machaon/main/brand/icon-1024.png'),
'bookrank':dict(name='Kernel',tagline='Every chapter in plain words',site='https://kernel.jaybulb.com',desc='Chapter by chapter summaries of the books you own. Read them, or listen. Private to your account. iPhone, iPad, Mac and the web.',logo=RAW+'kernel/main/brand/icon-1024.png'),
'curbfind':dict(name='Scrounger',tagline='A faster way to browse local classifieds',site='https://scrounger.jaybulb.com',desc='A faster way to browse Craigslist and local classifieds. Pick a city and search. Free on the web and the App Store.',logo=RAW+'scrounger/main/brand/icon-1024.png'),
'sidewise-2':dict(name='Sidewise',tagline='Retired. Bugle replaced it.',site='https://sidewise.jaybulb.com',desc='Sidewise was retired on October 28, 2026 and removed from sale. Bugle, an RSS reader with every feed in one timeline, replaced it.',logo=None),
}
def set_logo(url):
    r=ph.js("(function(){var bs=[...document.querySelectorAll('button')].filter(b=>b.innerText.trim()=='Paste a URL');bs[0].click();return 'c'})()",5)
    if r is None: ph.sysev(url); time.sleep(5); return 'prompt'
    time.sleep(1)
    return ph.js("(function(){var i=[...document.querySelectorAll('input')].find(x=>x.placeholder=='https://'&&x.name!='websiteUrl');if(!i)return 'noinput';Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,%s);i.dispatchEvent(new Event('input',{bubbles:true}));var b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()=='Add');if(!b)return 'noadd';b.click();return 'added'})()"%json.dumps(url))
def fix(slug):
    ph.nav('https://www.producthunt.com/products/%s/edit'%slug); time.sleep(5)
    if slug in REN:
        d=REN[slug]
        for sel,v in [('input[name=name]',d['name']),('input[name=tagline]',d['tagline']),('input[name=websiteUrl]',d['site']),('textarea[name=description]',d['desc'])]:
            ph.setval(sel,v)
    p=PRICING.get(slug)
    if p: ph.js("document.querySelector('input[name=pricingType][value=%s]').click();1"%p)
    lg=None
    if slug in REN and REN[slug]['logo']: lg=set_logo(REN[slug]['logo']); time.sleep(3)
    ph.js("[...document.querySelectorAll('button')].find(b=>/Save changes/.test(b.innerText)).click();1"); time.sleep(4)
    print(slug,'logo:',lg,'|',ph.js("document.body.innerText.match(/(Saved|saved|Error|error|required)[^\\n]{0,60}/)&&document.body.innerText.match(/(Saved|saved|Error|error|required)[^\\n]{0,60}/)[0]"),flush=True)
if __name__=='__main__':
    for s in sys.argv[1:]: fix(s)
