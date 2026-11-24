#!/usr/bin/env python3
"""Post to @nulljosh1 with the X API, no browser.
usage: post.py "text" [--reply-to ID]      post (or reply, for threads)
       post.py --thread <app>/launch/x.md  post a whole draft thread (1/, 2/… or "Post N:" blocks)
       post.py --whoami                    check which account the key belongs to
Keys: Keychain service "x-nulljosh1", accounts X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
(store them with keys.sh). Stdlib only, OAuth 1.0a HMAC-SHA1."""
import base64, hashlib, hmac, json, re, secrets, subprocess, sys, time, urllib.parse, urllib.request

def key(name):
    r = subprocess.run(["security", "find-generic-password", "-s", "x-nulljosh1", "-a", name, "-w"],
                       capture_output=True, text=True)
    if r.returncode: sys.exit(f"missing Keychain item x-nulljosh1/{name}; run keys.sh")
    return r.stdout.strip()

CK, CS, TK, TS = (key(k) for k in ("X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"))
q = lambda s: urllib.parse.quote(s, safe="")

def call(method, url, body=None):
    o = {"oauth_consumer_key": CK, "oauth_nonce": secrets.token_hex(16), "oauth_signature_method": "HMAC-SHA1",
         "oauth_timestamp": str(int(time.time())), "oauth_token": TK, "oauth_version": "1.0"}
    base = "&".join([method, q(url), q("&".join(f"{q(k)}={q(o[k])}" for k in sorted(o)))])
    o["oauth_signature"] = base64.b64encode(hmac.new(f"{q(CS)}&{q(TS)}".encode(), base.encode(), hashlib.sha1).digest()).decode()
    h = {"Authorization": "OAuth " + ", ".join(f'{q(k)}="{q(v)}"' for k, v in sorted(o.items()))}
    data = None
    if body is not None:
        data = json.dumps(body).encode(); h["Content-Type"] = "application/json"
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, data=data, method=method, headers=h), timeout=30).read())

def post(text, reply=None):
    body = {"text": text}
    if reply: body["reply"] = {"in_reply_to_tweet_id": reply}
    pid = call("POST", "https://api.twitter.com/2/tweets", body)["data"]["id"]
    print(f"posted https://x.com/nulljosh1/status/{pid}")
    return pid

def parts(path):
    s = open(path).read()
    blocks = re.split(r"^(?:\d+/|Post \d+:)\s*$", s, flags=re.M)[1:]
    return [b.strip() for b in blocks if b.strip()]

a = sys.argv[1:]
if not a: sys.exit(__doc__)
if a[0] == "--whoami":
    print(call("GET", "https://api.twitter.com/2/users/me")["data"]); sys.exit()
if a[0] == "--thread":
    prev = None
    for t in parts(a[1]): prev = post(t[:280], prev)
    sys.exit()
post(a[0][:280], a[a.index("--reply-to") + 1] if "--reply-to" in a else None)
