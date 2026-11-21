#!/usr/bin/env python3
"""Replace a product page gallery with one current image: add the URL, remove the old tiles, save. usage: ph_gallery.py <slug>... Edit G first."""
import os,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import ph_submit as ph,time,json,sys
G={'inkpress':'https://bugle.jaybulb.com/og.png','quotestreak':'https://raw.githubusercontent.com/nulljosh/labs/main/coda/launch/gallery/00-live.png','lexly':'https://patois.jaybulb.com/assets/og-image.jpg','sparkjar':'https://raw.githubusercontent.com/nulljosh/melete/main/launch/gallery/00-live.png','nyc-survive':'https://gastown.jaybulb.com/og.png','blockframe':'https://icelus.jaybulb.com/og.png','healstack':'https://machaon.jaybulb.com/og.png'}
def tiles(): return int(float(ph.js("document.querySelectorAll('[data-test^=gallery-media-]').length")or 0))-int(float(ph.js("document.querySelectorAll('[data-test=gallery-media-remove]').length")or 0))
def n(): return int(float(ph.js("document.querySelectorAll('[data-test=gallery-media-remove]').length") or 0))
def swap(slug):
    url=G[slug]
    ph.nav('https://www.producthunt.com/products/%s/edit'%slug); time.sleep(6)
    before=n()
    r=ph.js("(function(){var bs=[...document.querySelectorAll('button')].filter(b=>b.innerText.trim()=='Paste a URL');bs[bs.length-1].click();return 'c'})()",5)
    if r is None: ph.sysev(url); time.sleep(6)
    else:
        time.sleep(1)
        print(' inline',ph.js("(function(){var i=[...document.querySelectorAll('input')].find(x=>x.placeholder=='https://'&&!x.name);if(!i)i=[...document.querySelectorAll('input')].find(x=>x.placeholder=='https://');if(!i)return 'noinput';Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,%s);i.dispatchEvent(new Event('input',{bubbles:true}));var b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()=='Add');if(!b)return 'noadd';b.click();return 'added'})()"%json.dumps(url)))
        time.sleep(6)
    after=n()
    if after<=before: print(slug,'ADD FAILED',before,after); return
    for _ in range(before):
        ph.js("document.querySelector('[data-test=gallery-media-remove]').click();1"); time.sleep(1.5)
    final=n()
    ph.js("document.querySelector('[data-test=product-edit-submit]').click();1"); time.sleep(5)
    ph.nav('https://www.producthunt.com/products/%s/edit'%slug); time.sleep(6)
    print(slug,'before',before,'after add',after,'kept',final,'saved',n(),ph.js("[...document.querySelectorAll('[data-test^=gallery-media-] img')].map(i=>i.src.split('?')[0].slice(-12)).join(',')"),flush=True)
for s in sys.argv[1:]: swap(s)
