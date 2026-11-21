#!/usr/bin/env python3
"""Read every product page on /my/products: name, tagline, URL, GitHub, pricing, description, image count."""
import os,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import ph_submit as ph,time,json
ph.nav('https://www.producthunt.com/my/products'); time.sleep(6)
slugs=ph.js("[...new Set([...document.querySelectorAll('a')].map(a=>a.href).filter(h=>/\\/products\\/[^/]+\\/edit/.test(h)))].map(h=>h.split('/products/')[1].split('/')[0]).join(',')").split(',')
out={}
for s in slugs:
    ph.nav('https://www.producthunt.com/products/%s/edit'%s); time.sleep(4.5)
    r=ph.js("location.href.split('/products/')[1].split('/')[0]+'|'+JSON.stringify({n:document.querySelector('input[name=name]').value,t:document.querySelector('input[name=tagline]').value,s:document.querySelector('input[name=websiteUrl]').value,gh:document.querySelector('input[name=githubUrl]').value,p:[...document.querySelectorAll('input[name=pricingType]')].filter(r=>r.checked).map(r=>r.value),d:document.querySelector('textarea[name=description]').value.slice(0,60),imgs:document.querySelectorAll('img[src*=ph-files]').length})")
    print(s,'=>',r,flush=True)
