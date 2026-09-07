import re, sys, shutil, os
ROOT=os.path.expanduser('~/Documents/Code')
# name, landing file, app url ('' = same page with ?embed), extra selectors hidden when embedded
APPS=[
 ('Bookrank','bookrank/index.html','', '.hero'),
 ('Breathe','breathe/web/index.html','', 'header,h1,.sub'),
 ('Toroid','conway/index.html','play.html', ''),
 ('Dream','dream/web/index.html','', '.hero'),
 ('Homeqi','homeqi/index.html','', '.hero'),
 ('Inkpress','inkpress/web/index.html','/read.html', ''),
 ('Keyrate','keyrate/index.html','/app', ''),
 ('Quotestreak','quotestreak/index.html','/play.html', ''),
 ('Seamark','seamark/public/index.html','', '.hero'),
 ('Tripwire','tripwire/web/index.html','', '.hero'),
 ('Voxprint','voxprint/docs/index.html','app.html', ''),
 ('Wordroot','wordroot/landing/index.html','/app', ''),
 ('Curvely','curvely/landing/index.html','/app', ''),
 ('Lexly','lexly/index.html','/app/?demo=1', ''),
 ('Sidewise','sidewise/public/index.html','/app.html', ''),
 ('NYC Survive','nyc/landing/index.html','/app/', ''),
]
HEAD='''<link rel="stylesheet" href="devices.css">
<script>
// ponytail: UA sniff, good enough for a mockup. iphone is the default. ?embed = app only, for the landing demo frame.
(function(u,d){d=/Android/.test(u)?'android':/iPhone|iPad/.test(u)?'iphone':/Windows/.test(u)?'windows':/Mac/.test(u)?'mac':'iphone';document.documentElement.dataset.device=d;if(/[?&]embed\\b/.test(location.search))document.documentElement.classList.add('embed')})(navigator.userAgent);
</script>
<style>
/* Live demo: the real app in a frame matching the visitor's device (nimble treatment) */
.demo{margin:2rem auto 0;text-align:center;position:relative;z-index:2}
.demo .device-screen{aspect-ratio:9/19.5}
.demo .device-mac .device-screen,.demo .device-windows .device-screen{aspect-ratio:16/10}
.demo .device-screen iframe{position:absolute;top:0;left:0;border:0;display:block;transform-origin:0 0;width:390px;height:845px;background:#fff}
.demo .device-mac .device-screen iframe,.demo .device-windows .device-screen iframe{width:1024px;height:640px}
.demo-caption{font-size:.9rem;opacity:.65;margin:1rem 0 0}
.embed .demo,.embed footer,.embed nav%s{display:none!important}
</style>
'''
BODY='''
<div class="demo">
  <div class="device device-iphone" id="demoFrame" data-title="%(n)s"><div class="device-screen"><iframe id="demoApp" title="%(n)s, live" loading="lazy" data-src="%(u)s"></iframe></div></div>
  <p class="demo-caption">This is the <span id="demoDev">iPhone</span> app, live. Try it.</p>
</div>
<script>
(function(){var names={iphone:'iPhone',android:'Android',mac:'Mac',windows:'Windows'},dev=document.documentElement.dataset.device,f=document.getElementById('demoFrame'),i=document.getElementById('demoApp');
if(!names[dev])dev='iphone';f.className='device device-'+dev;document.getElementById('demoDev').textContent=names[dev];
if(!document.documentElement.classList.contains('embed'))i.src=i.dataset.src;
function fit(){i.style.transform='scale('+(i.parentNode.clientWidth/i.offsetWidth)+')';}fit();addEventListener('resize',fit);})();
</script>
'''
for name,rel,url,hide in APPS:
    p=os.path.join(ROOT,rel); s=open(p).read()
    if 'id="demoFrame"' in s: print('skip',rel); continue
    if not url: url=(os.path.basename(p) if os.path.basename(p)!='index.html' else './')+'?embed'
    extra=(','+','.join('.embed '+h for h in hide.split(','))) if hide else ''
    head=HEAD%extra
    if 'devices.css' in s: head=head.replace('<link rel="stylesheet" href="devices.css">\n','')
    s=s.replace('</head>',head+'</head>',1)
    m=re.search(r'<h1[\s\S]*?</h1>[\s\S]*?</p>',s)
    if not m: print('NO ANCHOR',rel); continue
    s=s[:m.end()]+BODY%{'n':name,'u':url}+s[m.end():]
    open(p,'w').write(s)
    d=os.path.dirname(p)
    if not os.path.exists(os.path.join(d,'devices.css')): shutil.copy(os.path.join(ROOT,'nulljosh.github.io/devices.css'),d)
    print('ok',rel,url)
