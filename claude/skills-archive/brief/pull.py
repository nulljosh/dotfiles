"""Pull Joshua's Litigate briefs from api.jaybulb.com into one local JSON file for /brief to read.

    python3 pull.py <out.json>

Signs in once with BRIEF_LOGIN_EMAIL / BRIEF_LOGIN_PASSWORD from ~/Documents/Code/temida/.env (never printed),
reads every brief_* table the account can see under row-level security, writes them to <out.json> with mode 600,
and prints only row counts. One sign-in attempt per run, so a stale password can't lock the account.
"""
import json, os, pathlib, sys, urllib.request, urllib.error

API = "https://api.jaybulb.com"
ENV = pathlib.Path.home() / "Documents/Code/temida/.env"
TABLES = ["brief_data", "brief_journal", "brief_checklist", "brief_lawyer_status", "brief_documents"]


def call(method, path, body=None, token=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"Content-Type": "application/json", "Origin": "https://litigate.jaybulb.com", "User-Agent": "Mozilla/5.0 brief-skill",
                                          **({"Authorization": f"Bearer {token}"} if token else {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"null")


def main():
    out = pathlib.Path(sys.argv[1])
    env = {k: v.strip().strip('"') for k, v in (l.split("=", 1) for l in ENV.read_text().splitlines() if "=" in l and not l.startswith("#"))}
    try:
        s = call("POST", "/auth/token?grant_type=password", {"email": env["BRIEF_LOGIN_EMAIL"], "password": env["BRIEF_LOGIN_PASSWORD"]})
    except urllib.error.HTTPError as e:
        sys.exit(f"sign-in failed ({e.code}): fix BRIEF_LOGIN_PASSWORD in {ENV}, or use Forgot password on the site")
    data = {}
    for t in TABLES:
        try:
            data[t] = call("GET", f"/rest/{t}", token=s["access_token"])
        except urllib.error.HTTPError as e:
            data[t] = {"error": e.code}
    out.write_text(json.dumps(data, indent=1))
    os.chmod(out, 0o600)
    print({t: (len(v) if isinstance(v, list) else v) for t, v in data.items()})


if __name__ == "__main__":
    main()
