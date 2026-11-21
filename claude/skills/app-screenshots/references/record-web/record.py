#!/usr/bin/env -S uvx --from playwright python
"""Record a web page headlessly: video -> GIF plus a few still frames.
usage: record.py URL [seconds=30] [out=~/Desktop/<host>.gif] [WxH=1200x800]"""
import sys,os,glob,subprocess,tempfile,time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
url=sys.argv[1]; secs=int(sys.argv[2]) if len(sys.argv)>2 else 30
out=os.path.expanduser(sys.argv[3]) if len(sys.argv)>3 else os.path.expanduser(f'~/Desktop/{urlparse(url).hostname}.gif')
w,h=(int(v) for v in (sys.argv[4] if len(sys.argv)>4 else '1200x800').split('x'))
tmp=tempfile.mkdtemp(); frames=os.path.splitext(out)[0]
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':w,'height':h},record_video_dir=tmp,record_video_size={'width':w,'height':h})
    pg=c.new_page(); pg.goto(url+('&' if '?' in url else '?')+'nocache='+str(int(time.time())))
    for i in range(4): pg.wait_for_timeout(secs*1000//4); pg.screenshot(path=f'{frames}-{i}.png')
    c.close(); b.close()
webm=glob.glob(f'{tmp}/*.webm')[0]
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',webm,'-vf','fps=10,scale=800:-1',out],check=True)
print(out); print(*[f'{frames}-{i}.png' for i in range(4)])
