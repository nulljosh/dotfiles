#!/usr/bin/env python3
"""Post to X as @nulljosh1 with no API key and no visible window.
Headless Chrome (Playwright, channel=chrome) with its own profile at ~/.local/share/xpost-chrome.
First time only: xpost.py --login opens one Chrome window; sign in to X there, then close it.
Run with ~/.local/share/xpost-venv/bin/python.

usage: xpost.py --login                      one-time sign-in window
       xpost.py --check                      signed in? prints the handle
       xpost.py "text" [--reply-to ID]       one post (or a reply, for threads)
       xpost.py --thread <app>/launch/x.md   whole draft thread (1/ 2/ … or "Post N:" blocks)
"""
import os, re, struct, sys, time
from playwright.sync_api import sync_playwright

PROFILE = os.path.expanduser("~/.local/share/xpost-chrome")

def parts(path):
    s = open(path).read()
    return [p.strip() for p in re.split(r"^(?:\d+/|Post \d+:)\s*$", s, flags=re.M)[1:] if p.strip()]

def run(items, check=False, reply=None):
    with sync_playwright() as p:
        br = p.chromium.launch_persistent_context(PROFILE, channel="chrome", headless=True,
                                                   viewport={"width": 1280, "height": 900}, locale="en-US")
        pg = br.pages[0] if br.pages else br.new_page()
        pg.goto("https://x.com/home", wait_until="domcontentloaded")
        try:
            pg.wait_for_selector('[data-testid=AppTabBar_Profile_Link]', timeout=20000)
        except Exception:
            br.close(); sys.exit("not signed in: run xpost.py --login once")
        handle = pg.get_attribute('[data-testid=AppTabBar_Profile_Link]', "href").strip("/")
        if check:
            print("signed in as @" + handle); br.close(); return
        if handle.lower() != "nulljosh1":
            sys.exit(f"signed in as @{handle}, not @nulljosh1; stopping")
        prev = reply
        for text in items:
            url = f"https://x.com/compose/post" if not prev else f"https://x.com/intent/post?in_reply_to={prev}"
            pg.goto(url, wait_until="domcontentloaded")
            box = pg.wait_for_selector('[data-testid=tweetTextarea_0]', timeout=20000)
            box.click(); pg.keyboard.insert_text(text[:280]); time.sleep(1)
            pg.click('[data-testid=tweetButton]'); time.sleep(4)
            pg.goto(f"https://x.com/{handle}/with_replies" if prev else f"https://x.com/{handle}", wait_until="domcontentloaded")
            pg.wait_for_selector("article", timeout=20000); time.sleep(2)
            ids = pg.eval_on_selector_all('article a[href*="/status/"]', "els=>els.map(e=>e.getAttribute('href'))")
            snippet = text[:40]
            found = pg.evaluate("""s=>{for(const a of document.querySelectorAll('article')){if(a.innerText.includes(s)){const l=[...a.querySelectorAll('a[href*="/status/"]')].map(e=>e.getAttribute('href')).find(h=>/status\\/\\d+$/.test(h));if(l)return l}}return null}""", snippet)
            if not found: sys.exit(f"posted? couldn't find it on the profile: {snippet!r}")
            prev = found.rsplit("/", 1)[1]
            print(f"posted https://x.com/{handle}/status/{prev}")
        br.close()

a = sys.argv[1:]
if not a: sys.exit(__doc__)
if a[0] == "--login":
    with sync_playwright() as p:
        br = p.chromium.launch_persistent_context(PROFILE, channel="chrome", headless=False)
        pg = br.pages[0] if br.pages else br.new_page()
        pg.goto("https://x.com/login")
        print("sign in to X in the Chrome window; it closes itself once you're in")
        pg.wait_for_selector('[data-testid=AppTabBar_Profile_Link]', timeout=600000)
        br.close(); print("signed in, saved")
elif a[0] == "--check": run([], check=True)
elif a[0] == "--thread": run(parts(a[1]))
else: run([a[0]], reply=a[a.index("--reply-to") + 1] if "--reply-to" in a else None)
