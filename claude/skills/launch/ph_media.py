#!/usr/bin/env python3
"""Attach logo + gallery in PH's Media dialog by fetching each image in-page and setting the file inputs, then Save media. usage: ph_media.py <app> (dialog must be open or a Logo/Add images button visible)."""
import os,sys,time,json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import ph_submit as ph
from ph_apps import APPS
JS="""(async function(){var d=document.querySelector('[role=dialog],dialog');var f=[...d.querySelectorAll('input[type=file]')][%d];
var r=await fetch(%s);var b=await r.blob();var dt=new DataTransfer();dt.items.add(new File([b],'img.png',{type:b.type||'image/png'}));
f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));window.__phm='ok '+b.size})();1"""
def attach(app):
    a=APPS[app]
    if ph.js("document.querySelector('[role=dialog] input[type=file],dialog input[type=file]')?1:0") in (0,'0',None):
        for t in ['Logo','Add images','Edit media']:
            if ph.click(t,False)=='ok': break
        time.sleep(4)
    for i,u in [(0,a['logo'])]+[(1,g) for g in a['gallery']]:
        ph.js("window.__phm=''"); ph.js(JS%(i,json.dumps(u)))
        for _ in range(20):
            time.sleep(1); s=ph.js("window.__phm")
            if s: break
        print(' file',i,s); time.sleep(6)
    ph.click('Save media'); time.sleep(4)
    print(' status',ph.js("(document.body.innerText.match(/Before you launch[\\s\\S]{0,220}/)||[''])[0].replace(/\\n/g,' ')"))
if __name__=='__main__': attach(sys.argv[1])
