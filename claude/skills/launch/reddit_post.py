#!/usr/bin/env python3
"""Post launch kits to Reddit through the official API. Stdlib only.

  reddit_post.py auth <client_id> [client_secret]   one-time: opens Allow in Chrome, stores a refresh token in Keychain
  reddit_post.py me                                  karma + age (new accounts get rate-limited)
  reddit_post.py post <app> [<sub> ...]              submits launch/reddit/<sub>.md as a text post, records Post: url
  reddit_post.py dry <app>                           prints what would be posted

Needs a Reddit app from https://www.reddit.com/prefs/apps (type "web app", redirect http://localhost:8080).
Creds live in the macOS Keychain item "reddit-api", never in a repo.
"""
import base64, json, re, subprocess, sys, time, urllib.parse, urllib.request, webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

CODE = Path.home() / "Documents/Code"
UA = "macos:jaybulb-launch:v1 (by /u/nulljosh)"
REDIRECT = "http://localhost:8080"
KEY = "reddit-api"


def keychain_get():
    r = subprocess.run(["security", "find-generic-password", "-s", KEY, "-w"], capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 else None


def keychain_set(d):
    subprocess.run(["security", "delete-generic-password", "-s", KEY], capture_output=True)
    subprocess.run(["security", "add-generic-password", "-s", KEY, "-a", "reddit", "-w", json.dumps(d)], check=True)


def token_request(cid, secret, data):
    auth = base64.b64encode(f"{cid}:{secret or ''}".encode()).decode()
    req = urllib.request.Request("https://www.reddit.com/api/v1/access_token", data=urllib.parse.urlencode(data).encode(),
                                 headers={"Authorization": f"Basic {auth}", "User-Agent": UA})
    return json.load(urllib.request.urlopen(req))


def auth(cid, secret=None):
    state = "jaybulb"
    url = "https://www.reddit.com/api/v1/authorize?" + urllib.parse.urlencode({
        "client_id": cid, "response_type": "code", "state": state, "redirect_uri": REDIRECT,
        "duration": "permanent", "scope": "identity submit read"})
    got = {}

    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            got.update({k: v[0] for k, v in q.items()})
            self.send_response(200); self.end_headers()
            self.wfile.write(b"Done. You can close this tab.")
        def log_message(self, *a): pass

    srv = HTTPServer(("localhost", 8080), H)
    subprocess.run(["open", "-a", "Google Chrome", url])
    print("Click Allow in Chrome...")
    while "code" not in got and "error" not in got:
        srv.handle_request()
    if "error" in got:
        sys.exit("Reddit said: " + got["error"])
    tok = token_request(cid, secret, {"grant_type": "authorization_code", "code": got["code"], "redirect_uri": REDIRECT})
    if "refresh_token" not in tok:
        sys.exit("No refresh token: " + json.dumps(tok))
    keychain_set({"client_id": cid, "client_secret": secret or "", "refresh_token": tok["refresh_token"]})
    print("Stored. Account:", me()["name"])


def access_token():
    c = keychain_get()
    if not c:
        sys.exit("Run: reddit_post.py auth <client_id> [secret]")
    tok = token_request(c["client_id"], c["client_secret"], {"grant_type": "refresh_token", "refresh_token": c["refresh_token"]})
    return tok["access_token"]


def api(path, data=None):
    req = urllib.request.Request("https://oauth.reddit.com" + path,
                                 data=urllib.parse.urlencode(data).encode() if data else None,
                                 headers={"Authorization": "bearer " + access_token(), "User-Agent": UA})
    return json.load(urllib.request.urlopen(req))


def me():
    return api("/api/v1/me")


def kit(app, sub):
    p = CODE / app / "launch/reddit" / f"{sub}.md"
    s = p.read_text()
    title = re.search(r"^Title:\s*(.+)$", s, re.M).group(1).strip()
    body = s.split("Body:", 1)[1].strip()
    body = re.sub(r"\n\s*Post: .*$", "", body).strip()
    return p, title, body


def subs(app):
    d = CODE / app / "launch/reddit"
    return sorted(x.stem for x in d.glob("*.md") if x.stem != "checklist")


def post(app, wanted):
    for sub in wanted or subs(app):
        p, title, body = kit(app, sub)
        if "Post: http" in p.read_text():
            print(f"skip {sub}: already posted"); continue
        r = api("/api/submit", {"sr": sub, "kind": "self", "title": title, "text": body, "api_type": "json", "resubmit": "true"})
        errs = r.get("json", {}).get("errors")
        if errs:
            print(f"{sub}: {errs}"); continue
        url = r["json"]["data"]["url"]
        p.write_text(p.read_text().rstrip() + f"\n\nPost: {url}\n")
        print(f"{sub}: {url}")
        time.sleep(3)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    if a[0] == "auth": auth(*a[1:3])
    elif a[0] == "me":
        m = me(); print(m["name"], "karma", m.get("total_karma"), "created", time.strftime("%Y-%m-%d", time.gmtime(m["created_utc"])))
    elif a[0] == "post": post(a[1], a[2:])
    elif a[0] == "dry":
        for sub in subs(a[1]):
            _, t, b = kit(a[1], sub); print(f"--- r/{sub}\n{t}\n{b[:200]}...\n")
    else: sys.exit(__doc__)
