#!/usr/bin/env python3
"""Fill and schedule a Product Hunt launch in the signed-in Safari. usage: ph_submit.py <app> [draft-url]. Copy and edit ph_apps.py first."""
import subprocess,sys,time,json,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from ph_apps import APPS
S=os.path.dirname(os.path.abspath(__file__))+'/'
def js(code,t=15):
    p=subprocess.Popen(['osascript',S+'ph_js.scpt',code],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try: o,e=p.communicate(timeout=t); return o.strip()
    except subprocess.TimeoutExpired: p.kill(); return None
def raise_ph():
    subprocess.run(['osascript','-e','''tell application "Safari"
repeat with w in windows
repeat with t in tabs of w
if (URL of t) contains "producthunt.com" then
set index of w to 1
return
end if
end repeat
end repeat
end tell'''])
def ax_prompt(text):
    r=subprocess.run(['osascript','-e','''tell application "System Events" to tell process "Safari"
repeat with w in windows
try
set g to group 1 of tab group 1 of splitter group 1 of w
if exists button "OK" of g then
set value of text field 1 of g to %s
delay 0.3
click button "OK" of g
return "ok"
end if
end try
end repeat
return "none"
end tell'''%json.dumps(text)],capture_output=True,text=True)
    return r.stdout.strip()
def sysev(text):
    r=ax_prompt(text)
    if r=='ok': return
    print('  ax prompt not found, NOT typing (user may be active)'); return
    raise_ph()
    subprocess.run(['osascript','-e','tell application "Safari" to activate','-e','delay 0.5','-e','tell application "System Events" to keystroke %s'%json.dumps(text),'-e','delay 0.4','-e','tell application "System Events" to key code 36'])
def nav(url):
    for _ in range(20):
        t=js("document.body?document.body.innerText.indexOf('Saving')>=0?'s':'ok':'ok'",4)
        if t=='ok': break
        time.sleep(1)
    subprocess.run(['osascript','-e','''tell application "Safari"
repeat with w in windows
repeat with t in tabs of w
if (URL of t) contains "producthunt.com" then
set URL of t to "%s"
return
end if
end repeat
end repeat
end tell'''%url]); time.sleep(6)
def click(text,scope=True):
    if scope:
        sel="[...d.querySelectorAll('button,label,[role=option],li')]"; pre="var d=document.querySelector('[role=dialog],dialog');if(!d)return 'nodlg';"
    else:
        sel="[...d.querySelectorAll('button')]"; pre="var d=document;"
    return js("(function(){%svar e=%s.filter(x=>x.innerText&&x.innerText.trim()==%s).sort((a,b)=>a.innerText.length-b.innerText.length)[0];if(!e)return 'nf';e.click();return 'ok'})()"%(pre,sel,json.dumps(text)))
def prompt_open():
    return js('1',3) is None
def paste_url(url,last):
    idx='bs.length-1' if last else '0'
    subprocess.Popen(['osascript',S+'ph_js.scpt',"(function(){var d=document.querySelector('[role=dialog],dialog');var bs=[...d.querySelectorAll('button')].filter(b=>b.innerText.trim()=='Paste a URL');bs[%s].click();return 1})()"%idx],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    time.sleep(2)
    if prompt_open(): sysev(url); time.sleep(5); return True
    r=js("(function(){var d=document.querySelector('[role=dialog],dialog');var i=[...d.querySelectorAll('input[type=text]')].find(x=>x.placeholder=='https://');if(!i)return 'noinput';Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,%s);i.dispatchEvent(new Event('input',{bubbles:true}));var b=[...d.querySelectorAll('button')].find(x=>x.innerText.trim()=='Add');if(!b)return 'noadd';b.click();return 'added'})()"%json.dumps(url))
    print('  inline',r); time.sleep(4); return r=='added'
def setval(sel,v,scope='document'):
    return js("(function(){var e=%s.querySelector(%s);if(!e)return 'nf';var P=e.tagName=='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement;Object.getOwnPropertyDescriptor(P.prototype,'value').set.call(e,%s);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return 'ok'})()"%(scope,json.dumps(sel),json.dumps(v)))
def dlg_has(txt):
    return js("(function(){var d=document.querySelector('[role=dialog],dialog');return d&&d.innerText.indexOf(%s)>=0?'y':'n'})()"%json.dumps(txt))
def pick(items,cap=3,search='input[placeholder^=Search]'):
    n=0
    for it in items:
        if n>=cap: break
        r=click(it)
        if r!='ok':
            setval(search,it,"(document.querySelector('[role=dialog],dialog'))"); time.sleep(2)
            r=click(it)
        print('  pick',it,r)
        if r=='ok': n+=1
        time.sleep(1)
    return n
def add_gallery(url):
    for t in ['Add images','Edit media','Logo']:
        if click(t,False)=='ok': break
    time.sleep(2)
    r=js("(function(){var d=document.querySelector('[role=dialog],dialog');var bs=[...d.querySelectorAll('button')].filter(b=>b.innerText.trim()=='Paste a URL');bs[bs.length-1].click();return 'c'})()",5)
    if r is None:
        sysev(url); time.sleep(5)
    else:
        time.sleep(1)
        r=js("(function(){var d=document.querySelector('[role=dialog],dialog');var i=[...d.querySelectorAll('input')].find(x=>x.placeholder=='https://');if(!i)return 'noinput';Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,%s);i.dispatchEvent(new Event('input',{bubbles:true}));var b=[...d.querySelectorAll('button')].find(x=>x.innerText.trim()=='Add');if(!b)return 'noadd';b.click();return 'added'})()"%json.dumps(url))
        print('  gallery',r); time.sleep(5)
    print('  imgs',js("document.querySelector('[role=dialog],dialog').querySelectorAll('img').length"))
    click('Done'); time.sleep(3)
def add_logo(url):
    for t in ['Logo','Add images','Edit media']:
        if click(t,False)=='ok': break
    time.sleep(2)
    r=js("(function(){var d=document.querySelector('[role=dialog],dialog');var bs=[...d.querySelectorAll('button')].filter(b=>b.innerText.trim()=='Paste a URL');bs[0].click();return 'c'})()",5)
    if r is None: sysev(url); time.sleep(5)
    else:
        time.sleep(1)
        r=js("(function(){var d=document.querySelector('[role=dialog],dialog');var i=[...d.querySelectorAll('input')].find(x=>x.placeholder=='https://');if(!i)return 'noinput';Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,%s);i.dispatchEvent(new Event('input',{bubbles:true}));var b=[...d.querySelectorAll('button')].find(x=>x.innerText.trim()=='Add');if(!b)return 'noadd';b.click();return 'added'})()"%json.dumps(url))
        print('  logo',r); time.sleep(5)
    click('Done'); time.sleep(3)
def run(key):
    a=APPS[key]; print('==',key)
    if len(sys.argv)>2:
        nav(sys.argv[2])
    else:
      nav('https://www.producthunt.com/posts/new')
      setval('input[name=url]',a['url']); time.sleep(1)
      js("[...document.querySelectorAll('button')].find(x=>x.innerText.trim()=='Get started').click();1"); time.sleep(5)
    if js("document.querySelector('input[name=connectProduct]')?'y':'n'")=='y':
        js("[...document.querySelectorAll('input[name=connectProduct]')].find(x=>x.value=='false').click();[...document.querySelectorAll('button')].find(x=>x.innerText.trim()=='Get started').click();1"); time.sleep(6)
    print(' draft',js("location.href"))
    setval('input[name=name]',a['name']); setval('input[name=tagline]',a['tagline']); setval('textarea[name=description]',a['desc']); time.sleep(2)
    # media
    # ponytail: Media dialog now ends in "Save media"; URL paste never saved, so ph_media sets the file inputs
    import ph_media; ph_media.attach(key)
    # links
    click('Add links',False); time.sleep(2); click('Add link'); time.sleep(1)
    setval('input[name=url]',a['github'],"(document.querySelector('[role=dialog],dialog'))"); click('Done'); time.sleep(2)
    # categories
    click('Add product categories',False); time.sleep(2); print(' cats',pick(a['cats'])); click('Done'); time.sleep(2)
    # pricing
    click('Add pricing',False); time.sleep(2); js("var r=document.querySelector('[role=dialog] input[value=%s],dialog input[value=%s]');r&&r.click();1"%(a['pricing'],a['pricing'])); time.sleep(1); js("(function(){var d=document.querySelector('[role=dialog],dialog');var b=[...d.querySelectorAll('button')].find(x=>x.innerText.trim()=='Done');b&&b.click();return 1})()"); time.sleep(2)
    # tags
    click('Add launch tags',False); time.sleep(2); print(' tags',pick(a['tags'])); click('Done'); time.sleep(2)
    # comment
    c=json.dumps(a['comment'])
    js("(function(){var e=document.querySelector('[contenteditable=true]');e.focus();document.execCommand('selectAll');document.execCommand('insertText',false,%s);return 1})()"%c); time.sleep(2)
    js("var r=[...document.querySelectorAll('input[type=radio]')].filter(x=>x.value=='true');r[0]&&r[0].click();1")
    st=js("(document.body.innerText.match(/Before you launch[\\s\\S]{0,160}/)||[''])[0].replace(/\\n/g,' ')")
    print(' status',st)
    return st
def finish(key):
    a=APPS[key]
    js("[...document.querySelectorAll('button')].find(x=>/Finish setup|Schedule launch/.test(x.innerText)).click();1"); time.sleep(3)
    js("[...document.querySelectorAll('button')].find(x=>/Schedule launch/.test(x.innerText)).click();1"); time.sleep(3)
    print(' date',js("(function(){var t=[...document.querySelectorAll('button')].find(b=>b.innerText.replace(/\\s+/g,' ').trim().endsWith(%s));if(!t)return 'nf';t.click();return 'ok'})()"%json.dumps(a['date']))); time.sleep(2)
    js("[...document.querySelectorAll('button')].find(x=>/Confirm scheduled date/.test(x.innerText)).click();1"); time.sleep(4)
    r=js("document.body.innerText.slice(0,160).replace(/\\n/g,' ')"); print(' result',r); return r
if __name__=='__main__':
    key=sys.argv[1]; r=run(key)
    if 'ready to schedule' not in (r or ''): print('NOT READY, stopping'); sys.exit(1)
    finish(key)
